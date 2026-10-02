import { v4 as uuidv4 } from 'uuid';
import { getDatabase, isUniqueViolation } from '../db/connection';
import { sqliteToIso } from '../db/time';
import { HttpError } from '../errors';
import { validateCronExpression } from '../../../src/utils/cronParser';
import { getColorForIndex } from '../../../src/utils/colors';
import { canEdit, getProjectRole } from './access';

export interface ScheduleRow {
  id: string;
  owner_id: string;
  project_id: string | null;
  label: string;
  cron_expression: string;
  color: string;
  duration_minutes: number;
  sync_key: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApiSchedule {
  id: string;
  ownerId: string;
  projectId: string | null;
  label: string;
  cronExpression: string;
  color: string;
  durationMinutes: number;
  syncKey: string | null; // Set for schedules a script manages through PUT /api/v1/projects/:id/schedules
  createdAt: string;
  updatedAt: string;
}

export const SCHEDULE_COLUMNS =
  's.id, s.owner_id, s.project_id, s.label, s.cron_expression, s.color, s.duration_minutes, s.sync_key, s.created_at, s.updated_at';

export function toSchedule(row: ScheduleRow): ApiSchedule {
  return {
    id: row.id,
    ownerId: row.owner_id,
    projectId: row.project_id,
    label: row.label,
    cronExpression: row.cron_expression,
    color: row.color,
    durationMinutes: row.duration_minutes,
    syncKey: row.sync_key,
    createdAt: sqliteToIso(row.created_at),
    updatedAt: sqliteToIso(row.updated_at),
  };
}

// Schedules the user owns, plus every schedule in a project the user owns or has been shared
// (including ones other members added to the user's own projects)
const SCHEDULES_FOR_USER = `
  FROM schedules s
  LEFT JOIN projects p ON s.project_id = p.id
  LEFT JOIN project_shares ps ON ps.project_id = s.project_id AND ps.shared_with_user_id = :userId
  WHERE (s.owner_id = :userId OR p.owner_id = :userId OR ps.id IS NOT NULL)
`;

export function listSchedules(userId: string, filter: { projectId?: string; scheduleId?: string } = {}): ApiSchedule[] {
  const params: Record<string, string> = { userId };
  let conditions = '';
  if (filter.projectId) {
    conditions += ' AND s.project_id = :projectId';
    params.projectId = filter.projectId;
  }
  if (filter.scheduleId) {
    conditions += ' AND s.id = :scheduleId';
    params.scheduleId = filter.scheduleId;
  }

  const rows = getDatabase().prepare(`
    SELECT ${SCHEDULE_COLUMNS} ${SCHEDULES_FOR_USER} ${conditions}
    ORDER BY s.created_at DESC, s.rowid DESC
  `).all(params) as ScheduleRow[];
  return rows.map(toSchedule);
}

// Null when the schedule doesn't exist or isn't visible to the user
export function findSchedule(userId: string, scheduleId: string): ApiSchedule | null {
  return listSchedules(userId, { scheduleId })[0] ?? null;
}

export function listOwnedSchedules(userId: string): ApiSchedule[] {
  const rows = getDatabase().prepare(`
    SELECT ${SCHEDULE_COLUMNS} FROM schedules s
    WHERE s.owner_id = ?
    ORDER BY s.created_at DESC, s.rowid DESC
  `).all(userId) as ScheduleRow[];
  return rows.map(toSchedule);
}

function getSchedule(scheduleId: string): ApiSchedule {
  const row = getDatabase().prepare(`SELECT ${SCHEDULE_COLUMNS} FROM schedules s WHERE s.id = ?`).get(scheduleId) as ScheduleRow;
  return toSchedule(row);
}

export interface NewScheduleRow {
  id: string;
  ownerId: string;
  projectId: string | null;
  label: string;
  cronExpression: string;
  color: string;
  durationMinutes: number;
  syncKey?: string;
}

export function insertSchedule(schedule: NewScheduleRow): void {
  getDatabase().prepare(`
    INSERT INTO schedules (id, owner_id, project_id, label, cron_expression, color, duration_minutes, sync_key)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    schedule.id,
    schedule.ownerId,
    schedule.projectId,
    schedule.label,
    schedule.cronExpression,
    schedule.color,
    schedule.durationMinutes,
    schedule.syncKey ?? null
  );
}

export interface NewSchedule {
  id?: string;
  label: string;
  cronExpression: string;
  color?: string; // Defaults to the next colour of the palette
  durationMinutes?: number;
  projectId?: string | null;
}

export function createSchedule(userId: string, input: NewSchedule): ApiSchedule {
  if (!validateCronExpression(input.cronExpression)) {
    throw new HttpError(400, 'Invalid cron expression');
  }
  if (input.projectId && !canEdit(getProjectRole(userId, input.projectId))) {
    throw new HttpError(403, 'No access to this project or insufficient permissions');
  }

  const id = input.id || uuidv4();
  try {
    insertSchedule({
      id,
      ownerId: userId,
      projectId: input.projectId || null,
      label: input.label,
      cronExpression: input.cronExpression,
      color: input.color || getColorForIndex(countOwnedSchedules(userId)),
      durationMinutes: input.durationMinutes ?? 0,
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new HttpError(409, 'A schedule with this id already exists');
    }
    throw err;
  }
  return getSchedule(id);
}

function countOwnedSchedules(userId: string): number {
  const row = getDatabase().prepare('SELECT COUNT(*) AS count FROM schedules WHERE owner_id = ?').get(userId) as { count: number };
  return row.count;
}

export interface ScheduleUpdates {
  label?: string;
  cronExpression?: string;
  color?: string;
  durationMinutes?: number;
  projectId?: string | null;
}

export function updateSchedule(userId: string, scheduleId: string, updates: ScheduleUpdates): ApiSchedule {
  const db = getDatabase();
  const schedule = db.prepare('SELECT owner_id, project_id, cron_expression FROM schedules WHERE id = ?').get(scheduleId) as
    | { owner_id: string; project_id: string | null; cron_expression: string }
    | undefined;
  if (!schedule) {
    throw new HttpError(404, 'Schedule not found');
  }

  // The owner, or anyone who may edit the schedule's project
  const isOwner = schedule.owner_id === userId;
  if (!isOwner && !(schedule.project_id && canEdit(getProjectRole(userId, schedule.project_id)))) {
    throw new HttpError(403, 'No permission to update this schedule');
  }

  // Moving a schedule to another project (or out of one) is reserved for its owner,
  // and the owner needs edit access to the destination. An empty projectId means no project.
  const targetProjectId = updates.projectId === undefined ? undefined : updates.projectId || null;
  const isMove = targetProjectId !== undefined && targetProjectId !== schedule.project_id;
  if (isMove) {
    if (!isOwner) {
      throw new HttpError(403, 'Only the owner can move this schedule to another project');
    }
    if (targetProjectId && !canEdit(getProjectRole(userId, targetProjectId))) {
      throw new HttpError(403, 'No access to the specified project');
    }
  }

  // Schedules saved before cron expressions were checked stay renamable
  if (
    updates.cronExpression !== undefined &&
    updates.cronExpression !== schedule.cron_expression &&
    !validateCronExpression(updates.cronExpression)
  ) {
    throw new HttpError(400, 'Invalid cron expression');
  }

  const fields: string[] = [];
  const values: (string | number | null)[] = [];
  if (updates.label) {
    fields.push('label = ?');
    values.push(updates.label);
  }
  if (updates.cronExpression) {
    fields.push('cron_expression = ?');
    values.push(updates.cronExpression);
  }
  if (updates.color) {
    fields.push('color = ?');
    values.push(updates.color);
  }
  if (updates.durationMinutes !== undefined) {
    fields.push('duration_minutes = ?');
    values.push(updates.durationMinutes);
  }
  if (targetProjectId !== undefined) {
    fields.push('project_id = ?');
    values.push(targetProjectId);
  }
  if (fields.length === 0) {
    throw new HttpError(400, 'No fields to update');
  }

  fields.push("updated_at = datetime('now')");
  db.prepare(`UPDATE schedules SET ${fields.join(', ')} WHERE id = ?`).run(...values, scheduleId);
  return getSchedule(scheduleId);
}

export function deleteSchedule(userId: string, scheduleId: string): void {
  const db = getDatabase();
  const schedule = db.prepare('SELECT owner_id FROM schedules WHERE id = ?').get(scheduleId) as { owner_id: string } | undefined;
  if (!schedule) {
    throw new HttpError(404, 'Schedule not found');
  }
  // Only the owner can delete
  if (schedule.owner_id !== userId) {
    throw new HttpError(403, 'Only the owner can delete this schedule');
  }
  db.prepare('DELETE FROM schedules WHERE id = ?').run(scheduleId);
}

// Replaces everything the user owns (the web app's one-off upload of its localStorage data).
// Like creating schedules one by one, only into projects the user can edit.
export function replaceOwnedSchedules(userId: string, schedules: (NewSchedule & { id: string; color: string })[]): ApiSchedule[] {
  const projectIds = new Set(schedules.map((s) => s.projectId).filter((p): p is string => !!p));
  for (const projectId of projectIds) {
    if (!canEdit(getProjectRole(userId, projectId))) {
      throw new HttpError(403, 'No access to this project or insufficient permissions');
    }
  }

  const db = getDatabase();
  const replace = db.transaction(() => {
    db.prepare('DELETE FROM schedules WHERE owner_id = ?').run(userId);
    for (const schedule of schedules) {
      insertSchedule({
        id: schedule.id,
        ownerId: userId,
        projectId: schedule.projectId || null,
        label: schedule.label,
        cronExpression: schedule.cronExpression,
        color: schedule.color,
        durationMinutes: schedule.durationMinutes ?? 0,
      });
    }
  });

  try {
    replace();
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new HttpError(409, 'One or more schedule ids already exist');
    }
    throw err;
  }
  return listOwnedSchedules(userId);
}
