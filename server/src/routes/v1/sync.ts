import { Router, Response } from 'express';
import { z } from 'zod';
import { parse } from '../../errors';
import { syncProjectSchedules } from '../../services/sync';
import { AuthRequest } from '../../types';
import { assertProjectInScope } from './scope';

const syncBodySchema = z.object({
  schedules: z.array(
    z.object({
      key: z.string().min(1).max(200),
      label: z.string().min(1),
      cronExpression: z.string().min(1),
      durationMinutes: z.number().int().min(0).optional(),
      color: z.string().min(1).optional(),
    })
  ),
});
const syncQuerySchema = z.object({ dryRun: z.enum(['true', 'false']).optional() });

export function registerSyncRoutes(router: Router): void {
  router.put('/projects/:id/schedules', (req: AuthRequest, res: Response) => {
    assertProjectInScope(req, req.params.id);
    const query = parse(syncQuerySchema, req.query);
    const { schedules } = parse(syncBodySchema, req.body);
    res.json(syncProjectSchedules(req.user!.id, req.params.id, schedules, query.dryRun === 'true'));
  });
}
