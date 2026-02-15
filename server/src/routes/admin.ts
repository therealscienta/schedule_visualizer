import { Router, Response } from 'express';
import { z } from 'zod';
import { getDatabase } from '../db/connection';
import { authMiddleware } from '../middleware/auth';
import { adminMiddleware } from '../middleware/admin';
import { AuthRequest } from '../types';

const router = Router();

// All routes require authentication and admin privileges
router.use(authMiddleware);
router.use(adminMiddleware);

// Validation schemas
const updateUserSchema = z.object({
  role: z.enum(['user', 'admin']).optional(),
  is_active: z.number().int().min(0).max(1).optional(),
});

// GET /users - List all users
router.get('/users', (req: AuthRequest, res: Response, next) => {
  try {
    const db = getDatabase();

    const users = db.prepare(`
      SELECT id, username, email, role, is_active, created_at
      FROM users
      ORDER BY created_at DESC
    `).all() as any[];

    res.json(users);
  } catch (err) {
    next(err);
  }
});

// PUT /users/:id - Update user
router.put('/users/:id', (req: AuthRequest, res: Response, next) => {
  try {
    const { id } = req.params;

    // Validate input
    const validation = updateUserSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: 'Invalid input', details: validation.error.errors });
      return;
    }

    const updates = validation.data;

    // Can't update yourself
    if (id === req.user!.id) {
      if (updates.role && updates.role !== 'admin') {
        res.status(400).json({ error: 'Cannot demote yourself' });
        return;
      }
      if (updates.is_active === 0) {
        res.status(400).json({ error: 'Cannot deactivate yourself' });
        return;
      }
    }

    const db = getDatabase();

    // Check if user exists
    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Build update query dynamically
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.role) {
      fields.push('role = ?');
      values.push(updates.role);
    }
    if (updates.is_active !== undefined) {
      fields.push('is_active = ?');
      values.push(updates.is_active);
    }

    if (fields.length === 0) {
      res.status(400).json({ error: 'No fields to update' });
      return;
    }

    fields.push('updated_at = datetime("now")');
    values.push(id);

    const stmt = db.prepare(`
      UPDATE users
      SET ${fields.join(', ')}
      WHERE id = ?
    `);
    stmt.run(...values);

    // Fetch and return updated user
    const updatedUser = db.prepare(`
      SELECT id, username, email, role, is_active, created_at, updated_at
      FROM users
      WHERE id = ?
    `).get(id);

    res.json(updatedUser);
  } catch (err) {
    next(err);
  }
});

// DELETE /users/:id - Delete user
router.delete('/users/:id', (req: AuthRequest, res: Response, next) => {
  try {
    const { id } = req.params;

    // Can't delete yourself
    if (id === req.user!.id) {
      res.status(400).json({ error: 'Cannot delete yourself' });
      return;
    }

    const db = getDatabase();

    // Check if user exists
    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Delete user (CASCADE will delete all related data)
    db.prepare('DELETE FROM users WHERE id = ?').run(id);

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// GET /projects - List all projects with owner info
router.get('/projects', (req: AuthRequest, res: Response, next) => {
  try {
    const db = getDatabase();

    const projects = db.prepare(`
      SELECT
        p.id,
        p.name,
        p.color,
        p.owner_id,
        u.username as owner_username,
        u.email as owner_email,
        p.created_at,
        p.updated_at,
        (SELECT COUNT(*) FROM schedules WHERE project_id = p.id) as schedule_count,
        (SELECT COUNT(*) FROM project_shares WHERE project_id = p.id) as share_count
      FROM projects p
      JOIN users u ON p.owner_id = u.id
      ORDER BY p.created_at DESC
    `).all() as any[];

    const formattedProjects = projects.map(p => ({
      id: p.id,
      name: p.name,
      color: p.color,
      ownerId: p.owner_id,
      ownerUsername: p.owner_username,
      ownerEmail: p.owner_email,
      scheduleCount: p.schedule_count,
      shareCount: p.share_count,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
    }));

    res.json(formattedProjects);
  } catch (err) {
    next(err);
  }
});

// DELETE /projects/:id - Delete any project
router.delete('/projects/:id', (req: AuthRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const db = getDatabase();

    // Check if project exists
    const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(id);
    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    // Delete project (CASCADE will delete schedules and shares)
    db.prepare('DELETE FROM projects WHERE id = ?').run(id);

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// GET /stats - Get system statistics
router.get('/stats', (req: AuthRequest, res: Response, next) => {
  try {
    const db = getDatabase();

    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
    const projectCount = db.prepare('SELECT COUNT(*) as count FROM projects').get() as { count: number };
    const scheduleCount = db.prepare('SELECT COUNT(*) as count FROM schedules').get() as { count: number };
    const shareCount = db.prepare('SELECT COUNT(*) as count FROM project_shares').get() as { count: number };

    res.json({
      userCount: userCount.count,
      projectCount: projectCount.count,
      scheduleCount: scheduleCount.count,
      shareCount: shareCount.count,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
