// src/utils/cronParser.ts

import { CronExpressionParser, type CronExpression } from 'cron-parser';
import type { ScheduleExecution, OverlapExecution, Schedule } from '../types';

// Upper bound per schedule so a very frequent schedule can't freeze the page
export const MAX_EXECUTIONS_PER_SCHEDULE = 10000;

// Hashed values (H) are a Jenkins extension; they'd render at an arbitrary minute
const HASHED_VALUE = /(^|[\s,])H(?=$|[\s,(/])/;

export function validateCronExpression(expression: string): boolean {
  const trimmed = expression.trim();
  // Standard 5-field expressions or predefined aliases like @daily (no seconds field)
  if (!trimmed.startsWith('@') && trimmed.split(/\s+/).length !== 5) return false;
  if (HASHED_VALUE.test(trimmed)) return false;
  try {
    const { fields } = CronExpressionParser.parse(trimmed);
    // Reject sub-minute aliases such as @secondly
    return fields.second.values.length === 1 && fields.second.values[0] === 0;
  } catch {
    return false;
  }
}

// Whether cron-parser understands the time zone (an IANA name such as "Europe/Stockholm" or a
// fixed offset). With an unknown one every run would silently be missing, so check it up front.
export function isValidTimeZone(timeZone: string): boolean {
  if (!timeZone) return false;
  try {
    CronExpressionParser.parse('* * * * *', { tz: timeZone }).next();
    return true;
  } catch {
    return false;
  }
}

// The next run, or null once the iteration passes its endDate
function nextRun(interval: CronExpression): Date | null {
  try {
    return interval.next().toDate();
  } catch {
    return null;
  }
}

export interface GeneratedExecutions {
  executions: ScheduleExecution[];
  // Schedules that hit MAX_EXECUTIONS_PER_SCHEDULE and were cut off
  truncatedScheduleIds: string[];
}

// Executions in the half-open range [startDate, startDate + hours). Expressions are read in
// the given time zone (see isValidTimeZone), or the runtime's own when there is none.
export function generateExecutionsWithLimit(
  schedules: Schedule[],
  startDate: Date,
  hours: number,
  limit: number = MAX_EXECUTIONS_PER_SCHEDULE,
  timeZone?: string
): GeneratedExecutions {
  const endDate = new Date(startDate.getTime() + hours * 60 * 60 * 1000);
  const executions: ScheduleExecution[] = [];
  const truncatedScheduleIds: string[] = [];

  for (const schedule of schedules) {
    try {
      const interval = CronExpressionParser.parse(schedule.cronExpression, {
        // next() is strictly after currentDate; start 1 ms early so a run exactly at startDate counts
        currentDate: new Date(startDate.getTime() - 1),
        endDate,
        hashSeed: schedule.id,
        ...(timeZone ? { tz: timeZone } : {}),
      });

      const durationMs = (schedule.durationMinutes || 0) * 60 * 1000;
      let count = 0;

      for (let timestamp = nextRun(interval); timestamp && timestamp < endDate; timestamp = nextRun(interval)) {
        if (count === limit) {
          truncatedScheduleIds.push(schedule.id);
          break;
        }

        executions.push({
          scheduleId: schedule.id,
          timestamp,
          endTimestamp: new Date(timestamp.getTime() + durationMs),
          label: schedule.label,
          color: schedule.color,
        });
        count++;
      }
    } catch (error) {
      console.error(`Failed to parse cron expression for ${schedule.label}:`, error);
    }
  }

  executions.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  return { executions, truncatedScheduleIds };
}

export function generateExecutions(
  schedules: Schedule[],
  startDate: Date,
  hours: number
): ScheduleExecution[] {
  return generateExecutionsWithLimit(schedules, startDate, hours).executions;
}

interface SweepEvent {
  time: number;
  type: 'start' | 'end';
  instant: boolean; // Zero-duration (point-in-time) execution
  scheduleId: string;
  executionIndex: number;
}

// Order of events at the same timestamp: runs ending there finish first (so back-to-back
// runs don't overlap), then everything starting there, then the end of point-in-time runs
// (so simultaneous point-in-time runs still overlap each other)
function eventRank(event: SweepEvent): number {
  if (event.type === 'start') return 1;
  return event.instant ? 2 : 0;
}

export function detectOverlaps(executions: ScheduleExecution[]): OverlapExecution[] {
  if (executions.length === 0) return [];

  // Build sweep-line events
  const events: SweepEvent[] = [];
  for (let i = 0; i < executions.length; i++) {
    const exec = executions[i];
    const startTime = exec.timestamp.getTime();
    const endTime = exec.endTimestamp.getTime();
    const instant = endTime === startTime;

    events.push({ time: startTime, type: 'start', instant, scheduleId: exec.scheduleId, executionIndex: i });
    events.push({ time: endTime, type: 'end', instant, scheduleId: exec.scheduleId, executionIndex: i });
  }

  // Sort: by time, then by rank at the same time
  events.sort((a, b) => {
    if (a.time !== b.time) return a.time - b.time;
    return eventRank(a) - eventRank(b);
  });

  const overlaps: OverlapExecution[] = [];
  const active = new Map<number, string>(); // executionIndex -> scheduleId
  let overlapStart: number | null = null;
  let overlapIds: Set<string> = new Set();

  // Process events in batches grouped by (time, rank) to handle simultaneous events
  let i = 0;
  while (i < events.length) {
    const prevDistinctCount = new Set(active.values()).size;

    // Apply all events at the same (time, rank)
    const batchTime = events[i].time;
    const batchRank = eventRank(events[i]);
    while (i < events.length && events[i].time === batchTime && eventRank(events[i]) === batchRank) {
      if (events[i].type === 'start') {
        active.set(events[i].executionIndex, events[i].scheduleId);
      } else {
        active.delete(events[i].executionIndex);
      }
      i++;
    }

    const currentDistinctCount = new Set(active.values()).size;
    const currentActiveIds = new Set(active.values());

    // Transitioning into overlap (>= 2 distinct schedules)
    if (prevDistinctCount < 2 && currentDistinctCount >= 2) {
      overlapStart = batchTime;
      overlapIds = new Set(currentActiveIds);
    }
    // Still in overlap but membership changed
    else if (prevDistinctCount >= 2 && currentDistinctCount >= 2) {
      if (!setsEqual(overlapIds, currentActiveIds)) {
        if (overlapStart !== null) {
          overlaps.push({
            startTimestamp: new Date(overlapStart),
            endTimestamp: new Date(batchTime),
            scheduleIds: Array.from(overlapIds),
            count: overlapIds.size,
          });
        }
        overlapStart = batchTime;
        overlapIds = new Set(currentActiveIds);
      }
    }
    // Transitioning out of overlap
    else if (prevDistinctCount >= 2 && currentDistinctCount < 2) {
      if (overlapStart !== null) {
        overlaps.push({
          startTimestamp: new Date(overlapStart),
          endTimestamp: new Date(batchTime),
          scheduleIds: Array.from(overlapIds),
          count: overlapIds.size,
        });
        overlapStart = null;
        overlapIds = new Set();
      }
    }
  }

  return overlaps;
}

function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const item of a) {
    if (!b.has(item)) return false;
  }
  return true;
}
