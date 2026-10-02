import { z } from 'zod';

// Request bodies shared by the web app's routes (/api) and the token API (/api/v1)

export const createProjectSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  color: z.string().min(1),
});

export const updateProjectSchema = z.object({
  name: z.string().min(1).optional(),
  color: z.string().min(1).optional(),
});

export const createScheduleSchema = z.object({
  id: z.string().optional(),
  label: z.string().min(1),
  cronExpression: z.string().min(1),
  color: z.string().min(1),
  durationMinutes: z.number().int().min(0).optional().default(0),
  projectId: z.string().nullable().optional(),
});

export const updateScheduleSchema = z.object({
  label: z.string().min(1).optional(),
  cronExpression: z.string().min(1).optional(),
  color: z.string().min(1).optional(),
  durationMinutes: z.number().int().min(0).optional(),
  projectId: z.string().nullable().optional(),
});
