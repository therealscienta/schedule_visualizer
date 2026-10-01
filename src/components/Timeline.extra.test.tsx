import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Timeline } from './Timeline';
import { SettingsProvider } from '../contexts/SettingsContext';
import { exportToJSON } from '../utils/exportTimeline';
import type { Schedule } from '../types';

// A tiny per-schedule limit so truncation shows up without rendering thousands of markers
vi.mock('../utils/cronParser', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils/cronParser')>();
  return {
    ...actual,
    generateExecutionsWithLimit: (schedules: Schedule[], startDate: Date, hours: number) =>
      actual.generateExecutionsWithLimit(schedules, startDate, hours, 5),
  };
});

vi.mock('../utils/exportTimeline', () => ({
  exportToPNG: vi.fn(),
  exportToSVG: vi.fn(),
  exportToJSON: vi.fn(),
}));

const hourly: Schedule = { id: 'h', label: 'Hourly', cronExpression: '0 * * * *', color: '#000', durationMinutes: 0 };
const daily: Schedule = { id: 'd', label: 'Daily', cronExpression: '0 2 * * *', color: '#111', durationMinutes: 0, ownerId: 'u1' };

const renderTimeline = (ui: React.ReactElement) => render(<SettingsProvider>{ui}</SettingsProvider>);

describe('Timeline (zoom, limits, export)', () => {
  it('zooms by widening the content instead of stretching it', async () => {
    const user = userEvent.setup();
    const { container } = renderTimeline(<Timeline schedules={[daily]} timeRange="24h" />);

    await user.click(screen.getByTitle('Zoom in'));

    const zoomed = container.querySelector<HTMLElement>('[style*="width: 125%"]');
    expect(zoomed).not.toBeNull();
    expect(zoomed!.parentElement).toHaveClass('overflow-x-auto');
    expect(container.querySelector('[style*="scaleX"]')).toBeNull();
  });

  it('flags schedules that hit the execution limit', () => {
    const oneDay = { startDate: new Date(2026, 5, 1, 0, 0), endDate: new Date(2026, 5, 2, 0, 0) };
    renderTimeline(<Timeline schedules={[hourly, daily]} timeRange="custom" customDateRange={oneDay} />);

    expect(screen.getByText(/only their first/i)).toBeInTheDocument();
    expect(screen.getByText('(5+ executions, truncated)')).toBeInTheDocument();
    expect(screen.getByText('(1 executions)')).toBeInTheDocument();
  });

  it('exports every schedule as JSON, not just the filtered ones', async () => {
    const user = userEvent.setup();
    renderTimeline(
      <Timeline
        schedules={[hourly]}
        allSchedules={[hourly, daily]}
        projects={[{ id: 'p1', name: 'Shared', color: '#222', role: 'view' }]}
        timeRange="24h"
      />
    );

    await user.click(screen.getByRole('button', { name: /export/i }));
    await user.click(screen.getByRole('button', { name: /export schedules \(json\)/i }));

    expect(exportToJSON).toHaveBeenCalledWith(
      {
        schedules: [
          { id: 'h', label: 'Hourly', cronExpression: '0 * * * *', color: '#000', durationMinutes: 0, projectId: undefined },
          { id: 'd', label: 'Daily', cronExpression: '0 2 * * *', color: '#111', durationMinutes: 0, projectId: undefined },
        ],
        projects: [{ id: 'p1', name: 'Shared', color: '#222' }],
      },
      expect.any(String)
    );
  });
});
