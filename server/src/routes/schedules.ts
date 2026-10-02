import { Router, Response } from 'express';
import { z } from 'zod';
import { parse } from '../errors';
import { authMiddleware } from '../middleware/auth';
import { createScheduleSchema, updateScheduleSchema } from '../schemas';
import {
  createSchedule,
  deleteSchedule,
  listSchedules,
  replaceOwnedSchedules,
  updateSchedule,
} from '../services/schedules';
import { AuthRequest } from '../types';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

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

// The handlers are synchronous, so Express passes anything they throw (HttpError included)
// to the error handler

// GET / - List all schedules accessible by the user
router.get('/', (req: AuthRequest, res: Response) => {
  res.json(listSchedules(req.user!.id));
});

// POST / - Create a new schedule
router.post('/', (req: AuthRequest, res: Response) => {
  const input = parse(createScheduleSchema, req.body);
  res.status(201).json(createSchedule(req.user!.id, input));
});

// PUT /:id - Update a schedule
router.put('/:id', (req: AuthRequest, res: Response) => {
  const updates = parse(updateScheduleSchema, req.body);
  res.json(updateSchedule(req.user!.id, req.params.id, updates));
});

// DELETE /:id - Delete a schedule
router.delete('/:id', (req: AuthRequest, res: Response) => {
  deleteSchedule(req.user!.id, req.params.id);
  res.status(204).send();
});

// POST /sync - Bulk sync schedules (for initial sync from localStorage)
router.post('/sync', (req: AuthRequest, res: Response) => {
  const { schedules } = parse(syncSchedulesSchema, req.body);
  res.json(replaceOwnedSchedules(req.user!.id, schedules));
});

export default router;
