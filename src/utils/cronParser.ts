// src/utils/cronParser.ts

import { parseExpression } from 'cron-parser';
import type { ScheduleExecution, OverlapExecution, Schedule } from '../types';

export function validateCronExpression(expression: string): boolean {
  try {
    parseExpression(expression);
    return true;
  } catch {
    return false;
  }
}

export function generateExecutions(
  schedules: Schedule[],
  startDate: Date,
  hours: number
): ScheduleExecution[] {
  const endDate = new Date(startDate.getTime() + hours * 60 * 60 * 1000);
  const executions: ScheduleExecution[] = [];

  for (const schedule of schedules) {
    try {
      const interval = parseExpression(schedule.cronExpression, {
        currentDate: startDate,
        endDate,
        iterator: true,
      });

      const durationMs = (schedule.durationMinutes || 0) * 60 * 1000;

      while (true) {
        try {
          const next = interval.next();
          const timestamp = next.value.toDate();

          if (timestamp > endDate) break;

          executions.push({
            scheduleId: schedule.id,
            timestamp,
            endTimestamp: new Date(timestamp.getTime() + durationMs),
            label: schedule.label,
            color: schedule.color,
          });
        } catch {
          break;
        }
      }
    } catch (error) {
      console.error(`Failed to parse cron expression for ${schedule.label}:`, error);
    }
  }

  return executions.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
}

interface SweepEvent {
  time: number;
  type: 'start' | 'end';
  scheduleId: string;
  executionIndex: number;
}

export function detectOverlaps(executions: ScheduleExecution[]): OverlapExecution[] {
  if (executions.length === 0) return [];

  // Build sweep-line events
  const events: SweepEvent[] = [];
  for (let i = 0; i < executions.length; i++) {
    const exec = executions[i];
    const startTime = exec.timestamp.getTime();
    const endTime = exec.endTimestamp.getTime();

    events.push({ time: startTime, type: 'start', scheduleId: exec.scheduleId, executionIndex: i });

    // For point-in-time events (duration 0), we still add an end event at the same time
    // but process starts before ends at the same timestamp
    events.push({ time: endTime, type: 'end', scheduleId: exec.scheduleId, executionIndex: i });
  }

  // Sort: by time, then starts before ends at same time
  events.sort((a, b) => {
    if (a.time !== b.time) return a.time - b.time;
    // starts before ends
    if (a.type === 'start' && b.type === 'end') return -1;
    if (a.type === 'end' && b.type === 'start') return 1;
    return 0;
  });

  const overlaps: OverlapExecution[] = [];
  const active = new Map<number, string>(); // executionIndex -> scheduleId
  let overlapStart: number | null = null;
  let overlapIds: Set<string> = new Set();

  // Process events in batches grouped by (time, type) to handle simultaneous events
  let i = 0;
  while (i < events.length) {
    const prevDistinctCount = new Set(active.values()).size;

    // Apply all events at the same (time, type)
    const batchTime = events[i].time;
    const batchType = events[i].type;
    while (i < events.length && events[i].time === batchTime && events[i].type === batchType) {
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
