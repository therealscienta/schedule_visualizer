import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { getDatabase } from '../db/connection';
import { authMiddleware } from '../middleware/auth';
import { AuthRequest } from '../types';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Validation schemas
const createScheduleSchema = z.object({
  id: z.string().optional(),
  label: z.string().min(1),
  cronExpression: z.string().min(1),
  color: z.string().min(1),
  durationMinutes: z.number().int().min(0).optional().default(0),
  projectId: z.string().optional(),
});

const updateScheduleSchema = z.object({
  label: z.string().min(1).optional(),
  cronExpression: z.string().min(1).optional(),
  color: z.string().min(1).optional(),
  durationMinutes: z.number().int().min(0).optional(),
  projectId: z.string().nullable().optional(),
});

const syncSchedulesSchema = z.object({
  schedules: z.array(
    z.object({
      id: z.string(),
      label: z.string().min(1),
      cronExpression: z.string().min(1),
      color: z.string().min(1),
      durationMinutes: z.number().int().min(0).optional().default(0),
      projectId: z.string().nullable().optional(),
    })
  ),
});

// Helper function to check if user has access to a project
function hasProjectAccess(userId: string, projectId: string, requireEdit: boolean = false): boolean {
  const db = getDatabase();

  // Check if user owns the project
  const project = db.prepare('SELECT owner_id FROM projects WHERE id = ?').get(projectId) as any;
  if (project && project.owner_id === userId) {
    return true;
  }

  if (requireEdit) {
    // Check if user has edit permission
    const share = db.prepare(`
      SELECT permission FROM project_shares
      WHERE project_id = ? AND shared_with_user_id = ?
    `).get(projectId, userId) as any;
    return share && share.permission === 'edit';
  }

  // For view access, just check if share exists
  const share = db.prepare(`
    SELECT id FROM project_shares
    WHERE project_id = ? AND shared_with_user_id = ?
  `).get(projectId, userId);
  return !!share;
}

// GET / - List all schedules accessible by the user
router.get('/', (req: AuthRequest, res: Response, next) => {
  try {
    const db = getDatabase();

    // Get schedules owned by the user
    const ownedSchedules = db.prepare(`
      SELECT id, owner_id, project_id, label, cron_expression, color, duration_minutes, created_at, updated_at
      FROM schedules
      WHERE owner_id = ?
      ORDER BY created_at DESC
    `).all(req.user!.id);

    // Get schedules from shared projects
    const sharedSchedules = db.prepare(`
      SELECT DISTINCT s.id, s.owner_id, s.project_id, s.label, s.cron_expression, s.color, s.duration_minutes, s.created_at, s.updated_at
      FROM schedules s
      JOIN project_shares ps ON s.project_id = ps.project_id
      WHERE ps.shared_with_user_id = ? AND s.owner_id != ?
      ORDER BY s.created_at DESC
    `).all(req.user!.id, req.user!.id);

    // Combine and format results
    const allSchedules = [...ownedSchedules, ...sharedSchedules].map((s: any) => ({
      id: s.id,
      ownerId: s.owner_id,
      projectId: s.project_id,
      label: s.label,
      cronExpression: s.cron_expression,
      color: s.color,
      durationMinutes: s.duration_minutes,
      createdAt: s.created_at,
      updatedAt: s.updated_at,
    }));

    res.json(allSchedules);
  } catch (err) {
    next(err);
  }
});

// POST / - Create a new schedule
router.post('/', (req: AuthRequest, res: Response, next) => {
  try {
    // Validate input
    const validation = createScheduleSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: 'Invalid input', details: validation.error.errors });
      return;
    }

    const { id: clientId, label, cronExpression, color, durationMinutes, projectId } = validation.data;

    // If projectId is provided, verify access
    if (projectId) {
      if (!hasProjectAccess(req.user!.id, projectId, true)) {
        res.status(403).json({ error: 'No access to this project or insufficient permissions' });
        return;
      }
    }

    const db = getDatabase();
    const id = clientId || uuidv4();

    const stmt = db.prepare(`
      INSERT INTO schedules (id, owner_id, project_id, label, cron_expression, color, duration_minutes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, req.user!.id, projectId || null, label, cronExpression, color, durationMinutes);

    // Fetch and return the created schedule
    const schedule = db.prepare(`
      SELECT id, owner_id, project_id, label, cron_expression, color, duration_minutes, created_at, updated_at
      FROM schedules
      WHERE id = ?
    `).get(id) as any;

    res.status(201).json({
      id: schedule.id,
      ownerId: schedule.owner_id,
      projectId: schedule.project_id,
      label: schedule.label,
      cronExpression: schedule.cron_expression,
      color: schedule.color,
      durationMinutes: schedule.duration_minutes,
      createdAt: schedule.created_at,
      updatedAt: schedule.updated_at,
    });
  } catch (err) {
    next(err);
  }
});

// PUT /:id - Update a schedule
router.put('/:id', (req: AuthRequest, res: Response, next) => {
  try {
    const { id } = req.params;

    // Validate input
    const validation = updateScheduleSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: 'Invalid input', details: validation.error.errors });
      return;
    }

    const db = getDatabase();

    // Get the schedule
    const schedule = db.prepare(`
      SELECT owner_id, project_id FROM schedules WHERE id = ?
    `).get(id) as any;

    if (!schedule) {
      res.status(404).json({ error: 'Schedule not found' });
      return;
    }

    // Check permissions
    let hasAccess = schedule.owner_id === req.user!.id;
    if (!hasAccess && schedule.project_id) {
      hasAccess = hasProjectAccess(req.user!.id, schedule.project_id, true);
    }

    if (!hasAccess) {
      res.status(403).json({ error: 'No permission to update this schedule' });
      return;
    }

    const updates = validation.data;

    // If updating projectId, verify access to new project
    if (updates.projectId !== undefined && updates.projectId !== null) {
      if (!hasProjectAccess(req.user!.id, updates.projectId, true)) {
        res.status(403).json({ error: 'No access to the specified project' });
        return;
      }
    }

    // Build update query dynamically
    const fields: string[] = [];
    const values: any[] = [];

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
    if (updates.projectId !== undefined) {
      fields.push('project_id = ?');
      values.push(updates.projectId);
    }

    if (fields.length === 0) {
      res.status(400).json({ error: 'No fields to update' });
      return;
    }

    fields.push('updated_at = datetime("now")');
    values.push(id);

    const stmt = db.prepare(`
      UPDATE schedules
      SET ${fields.join(', ')}
      WHERE id = ?
    `);
    stmt.run(...values);

    // Fetch and return updated schedule
    const updatedSchedule = db.prepare(`
      SELECT id, owner_id, project_id, label, cron_expression, color, duration_minutes, created_at, updated_at
      FROM schedules
      WHERE id = ?
    `).get(id) as any;

    res.json({
      id: updatedSchedule.id,
      ownerId: updatedSchedule.owner_id,
      projectId: updatedSchedule.project_id,
      label: updatedSchedule.label,
      cronExpression: updatedSchedule.cron_expression,
      color: updatedSchedule.color,
      durationMinutes: updatedSchedule.duration_minutes,
      createdAt: updatedSchedule.created_at,
      updatedAt: updatedSchedule.updated_at,
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /:id - Delete a schedule
router.delete('/:id', (req: AuthRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const db = getDatabase();

    // Get the schedule
    const schedule = db.prepare('SELECT owner_id FROM schedules WHERE id = ?').get(id) as any;

    if (!schedule) {
      res.status(404).json({ error: 'Schedule not found' });
      return;
    }

    // Only the owner can delete
    if (schedule.owner_id !== req.user!.id) {
      res.status(403).json({ error: 'Only the owner can delete this schedule' });
      return;
    }

    db.prepare('DELETE FROM schedules WHERE id = ?').run(id);

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// POST /sync - Bulk sync schedules (for initial sync from localStorage)
router.post('/sync', (req: AuthRequest, res: Response, next) => {
  try {
    // Validate input
    const validation = syncSchedulesSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: 'Invalid input', details: validation.error.errors });
      return;
    }

    const { schedules } = validation.data;
    const db = getDatabase();

    // Start a transaction
    const deleteStmt = db.prepare('DELETE FROM schedules WHERE owner_id = ?');
    const insertStmt = db.prepare(`
      INSERT INTO schedules (id, owner_id, project_id, label, cron_expression, color, duration_minutes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const transaction = db.transaction((userId: string, schedulesToInsert: any[]) => {
      // Delete all existing schedules
      deleteStmt.run(userId);

      // Insert new schedules
      for (const schedule of schedulesToInsert) {
        insertStmt.run(
          schedule.id,
          userId,
          schedule.projectId || null,
          schedule.label,
          schedule.cronExpression,
          schedule.color,
          schedule.durationMinutes
        );
      }
    });

    transaction(req.user!.id, schedules);

    // Fetch and return all schedules
    const insertedSchedules = db.prepare(`
      SELECT id, owner_id, project_id, label, cron_expression, color, duration_minutes, created_at, updated_at
      FROM schedules
      WHERE owner_id = ?
      ORDER BY created_at DESC
    `).all(req.user!.id) as any[];

    const formattedSchedules = insertedSchedules.map(s => ({
      id: s.id,
      ownerId: s.owner_id,
      projectId: s.project_id,
      label: s.label,
      cronExpression: s.cron_expression,
      color: s.color,
      durationMinutes: s.duration_minutes,
      createdAt: s.created_at,
      updatedAt: s.updated_at,
    }));

    res.json(formattedSchedules);
  } catch (err) {
    next(err);
  }
});

export default router;
