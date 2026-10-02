import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../db/connection';
import { HttpError } from '../errors';
import { validateCronExpression } from '../../../src/utils/cronParser';
import { getColorForIndex } from '../../../src/utils/colors';
import { requireProjectEdit } from './access';
import { insertSchedule, SCHEDULE_COLUMNS, ScheduleRow } from './schedules';

export interface SyncItem {
  key: string;
  label: string;
  cronExpression: string;
  durationMinutes?: number;
  color?: string; // Only applied when sent; new schedules get the next colour of the palette
}

// The keys of the schedules in each outcome
export interface SyncResult {
  dryRun: boolean;
  created: string[];
  updated: string[];
  deleted: string[];
  unchanged: string[];
}

// Makes the user's keyed schedules in a project match the list. Schedules created in the
// web app (no key) and other members' schedules are never touched, so a script can run this
// on every deploy and get the same result each time.
export function syncProjectSchedules(userId: string, projectId: string, items: SyncItem[], dryRun: boolean): SyncResult {
  const keys = new Set<string>();
  for (const item of items) {
    if (keys.has(item.key)) {
      throw new HttpError(400, `Duplicate key "${item.key}"`);
    }
    keys.add(item.key);
    if (!validateCronExpression(item.cronExpression)) {
      throw new HttpError(400, `Invalid cron expression for key "${item.key}"`);
    }
  }
  requireProjectEdit(userId, projectId, 'No edit access to this project');

  const db = getDatabase();
  const existing = db.prepare(`
    SELECT ${SCHEDULE_COLUMNS} FROM schedules s
    WHERE s.project_id = ? AND s.owner_id = ? AND s.sync_key IS NOT NULL
    ORDER BY s.created_at, s.rowid
  `).all(projectId, userId) as ScheduleRow[];
  const existingByKey = new Map(existing.map((row) => [row.sync_key as string, row]));

  const result: SyncResult = { dryRun, created: [], updated: [], deleted: [], unchanged: [] };
  const changes: (() => void)[] = [];

  items.forEach((item, index) => {
    const row = existingByKey.get(item.key);
    const durationMinutes = item.durationMinutes ?? 0;

    if (!row) {
      result.created.push(item.key);
      changes.push(() => insertSchedule({
        id: uuidv4(),
        ownerId: userId,
        projectId,
        label: item.label,
        cronExpression: item.cronExpression,
        color: item.color ?? getColorForIndex(index),
        durationMinutes,
        syncKey: item.key,
      }));
      return;
    }

    const color = item.color ?? row.color;
    const unchanged =
      row.label === item.label &&
      row.cron_expression === item.cronExpression &&
      row.duration_minutes === durationMinutes &&
      row.color === color;
    if (unchanged) {
      result.unchanged.push(item.key);
      return;
    }

    result.updated.push(item.key);
    changes.push(() => {
      db.prepare(`
        UPDATE schedules
        SET label = ?, cron_expression = ?, duration_minutes = ?, color = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(item.label, item.cronExpression, durationMinutes, color, row.id);
    });
  });

  for (const row of existing) {
    if (!keys.has(row.sync_key as string)) {
      result.deleted.push(row.sync_key as string);
      changes.push(() => {
        db.prepare('DELETE FROM schedules WHERE id = ?').run(row.id);
      });
    }
  }

  if (!dryRun) {
    db.transaction(() => changes.forEach((apply) => apply()))();
  }
  return result;
}
