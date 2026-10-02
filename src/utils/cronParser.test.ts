import { describe, it, expect } from 'vitest';
import {
  validateCronExpression,
  generateExecutions,
  generateExecutionsWithLimit,
  detectOverlaps,
  isValidTimeZone,
  MAX_EXECUTIONS_PER_SCHEDULE,
} from './cronParser';
import type { Schedule, ScheduleExecution } from '../types';

describe('cronParser', () => {
  describe('validateCronExpression', () => {
    it('should validate correct cron expressions', () => {
      expect(validateCronExpression('0 * * * *')).toBe(true);
      expect(validateCronExpression('*/15 * * * *')).toBe(true);
      expect(validateCronExpression('0 2 * * *')).toBe(true);
      expect(validateCronExpression('0 0 * * 0')).toBe(true);
      expect(validateCronExpression('30 3 15 * *')).toBe(true);
    });

    it('should reject invalid cron expressions', () => {
      expect(validateCronExpression('invalid')).toBe(false);
      expect(validateCronExpression('60 * * * *')).toBe(false);
      expect(validateCronExpression('0 25 * * *')).toBe(false);
    });

    it('should handle special characters', () => {
      expect(validateCronExpression('*/5 * * * *')).toBe(true);
      expect(validateCronExpression('0-30 * * * *')).toBe(true);
      expect(validateCronExpression('0,15,30,45 * * * *')).toBe(true);
      expect(validateCronExpression('0 0 * * THU')).toBe(true);
    });

    it('should accept predefined aliases', () => {
      expect(validateCronExpression('@daily')).toBe(true);
      expect(validateCronExpression('@hourly')).toBe(true);
    });

    it('should reject expressions that are not 5 fields', () => {
      expect(validateCronExpression('* * * * * *')).toBe(false); // every second
      expect(validateCronExpression('0 0 * * * *')).toBe(false);
      expect(validateCronExpression('* * *')).toBe(false);
    });

    it('should reject sub-minute aliases and hashed values', () => {
      expect(validateCronExpression('@secondly')).toBe(false);
      expect(validateCronExpression('H * * * *')).toBe(false);
      expect(validateCronExpression('0 H(0-5) * * *')).toBe(false);
    });
  });

  describe('generateExecutions', () => {
    const mockSchedules: Schedule[] = [
      {
        id: 'schedule-1',
        label: 'Hourly Task',
        cronExpression: '0 * * * *',
        color: '#3B82F6',
        durationMinutes: 0,
      },
      {
        id: 'schedule-2',
        label: 'Every 2 Hours',
        cronExpression: '0 */2 * * *',
        color: '#EF4444',
        durationMinutes: 0,
      },
    ];

    it('should generate executions for 24 hours', () => {
      const startDate = new Date('2024-01-01T00:00:00Z');
      const executions = generateExecutions(mockSchedules, startDate, 24);

      // Hourly task: 24 executions
      const hourlyExecutions = executions.filter((e) => e.scheduleId === 'schedule-1');
      expect(hourlyExecutions).toHaveLength(24);

      // Every 2 hours: 12 executions
      const twoHourlyExecutions = executions.filter((e) => e.scheduleId === 'schedule-2');
      expect(twoHourlyExecutions).toHaveLength(12);
    });

    it('should generate executions in chronological order', () => {
      const startDate = new Date('2024-01-01T00:00:00Z');
      const executions = generateExecutions(mockSchedules, startDate, 24);

      for (let i = 1; i < executions.length; i++) {
        expect(executions[i].timestamp.getTime()).toBeGreaterThanOrEqual(
          executions[i - 1].timestamp.getTime()
        );
      }
    });

    it('should include schedule metadata in executions', () => {
      const startDate = new Date('2024-01-01T00:00:00Z');
      const executions = generateExecutions([mockSchedules[0]], startDate, 1);

      expect(executions[0]).toMatchObject({
        scheduleId: 'schedule-1',
        label: 'Hourly Task',
        color: '#3B82F6',
      });
      expect(executions[0].timestamp).toBeInstanceOf(Date);
      expect(executions[0].endTimestamp).toBeInstanceOf(Date);
    });

    it('should set endTimestamp equal to timestamp when durationMinutes is 0', () => {
      const startDate = new Date('2024-01-01T00:00:00Z');
      const executions = generateExecutions([mockSchedules[0]], startDate, 1);

      expect(executions[0].endTimestamp.getTime()).toBe(executions[0].timestamp.getTime());
    });

    it('should compute endTimestamp based on durationMinutes', () => {
      const durationSchedule: Schedule = {
        id: 'duration-1',
        label: 'With Duration',
        cronExpression: '0 * * * *',
        color: '#10B981',
        durationMinutes: 30,
      };

      const startDate = new Date('2024-01-01T00:00:00Z');
      const executions = generateExecutions([durationSchedule], startDate, 2);

      for (const exec of executions) {
        expect(exec.endTimestamp.getTime() - exec.timestamp.getTime()).toBe(30 * 60 * 1000);
      }
    });

    it('should handle schedules with no executions in range', () => {
      const startDate = new Date('2024-01-01T00:00:00Z');
      const weeklySchedule: Schedule = {
        id: 'weekly',
        label: 'Weekly',
        cronExpression: '0 0 * * 0', // Sunday midnight
        color: '#10B981',
        durationMinutes: 0,
      };

      const executions = generateExecutions([weeklySchedule], startDate, 1);
      expect(Array.isArray(executions)).toBe(true);
    });

    it('should handle invalid cron expressions gracefully', () => {
      const invalidSchedule: Schedule = {
        id: 'invalid',
        label: 'Invalid',
        cronExpression: 'invalid cron',
        color: '#000000',
        durationMinutes: 0,
      };

      const startDate = new Date('2024-01-01T00:00:00Z');
      const executions = generateExecutions([invalidSchedule], startDate, 24);

      expect(executions).toHaveLength(0);
    });

    it('should not include executions beyond end date', () => {
      const startDate = new Date('2024-01-01T00:00:00Z');
      const endDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000);
      const executions = generateExecutions(mockSchedules, startDate, 24);

      executions.forEach((execution) => {
        expect(execution.timestamp.getTime()).toBeLessThanOrEqual(endDate.getTime());
      });
    });

    it('should include a run exactly at the start and exclude one exactly at the end', () => {
      const daily: Schedule = { id: 'd', label: 'Daily', cronExpression: '0 2 * * *', color: '#000', durationMinutes: 0 };
      const startDate = new Date(2026, 9, 1, 2, 0); // local 02:00
      const executions = generateExecutions([daily], startDate, 48);

      expect(executions.map((e) => e.timestamp)).toEqual([
        new Date(2026, 9, 1, 2, 0),
        new Date(2026, 9, 2, 2, 0),
      ]);
    });

    it('should cap executions per schedule and report the truncated schedules', () => {
      const frequent: Schedule = { id: 'f', label: 'Frequent', cronExpression: '* * * * *', color: '#000', durationMinutes: 0 };
      const hourly: Schedule = { id: 'h', label: 'Hourly', cronExpression: '0 * * * *', color: '#000', durationMinutes: 0 };

      const result = generateExecutionsWithLimit([frequent, hourly], new Date('2024-01-01T00:00:00Z'), 24, 100);

      expect(result.executions.filter((e) => e.scheduleId === 'f')).toHaveLength(100);
      expect(result.executions.filter((e) => e.scheduleId === 'h')).toHaveLength(24);
      expect(result.truncatedScheduleIds).toEqual(['f']);
    });

    it('should generate a capped minute-level schedule quickly', () => {
      const everyMinute: Schedule = { id: 'm', label: 'Every minute', cronExpression: '* * * * *', color: '#000', durationMinutes: 0 };
      const started = performance.now();

      const result = generateExecutionsWithLimit([everyMinute], new Date('2024-01-01T00:00:00Z'), 30 * 24);

      expect(result.executions).toHaveLength(MAX_EXECUTIONS_PER_SCHEDULE);
      // cron-parser 4.x needed ~1 ms per minute-level run (over 10 s here)
      expect(performance.now() - started).toBeLessThan(5000);
    });

    it('should handle multiple schedules with different frequencies', () => {
      const complexSchedules: Schedule[] = [
        { id: '1', label: 'Every 15 min', cronExpression: '*/15 * * * *', color: '#111', durationMinutes: 0 },
        { id: '2', label: 'Every hour', cronExpression: '0 * * * *', color: '#222', durationMinutes: 0 },
        { id: '3', label: 'Twice daily', cronExpression: '0 0,12 * * *', color: '#333', durationMinutes: 0 },
      ];

      const startDate = new Date('2024-01-01T00:00:00Z');
      const executions = generateExecutions(complexSchedules, startDate, 24);

      const every15 = executions.filter((e) => e.scheduleId === '1');
      const hourly = executions.filter((e) => e.scheduleId === '2');
      const twiceDaily = executions.filter((e) => e.scheduleId === '3');

      expect(every15.length).toBe(96); // 4 per hour * 24 hours
      expect(hourly.length).toBe(24);
      expect(twiceDaily.length).toBe(2);
    });
  });

  describe('time zones', () => {
    const daily: Schedule = { id: 'd', label: 'Daily at nine', cronExpression: '0 9 * * *', color: '#000', durationMinutes: 0 };
    const firstRun = (start: string, timeZone?: string) =>
      generateExecutionsWithLimit([daily], new Date(start), 24, 100, timeZone).executions[0].timestamp.toISOString();

    it('should read expressions in the given time zone', () => {
      expect(firstRun('2026-01-15T00:00:00Z', 'UTC')).toBe('2026-01-15T09:00:00.000Z');
      expect(firstRun('2026-01-15T00:00:00Z', 'Europe/Stockholm')).toBe('2026-01-15T08:00:00.000Z'); // UTC+1
      expect(firstRun('2026-07-15T00:00:00Z', 'Europe/Stockholm')).toBe('2026-07-15T07:00:00.000Z'); // UTC+2
      expect(firstRun('2026-01-15T00:00:00Z', 'America/New_York')).toBe('2026-01-15T14:00:00.000Z'); // UTC-5
    });

    it('should recognise valid time zones', () => {
      expect(isValidTimeZone('UTC')).toBe(true);
      expect(isValidTimeZone('Europe/Stockholm')).toBe(true);
      expect(isValidTimeZone('+02:00')).toBe(true);
      expect(isValidTimeZone('Mars/Phobos')).toBe(false);
      expect(isValidTimeZone('')).toBe(false);
    });
  });

  describe('detectOverlaps', () => {
    it('should detect executions at the same time (point-in-time)', () => {
      const executions: ScheduleExecution[] = [
        {
          scheduleId: 'schedule-1',
          timestamp: new Date('2024-01-01T10:00:00Z'),
          endTimestamp: new Date('2024-01-01T10:00:00Z'),
          label: 'Task 1',
          color: '#111',
        },
        {
          scheduleId: 'schedule-2',
          timestamp: new Date('2024-01-01T10:00:00Z'),
          endTimestamp: new Date('2024-01-01T10:00:00Z'),
          label: 'Task 2',
          color: '#222',
        },
      ];

      const overlaps = detectOverlaps(executions);

      expect(overlaps).toHaveLength(1);
      expect(overlaps[0].startTimestamp).toEqual(new Date('2024-01-01T10:00:00Z'));
      expect(overlaps[0].scheduleIds).toContain('schedule-1');
      expect(overlaps[0].scheduleIds).toContain('schedule-2');
      expect(overlaps[0].count).toBe(2);
    });

    it('should detect overlapping duration ranges', () => {
      const executions: ScheduleExecution[] = [
        {
          scheduleId: 'schedule-1',
          timestamp: new Date('2024-01-01T10:00:00Z'),
          endTimestamp: new Date('2024-01-01T11:00:00Z'),
          label: 'Task 1',
          color: '#111',
        },
        {
          scheduleId: 'schedule-2',
          timestamp: new Date('2024-01-01T10:30:00Z'),
          endTimestamp: new Date('2024-01-01T11:30:00Z'),
          label: 'Task 2',
          color: '#222',
        },
      ];

      const overlaps = detectOverlaps(executions);

      expect(overlaps.length).toBeGreaterThanOrEqual(1);
      // Overlap should be from 10:30 to 11:00
      expect(overlaps[0].startTimestamp).toEqual(new Date('2024-01-01T10:30:00Z'));
      expect(overlaps[0].endTimestamp).toEqual(new Date('2024-01-01T11:00:00Z'));
    });

    it('should not detect overlap for adjacent (non-overlapping) ranges', () => {
      const executions: ScheduleExecution[] = [
        {
          scheduleId: 'schedule-1',
          timestamp: new Date('2024-01-01T10:00:00Z'),
          endTimestamp: new Date('2024-01-01T11:00:00Z'),
          label: 'Task 1',
          color: '#111',
        },
        {
          scheduleId: 'schedule-2',
          timestamp: new Date('2024-01-01T11:00:00Z'),
          endTimestamp: new Date('2024-01-01T12:00:00Z'),
          label: 'Task 2',
          color: '#222',
        },
      ];

      const overlaps = detectOverlaps(executions);
      // A run ending exactly when the next one starts is back-to-back, not overlapping
      expect(overlaps).toHaveLength(0);
    });

    it('should not detect overlap for a point-in-time run when another run ends', () => {
      const executions: ScheduleExecution[] = [
        {
          scheduleId: 'schedule-1',
          timestamp: new Date('2024-01-01T10:00:00Z'),
          endTimestamp: new Date('2024-01-01T11:00:00Z'),
          label: 'Task 1',
          color: '#111',
        },
        {
          scheduleId: 'schedule-2',
          timestamp: new Date('2024-01-01T11:00:00Z'),
          endTimestamp: new Date('2024-01-01T11:00:00Z'),
          label: 'Task 2',
          color: '#222',
        },
      ];

      expect(detectOverlaps(executions)).toHaveLength(0);
    });

    it('should detect a point-in-time run at the start of another run', () => {
      const executions: ScheduleExecution[] = [
        {
          scheduleId: 'schedule-1',
          timestamp: new Date('2024-01-01T10:00:00Z'),
          endTimestamp: new Date('2024-01-01T10:00:00Z'),
          label: 'Task 1',
          color: '#111',
        },
        {
          scheduleId: 'schedule-2',
          timestamp: new Date('2024-01-01T10:00:00Z'),
          endTimestamp: new Date('2024-01-01T11:00:00Z'),
          label: 'Task 2',
          color: '#222',
        },
      ];

      const overlaps = detectOverlaps(executions);
      expect(overlaps).toHaveLength(1);
      expect(overlaps[0].count).toBe(2);
    });

    it('should detect full containment', () => {
      const executions: ScheduleExecution[] = [
        {
          scheduleId: 'schedule-1',
          timestamp: new Date('2024-01-01T10:00:00Z'),
          endTimestamp: new Date('2024-01-01T12:00:00Z'),
          label: 'Long Task',
          color: '#111',
        },
        {
          scheduleId: 'schedule-2',
          timestamp: new Date('2024-01-01T10:30:00Z'),
          endTimestamp: new Date('2024-01-01T11:00:00Z'),
          label: 'Short Task',
          color: '#222',
        },
      ];

      const overlaps = detectOverlaps(executions);

      expect(overlaps.length).toBeGreaterThanOrEqual(1);
      expect(overlaps[0].startTimestamp).toEqual(new Date('2024-01-01T10:30:00Z'));
      expect(overlaps[0].endTimestamp).toEqual(new Date('2024-01-01T11:00:00Z'));
    });

    it('should detect multiple overlaps', () => {
      const executions: ScheduleExecution[] = [
        {
          scheduleId: 'schedule-1',
          timestamp: new Date('2024-01-01T10:00:00Z'),
          endTimestamp: new Date('2024-01-01T10:00:00Z'),
          label: 'Task 1',
          color: '#111',
        },
        {
          scheduleId: 'schedule-2',
          timestamp: new Date('2024-01-01T10:00:00Z'),
          endTimestamp: new Date('2024-01-01T10:00:00Z'),
          label: 'Task 2',
          color: '#222',
        },
        {
          scheduleId: 'schedule-1',
          timestamp: new Date('2024-01-01T11:00:00Z'),
          endTimestamp: new Date('2024-01-01T11:00:00Z'),
          label: 'Task 1',
          color: '#111',
        },
        {
          scheduleId: 'schedule-2',
          timestamp: new Date('2024-01-01T11:00:00Z'),
          endTimestamp: new Date('2024-01-01T11:00:00Z'),
          label: 'Task 2',
          color: '#222',
        },
      ];

      const overlaps = detectOverlaps(executions);
      expect(overlaps).toHaveLength(2);
    });

    it('should detect overlaps with more than 2 schedules', () => {
      const timestamp = new Date('2024-01-01T12:00:00Z');
      const executions: ScheduleExecution[] = [
        { scheduleId: 's1', timestamp, endTimestamp: timestamp, label: 'Task 1', color: '#111' },
        { scheduleId: 's2', timestamp, endTimestamp: timestamp, label: 'Task 2', color: '#222' },
        { scheduleId: 's3', timestamp, endTimestamp: timestamp, label: 'Task 3', color: '#333' },
      ];

      const overlaps = detectOverlaps(executions);

      expect(overlaps).toHaveLength(1);
      expect(overlaps[0].count).toBe(3);
      expect(overlaps[0].scheduleIds).toContain('s1');
      expect(overlaps[0].scheduleIds).toContain('s2');
      expect(overlaps[0].scheduleIds).toContain('s3');
    });

    it('should return empty array when no overlaps exist', () => {
      const executions: ScheduleExecution[] = [
        {
          scheduleId: 'schedule-1',
          timestamp: new Date('2024-01-01T10:00:00Z'),
          endTimestamp: new Date('2024-01-01T10:00:00Z'),
          label: 'Task 1',
          color: '#111',
        },
        {
          scheduleId: 'schedule-2',
          timestamp: new Date('2024-01-01T11:00:00Z'),
          endTimestamp: new Date('2024-01-01T11:00:00Z'),
          label: 'Task 2',
          color: '#222',
        },
      ];

      const overlaps = detectOverlaps(executions);
      expect(overlaps).toHaveLength(0);
    });

    it('should handle empty executions array', () => {
      const overlaps = detectOverlaps([]);
      expect(overlaps).toHaveLength(0);
    });

    it('should handle single execution', () => {
      const executions: ScheduleExecution[] = [
        {
          scheduleId: 'schedule-1',
          timestamp: new Date('2024-01-01T10:00:00Z'),
          endTimestamp: new Date('2024-01-01T10:00:00Z'),
          label: 'Task 1',
          color: '#111',
        },
      ];

      const overlaps = detectOverlaps(executions);
      expect(overlaps).toHaveLength(0);
    });
  });
});
