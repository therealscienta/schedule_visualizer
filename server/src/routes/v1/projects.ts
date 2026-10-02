import { Router, Response } from 'express';
import { HttpError, parse } from '../../errors';
import { createProjectSchema, updateProjectSchema } from '../../schemas';
import { createProject, deleteProject, findProject, listProjects, updateProject } from '../../services/projects';
import { AuthRequest } from '../../types';
import { assertProjectInScope, limitedProject } from './scope';

const newProjectSchema = createProjectSchema.omit({ id: true });

export function registerProjectRoutes(router: Router): void {
  router.get('/projects', (req: AuthRequest, res: Response) => {
    const limit = limitedProject(req);
    res.json(listProjects(req.user!.id).filter((project) => !limit || project.id === limit));
  });

  router.get('/projects/:id', (req: AuthRequest, res: Response) => {
    assertProjectInScope(req, req.params.id);
    const project = findProject(req.user!.id, req.params.id);
    if (!project) {
      throw new HttpError(404, 'Project not found');
    }
    res.json(project);
  });

  router.post('/projects', (req: AuthRequest, res: Response) => {
    if (limitedProject(req)) {
      throw new HttpError(403, 'This token is limited to one project and cannot create projects');
    }
    const input = parse(newProjectSchema, req.body);
    res.status(201).json(createProject(req.user!.id, input));
  });

  router.patch('/projects/:id', (req: AuthRequest, res: Response) => {
    assertProjectInScope(req, req.params.id);
    const updates = parse(updateProjectSchema, req.body);
    res.json(updateProject(req.user!.id, req.params.id, updates));
  });

  router.delete('/projects/:id', (req: AuthRequest, res: Response) => {
    if (limitedProject(req)) {
      throw new HttpError(403, 'This token is limited to one project and cannot delete projects');
    }
    deleteProject(req.user!.id, req.params.id);
    res.status(204).send();
  });
}
