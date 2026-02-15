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
const createProjectSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  color: z.string().min(1),
});

const updateProjectSchema = z.object({
  name: z.string().min(1).optional(),
  color: z.string().min(1).optional(),
});

// Helper function to check if user has access to a project
function hasProjectAccess(userId: string, projectId: string, requireEdit: boolean = false): { hasAccess: boolean; isOwner: boolean } {
  const db = getDatabase();

  // Check if user owns the project
  const project = db.prepare('SELECT owner_id FROM projects WHERE id = ?').get(projectId) as any;
  if (project && project.owner_id === userId) {
    return { hasAccess: true, isOwner: true };
  }

  if (!project) {
    return { hasAccess: false, isOwner: false };
  }

  if (requireEdit) {
    // Check if user has edit permission
    const share = db.prepare(`
      SELECT permission FROM project_shares
      WHERE project_id = ? AND shared_with_user_id = ?
    `).get(projectId, userId) as any;
    return { hasAccess: share && share.permission === 'edit', isOwner: false };
  }

  // For view access, just check if share exists
  const share = db.prepare(`
    SELECT id FROM project_shares
    WHERE project_id = ? AND shared_with_user_id = ?
  `).get(projectId, userId);
  return { hasAccess: !!share, isOwner: false };
}

// GET / - List all projects accessible by the user
router.get('/', (req: AuthRequest, res: Response, next) => {
  try {
    const db = getDatabase();

    // Get projects owned by the user
    const ownedProjects = db.prepare(`
      SELECT id, owner_id, name, color, created_at, updated_at
      FROM projects
      WHERE owner_id = ?
      ORDER BY created_at DESC
    `).all(req.user!.id) as any[];

    // Get projects shared with the user
    const sharedProjects = db.prepare(`
      SELECT p.id, p.owner_id, p.name, p.color, p.created_at, p.updated_at, ps.permission
      FROM projects p
      JOIN project_shares ps ON p.id = ps.project_id
      WHERE ps.shared_with_user_id = ?
      ORDER BY p.created_at DESC
    `).all(req.user!.id) as any[];

    // Format results
    const allProjects = [
      ...ownedProjects.map(p => ({
        id: p.id,
        ownerId: p.owner_id,
        name: p.name,
        color: p.color,
        role: 'owner' as const,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
      })),
      ...sharedProjects.map(p => ({
        id: p.id,
        ownerId: p.owner_id,
        name: p.name,
        color: p.color,
        role: p.permission,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
      })),
    ];

    res.json(allProjects);
  } catch (err) {
    next(err);
  }
});

// POST / - Create a new project
router.post('/', (req: AuthRequest, res: Response, next) => {
  try {
    // Validate input
    const validation = createProjectSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: 'Invalid input', details: validation.error.errors });
      return;
    }

    const { id: clientId, name, color } = validation.data;
    const db = getDatabase();
    const id = clientId || uuidv4();

    const stmt = db.prepare(`
      INSERT INTO projects (id, owner_id, name, color)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(id, req.user!.id, name, color);

    // Fetch and return the created project
    const project = db.prepare(`
      SELECT id, owner_id, name, color, created_at, updated_at
      FROM projects
      WHERE id = ?
    `).get(id) as any;

    res.status(201).json({
      id: project.id,
      ownerId: project.owner_id,
      name: project.name,
      color: project.color,
      role: 'owner',
      createdAt: project.created_at,
      updatedAt: project.updated_at,
    });
  } catch (err) {
    next(err);
  }
});

// PUT /:id - Update a project
router.put('/:id', (req: AuthRequest, res: Response, next) => {
  try {
    const { id } = req.params;

    // Validate input
    const validation = updateProjectSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: 'Invalid input', details: validation.error.errors });
      return;
    }

    const db = getDatabase();

    // Check permissions
    const access = hasProjectAccess(req.user!.id, id, true);
    if (!access.hasAccess) {
      res.status(403).json({ error: 'No permission to update this project' });
      return;
    }

    const updates = validation.data;

    // Build update query dynamically
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.name) {
      fields.push('name = ?');
      values.push(updates.name);
    }
    if (updates.color) {
      fields.push('color = ?');
      values.push(updates.color);
    }

    if (fields.length === 0) {
      res.status(400).json({ error: 'No fields to update' });
      return;
    }

    fields.push('updated_at = datetime("now")');
    values.push(id);

    const stmt = db.prepare(`
      UPDATE projects
      SET ${fields.join(', ')}
      WHERE id = ?
    `);
    stmt.run(...values);

    // Fetch and return updated project
    const updatedProject = db.prepare(`
      SELECT id, owner_id, name, color, created_at, updated_at
      FROM projects
      WHERE id = ?
    `).get(id) as any;

    // Determine role
    const role = access.isOwner ? 'owner' : 'edit';

    res.json({
      id: updatedProject.id,
      ownerId: updatedProject.owner_id,
      name: updatedProject.name,
      color: updatedProject.color,
      role,
      createdAt: updatedProject.created_at,
      updatedAt: updatedProject.updated_at,
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /:id - Delete a project
router.delete('/:id', (req: AuthRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const db = getDatabase();

    // Get the project
    const project = db.prepare('SELECT owner_id FROM projects WHERE id = ?').get(id) as any;

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    // Only the owner can delete
    if (project.owner_id !== req.user!.id) {
      res.status(403).json({ error: 'Only the owner can delete this project' });
      return;
    }

    db.prepare('DELETE FROM projects WHERE id = ?').run(id);

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
