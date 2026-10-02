import { Router, Response } from 'express';
import { parse } from '../errors';
import { authMiddleware } from '../middleware/auth';
import { createProjectSchema, updateProjectSchema } from '../schemas';
import { createProject, deleteProject, listProjects, updateProject } from '../services/projects';
import { AuthRequest } from '../types';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// The handlers are synchronous, so Express passes anything they throw (HttpError included)
// to the error handler

// GET / - List all projects accessible by the user (owned + shared, with the user's role)
router.get('/', (req: AuthRequest, res: Response) => {
  res.json(listProjects(req.user!.id));
});

// POST / - Create a new project
router.post('/', (req: AuthRequest, res: Response) => {
  const input = parse(createProjectSchema, req.body);
  res.status(201).json(createProject(req.user!.id, input));
});

// PUT /:id - Update a project
router.put('/:id', (req: AuthRequest, res: Response) => {
  const updates = parse(updateProjectSchema, req.body);
  res.json(updateProject(req.user!.id, req.params.id, updates));
});

// DELETE /:id - Delete a project
router.delete('/:id', (req: AuthRequest, res: Response) => {
  deleteProject(req.user!.id, req.params.id);
  res.status(204).send();
});

export default router;
