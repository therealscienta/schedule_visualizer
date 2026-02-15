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
const shareProjectSchema = z.object({
  identifier: z.string().min(1), // username or email
  permission: z.enum(['view', 'edit']),
});

// POST /:id/share - Share a project with another user
router.post('/:id/share', (req: AuthRequest, res: Response, next) => {
  try {
    const { id: projectId } = req.params;

    // Validate input
    const validation = shareProjectSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: 'Invalid input', details: validation.error.errors });
      return;
    }

    const { identifier, permission } = validation.data;
    const db = getDatabase();

    // Verify user owns the project
    const project = db.prepare('SELECT owner_id FROM projects WHERE id = ?').get(projectId) as any;

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    if (project.owner_id !== req.user!.id) {
      res.status(403).json({ error: 'Only the owner can share this project' });
      return;
    }

    // Find the user to share with
    const targetUser = db.prepare(`
      SELECT id, username, email
      FROM users
      WHERE username = ? OR email = ?
    `).get(identifier, identifier) as any;

    if (!targetUser) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Can't share with yourself
    if (targetUser.id === req.user!.id) {
      res.status(400).json({ error: 'Cannot share with yourself' });
      return;
    }

    const shareId = uuidv4();

    try {
      // Insert share record
      const stmt = db.prepare(`
        INSERT INTO project_shares (id, project_id, shared_with_user_id, permission)
        VALUES (?, ?, ?, ?)
      `);
      stmt.run(shareId, projectId, targetUser.id, permission);

      res.status(201).json({
        id: shareId,
        projectId,
        userId: targetUser.id,
        username: targetUser.username,
        email: targetUser.email,
        permission,
      });
    } catch (err: any) {
      // Handle unique constraint violation (already shared)
      if (err.code === 'SQLITE_CONSTRAINT_UNIQUE' || err.message.includes('UNIQUE')) {
        // Update existing share
        const updateStmt = db.prepare(`
          UPDATE project_shares
          SET permission = ?
          WHERE project_id = ? AND shared_with_user_id = ?
        `);
        updateStmt.run(permission, projectId, targetUser.id);

        // Get the updated share
        const share = db.prepare(`
          SELECT id FROM project_shares
          WHERE project_id = ? AND shared_with_user_id = ?
        `).get(projectId, targetUser.id) as any;

        res.json({
          id: share.id,
          projectId,
          userId: targetUser.id,
          username: targetUser.username,
          email: targetUser.email,
          permission,
        });
        return;
      }
      throw err;
    }
  } catch (err) {
    next(err);
  }
});

// DELETE /:id/share/:userId - Revoke project share
router.delete('/:id/share/:userId', (req: AuthRequest, res: Response, next) => {
  try {
    const { id: projectId, userId } = req.params;
    const db = getDatabase();

    // Verify user owns the project
    const project = db.prepare('SELECT owner_id FROM projects WHERE id = ?').get(projectId) as any;

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    if (project.owner_id !== req.user!.id) {
      res.status(403).json({ error: 'Only the owner can revoke shares' });
      return;
    }

    // Delete the share
    const result = db.prepare(`
      DELETE FROM project_shares
      WHERE project_id = ? AND shared_with_user_id = ?
    `).run(projectId, userId);

    if (result.changes === 0) {
      res.status(404).json({ error: 'Share not found' });
      return;
    }

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// GET /:id/shared-users - List all users a project is shared with
router.get('/:id/shared-users', (req: AuthRequest, res: Response, next) => {
  try {
    const { id: projectId } = req.params;
    const db = getDatabase();

    // Verify user owns the project
    const project = db.prepare('SELECT owner_id FROM projects WHERE id = ?').get(projectId) as any;

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    if (project.owner_id !== req.user!.id) {
      res.status(403).json({ error: 'Only the owner can view shares' });
      return;
    }

    // Get all shares
    const shares = db.prepare(`
      SELECT ps.id, ps.shared_with_user_id, ps.permission, u.username, u.email
      FROM project_shares ps
      JOIN users u ON ps.shared_with_user_id = u.id
      WHERE ps.project_id = ?
      ORDER BY ps.created_at DESC
    `).all(projectId) as any[];

    const formattedShares = shares.map(s => ({
      id: s.id,
      userId: s.shared_with_user_id,
      username: s.username,
      email: s.email,
      permission: s.permission,
    }));

    res.json(formattedShares);
  } catch (err) {
    next(err);
  }
});

export default router;
