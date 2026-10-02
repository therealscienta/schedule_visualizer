import { randomUUID } from 'crypto';
import { Router, Response } from 'express';
import { z } from 'zod';
import type { Schedule } from '../../../../src/types';
import {
  detectOverlaps,
  generateExecutionsWithLimit,
  isValidTimeZone,
  MAX_EXECUTIONS_PER_SCHEDULE,
  validateCronExpression,
} from '../../../../src/utils/cronParser';
import { HttpError, parse } from '../../errors';
import { ApiSchedule, listSchedules } from '../../services/schedules';
import { AuthRequest } from '../../types';
import { projectFilter } from './scope';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const MAX_RUNS_WINDOW_DAYS = 366;
const MAX_OVERLAPS_WINDOW_DAYS = 31;
const DEFAULT_RUNS_PER_SCHEDULE = 1000;
const MAX_CANDIDATES = 50;
// Most runs a request calculates in total, so an account with many frequent schedules can't
// keep the server busy for long. Schedules that get cut off are reported.
const MAX_TOTAL_RUNS = 100_000;

// A full date-time with an offset ("2026-10-01T09:00:00Z"); a time without one would be ambiguous
const dateTime = z.string().datetime({ offset: true });

const windowFields = {
  from: dateTime.optional(), // Default: now
  to: dateTime.optional(), // Default: 24 hours after "from"
  tz: z.string().min(1).optional(), // Default: UTC
  projectId: z.string().min(1).optional(),
};
const runsQuerySchema = z.object({
  ...windowFields,
  scheduleId: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(MAX_EXECUTIONS_PER_SCHEDULE).optional(),
});
const overlapsQuerySchema = z.object(windowFields);
const checkBodySchema = z.object({
  ...windowFields,
  schedules: z
    .array(
      z.object({
        label: z.string().max(200).optional(),
        cronExpression: z.string().min(1),
        durationMinutes: z.number().int().min(0).optional().default(0),
      })
    )
    .min(1)
    .max(MAX_CANDIDATES),
});

// The half-open range [from, to) to calculate runs in
function resolveRange(input: { from?: string; to?: string }, maxDays: number): { from: Date; to: Date; hours: number } {
  const from = input.from ? new Date(input.from) : new Date();
  const to = input.to ? new Date(input.to) : new Date(from.getTime() + DAY_MS);
  if (to <= from) {
    throw new HttpError(400, '"to" must be after "from"');
  }
  if (to.getTime() - from.getTime() > maxDays * DAY_MS) {
    throw new HttpError(400, `The range can be at most ${maxDays} days`);
  }
  return { from, to, hours: (to.getTime() - from.getTime()) / HOUR_MS };
}

function resolveTimeZone(timeZone: string | undefined): string {
  const resolved = timeZone ?? 'UTC';
  if (!isValidTimeZone(resolved)) {
    throw new HttpError(400, `Unknown time zone "${resolved}"`);
  }
  return resolved;
}

// The runs to calculate per schedule: what was asked for, or less when there are many schedules
export function runsPerSchedule(requested: number, scheduleCount: number): number {
  return Math.max(1, Math.min(requested, Math.floor(MAX_TOTAL_RUNS / Math.max(scheduleCount, 1))));
}

function toCronSchedules(schedules: ApiSchedule[]): Schedule[] {
  return schedules.map(({ id, label, cronExpression, color, durationMinutes }) => ({
    id,
    label,
    cronExpression,
    color,
    durationMinutes,
  }));
}

export function registerTimelineRoutes(router: Router): void {
  router.get('/runs', (req: AuthRequest, res: Response) => {
    const query = parse(runsQuerySchema, req.query);
    const range = resolveRange(query, MAX_RUNS_WINDOW_DAYS);
    const timeZone = resolveTimeZone(query.tz);
    const schedules = listSchedules(req.user!.id, {
      projectId: projectFilter(req, query.projectId),
      scheduleId: query.scheduleId,
    });
    if (query.scheduleId && schedules.length === 0) {
      throw new HttpError(404, 'Schedule not found');
    }

    const { executions, truncatedScheduleIds } = generateExecutionsWithLimit(
      toCronSchedules(schedules),
      range.from,
      range.hours,
      runsPerSchedule(query.limit ?? DEFAULT_RUNS_PER_SCHEDULE, schedules.length),
      timeZone
    );

    res.json({
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      timezone: timeZone,
      runs: executions.map((execution) => ({
        scheduleId: execution.scheduleId,
        label: execution.label,
        start: execution.timestamp.toISOString(),
        end: execution.endTimestamp.toISOString(),
      })),
      truncatedScheduleIds,
    });
  });

  router.get('/overlaps', (req: AuthRequest, res: Response) => {
    const query = parse(overlapsQuerySchema, req.query);
    const range = resolveRange(query, MAX_OVERLAPS_WINDOW_DAYS);
    const timeZone = resolveTimeZone(query.tz);
    const schedules = listSchedules(req.user!.id, { projectId: projectFilter(req, query.projectId) });

    const { executions, truncatedScheduleIds } = generateExecutionsWithLimit(
      toCronSchedules(schedules),
      range.from,
      range.hours,
      runsPerSchedule(MAX_EXECUTIONS_PER_SCHEDULE, schedules.length),
      timeZone
    );

    res.json({
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      timezone: timeZone,
      overlaps: detectOverlaps(executions).map((overlap) => ({
        start: overlap.startTimestamp.toISOString(),
        end: overlap.endTimestamp.toISOString(),
        scheduleIds: overlap.scheduleIds,
        count: overlap.count,
      })),
      truncatedScheduleIds,
    });
  });

  // Would these schedules overlap with the stored ones? Nothing is saved.
  router.post('/overlaps/check', (req: AuthRequest, res: Response) => {
    const body = parse(checkBodySchema, req.body);
    const range = resolveRange(body, MAX_OVERLAPS_WINDOW_DAYS);
    const timeZone = resolveTimeZone(body.tz);
    body.schedules.forEach((candidate, index) => {
      if (!validateCronExpression(candidate.cronExpression)) {
        throw new HttpError(400, `Invalid cron expression in schedules[${index}]`);
      }
    });

    // The candidates take part in the calculation as schedules of their own. Their ids can't
    // clash with stored ones (clients choose those), and are turned back into indexes below.
    const prefix = `${randomUUID()}:`;
    const candidates: Schedule[] = body.schedules.map((candidate, index) => ({
      id: `${prefix}${index}`,
      label: candidate.label ?? `schedules[${index}]`,
      cronExpression: candidate.cronExpression,
      color: '#000000',
      durationMinutes: candidate.durationMinutes,
    }));
    const stored = listSchedules(req.user!.id, { projectId: projectFilter(req, body.projectId) });

    const { executions, truncatedScheduleIds } = generateExecutionsWithLimit(
      [...toCronSchedules(stored), ...candidates],
      range.from,
      range.hours,
      runsPerSchedule(MAX_EXECUTIONS_PER_SCHEDULE, stored.length + candidates.length),
      timeZone
    );

    const isCandidate = (id: string): boolean => id.startsWith(prefix);
    const candidateIndexes = (ids: string[]): number[] => ids.filter(isCandidate).map((id) => Number(id.slice(prefix.length)));
    const overlaps = detectOverlaps(executions)
      .filter((overlap) => overlap.scheduleIds.some(isCandidate))
      .map((overlap) => ({
        start: overlap.startTimestamp.toISOString(),
        end: overlap.endTimestamp.toISOString(),
        scheduleIds: overlap.scheduleIds.filter((id) => !isCandidate(id)),
        candidates: candidateIndexes(overlap.scheduleIds),
        count: overlap.count,
      }));

    res.json({
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      timezone: timeZone,
      hasOverlap: overlaps.length > 0,
      overlaps,
      truncatedScheduleIds: truncatedScheduleIds.filter((id) => !isCandidate(id)),
      truncatedCandidates: candidateIndexes(truncatedScheduleIds),
    });
  });
}
