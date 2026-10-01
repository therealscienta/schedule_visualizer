import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatisticsPanel } from './StatisticsPanel';
import { SettingsProvider } from '../contexts/SettingsContext';
import type { ScheduleExecution } from '../types';

const execution = (timestamp: Date): ScheduleExecution => ({
  scheduleId: 'a',
  timestamp,
  endTimestamp: timestamp,
  label: 'Job',
  color: '#000',
});

describe('StatisticsPanel', () => {
  // Days must follow the local calendar; a zone behind UTC exposes UTC-based bucketing
  const originalTz = process.env.TZ;
  beforeAll(() => {
    process.env.TZ = 'America/New_York';
  });
  afterAll(() => {
    if (originalTz === undefined) delete process.env.TZ;
    else process.env.TZ = originalTz;
  });

  it('groups busiest days by local calendar day', () => {
    render(
      <SettingsProvider>
        <StatisticsPanel
          executions={[
            execution(new Date(2026, 9, 1, 10, 0)),
            execution(new Date(2026, 9, 1, 21, 0)), // already Oct 2 in UTC
            execution(new Date(2026, 9, 2, 9, 0)),
          ]}
          overlaps={[]}
          startDate={new Date(2026, 9, 1, 0, 0)}
          endDate={new Date(2026, 9, 3, 0, 0)}
        />
      </SettingsProvider>
    );

    const busiestDays = screen.getByText('Top 5 Busiest Days').parentElement!;
    expect(busiestDays).toHaveTextContent('#1Oct 1, 20262 executions');
    expect(busiestDays).toHaveTextContent('#2Oct 2, 20261 executions');
  });
});
