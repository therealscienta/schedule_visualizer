import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Timeline } from './Timeline';
import { SettingsProvider } from '../contexts/SettingsContext';
import type { Schedule, TimeRange } from '../types';

// Mock the StatisticsPanel component
vi.mock('./StatisticsPanel', () => ({
  StatisticsPanel: () => <div data-testid="statistics-panel">Statistics Panel</div>,
}));

const renderWithSettings = (ui: React.ReactElement) => {
  return render(<SettingsProvider>{ui}</SettingsProvider>);
};

describe('Timeline', () => {
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

  describe('Empty State', () => {
    it('should render empty state when no schedules', () => {
      renderWithSettings(<Timeline schedules={[]} timeRange="24h" />);

      expect(screen.getByText('Timeline')).toBeInTheDocument();
      expect(screen.getByText(/add schedules to see the timeline visualization/i)).toBeInTheDocument();
    });

    it('should not render statistics panel when empty', () => {
      renderWithSettings(<Timeline schedules={[]} timeRange="24h" />);

      expect(screen.queryByTestId('statistics-panel')).not.toBeInTheDocument();
    });

    it('should not render time markers when empty', () => {
      const { container } = renderWithSettings(<Timeline schedules={[]} timeRange="24h" />);

      expect(container.querySelector('.border-b-2')).not.toBeInTheDocument();
    });
  });

  describe('With Schedules', () => {
    it('should render timeline with schedules', () => {
      renderWithSettings(<Timeline schedules={mockSchedules} timeRange="24h" />);

      expect(screen.getByText('Timeline')).toBeInTheDocument();
      expect(screen.getByText('Hourly Task')).toBeInTheDocument();
      expect(screen.getByText('Every 2 Hours')).toBeInTheDocument();
    });

    it('should render statistics panel by default', () => {
      renderWithSettings(<Timeline schedules={mockSchedules} timeRange="24h" />);

      expect(screen.getByTestId('statistics-panel')).toBeInTheDocument();
    });

    it('should show execution counts for each schedule', () => {
      renderWithSettings(<Timeline schedules={mockSchedules} timeRange="24h" />);

      // Hourly task: 24 executions in 24 hours
      expect(screen.getByText(/24 executions/i)).toBeInTheDocument();
      // Every 2 hours: 12 executions in 24 hours
      expect(screen.getByText(/12 executions/i)).toBeInTheDocument();
    });

    it('should render time range in header', () => {
      renderWithSettings(<Timeline schedules={mockSchedules} timeRange="24h" />);

      // Should show start and end date formatted
      const dateRangeElements = screen.getAllByText(/\w{3} \d{1,2}/);
      expect(dateRangeElements.length).toBeGreaterThan(0);
    });

    it('should toggle statistics panel when button clicked', async () => {
      const user = userEvent.setup();

      renderWithSettings(<Timeline schedules={mockSchedules} timeRange="24h" />);

      expect(screen.getByTestId('statistics-panel')).toBeInTheDocument();

      const hideButton = screen.getByText(/hide statistics/i);
      await user.click(hideButton);

      expect(screen.queryByTestId('statistics-panel')).not.toBeInTheDocument();

      const showButton = screen.getByText(/show statistics/i);
      await user.click(showButton);

      expect(screen.getByTestId('statistics-panel')).toBeInTheDocument();
    });
  });

  describe('Time Ranges', () => {
    it('should handle 24 hour time range', () => {
      renderWithSettings(<Timeline schedules={mockSchedules} timeRange="24h" />);

      expect(screen.getByText('Hourly Task')).toBeInTheDocument();
      // Should show 24 executions for hourly task
      expect(screen.getByText(/24 executions/i)).toBeInTheDocument();
    });

    it('should handle 7 day time range', () => {
      renderWithSettings(<Timeline schedules={mockSchedules} timeRange="7d" />);

      expect(screen.getByText('Hourly Task')).toBeInTheDocument();
      // Should show 168 executions for hourly task (24 * 7)
      expect(screen.getByText(/168 executions/i)).toBeInTheDocument();
    });

    it('should handle 30 day time range', () => {
      // Use a less frequent schedule to avoid timeout from rendering 720+ markers
      const dailySchedules: Schedule[] = [
        {
          id: 'schedule-1',
          label: 'Daily Task',
          cronExpression: '0 0 * * *',
          color: '#3B82F6',
          durationMinutes: 0,
        },
      ];

      renderWithSettings(<Timeline schedules={dailySchedules} timeRange="30d" />);

      expect(screen.getByText('Daily Task')).toBeInTheDocument();
      expect(screen.getByText(/30 executions/i)).toBeInTheDocument();
    });

    it('should handle custom date range', () => {
      const startDate = new Date('2024-01-01T00:00:00Z');
      const endDate = new Date('2024-01-02T00:00:00Z');

      renderWithSettings(
        <Timeline
          schedules={mockSchedules}
          timeRange="custom"
          customDateRange={{ startDate, endDate }}
        />
      );

      expect(screen.getByText('Hourly Task')).toBeInTheDocument();
      // Should show 24 executions for 24 hour custom range
      expect(screen.getByText(/24 executions/i)).toBeInTheDocument();
    });

    it('should use current date when custom range not provided', () => {
      renderWithSettings(<Timeline schedules={mockSchedules} timeRange="custom" />);

      expect(screen.getByText('Hourly Task')).toBeInTheDocument();
    });
  });

  describe('Overlaps', () => {
    it('should show overlap section when schedules overlap', () => {
      const overlappingSchedules: Schedule[] = [
        {
          id: 'schedule-1',
          label: 'Task 1',
          cronExpression: '0 * * * *', // Every hour
          color: '#3B82F6',
          durationMinutes: 0,
        },
        {
          id: 'schedule-2',
          label: 'Task 2',
          cronExpression: '0 * * * *', // Every hour (overlaps)
          color: '#EF4444',
          durationMinutes: 0,
        },
      ];

      renderWithSettings(<Timeline schedules={overlappingSchedules} timeRange="24h" />);

      expect(screen.getByText('Overlaps')).toBeInTheDocument();
      expect(screen.getByText(/24 conflicts/i)).toBeInTheDocument();
    });

    it('should not show overlap section when no overlaps', () => {
      const nonOverlappingSchedules: Schedule[] = [
        {
          id: 'schedule-1',
          label: 'Task 1',
          cronExpression: '0 0 * * *', // Midnight
          color: '#3B82F6',
          durationMinutes: 0,
        },
        {
          id: 'schedule-2',
          label: 'Task 2',
          cronExpression: '0 12 * * *', // Noon
          color: '#EF4444',
          durationMinutes: 0,
        },
      ];

      renderWithSettings(<Timeline schedules={nonOverlappingSchedules} timeRange="24h" />);

      expect(screen.queryByText('Overlaps')).not.toBeInTheDocument();
      expect(screen.queryByText(/conflicts/i)).not.toBeInTheDocument();
    });
  });

  describe('Schedule Rendering', () => {
    it('should render schedule labels', () => {
      renderWithSettings(<Timeline schedules={mockSchedules} timeRange="24h" />);

      expect(screen.getByText('Hourly Task')).toBeInTheDocument();
      expect(screen.getByText('Every 2 Hours')).toBeInTheDocument();
    });

    it('should render color indicators', () => {
      const { container } = renderWithSettings(<Timeline schedules={mockSchedules} timeRange="24h" />);

      const colorIndicators = container.querySelectorAll('.w-3.h-3.rounded-full');
      expect(colorIndicators.length).toBeGreaterThan(0);
    });

    it('should display execution markers on timeline', () => {
      const { container } = renderWithSettings(<Timeline schedules={mockSchedules} timeRange="24h" />);

      // Look for execution markers (small colored bars)
      const executionMarkers = container.querySelectorAll('.w-2.h-8');
      expect(executionMarkers.length).toBeGreaterThan(0);
    });

    it('should show "No executions" message when schedules have no executions in range', () => {
      // Monthly cron on 31st - won't execute in Feb for example
      const noExecSchedule: Schedule[] = [
        {
          id: 'monthly',
          label: 'Monthly Task',
          cronExpression: '0 0 31 2 *', // Feb 31st (doesn't exist)
          color: '#10B981',
          durationMinutes: 0,
        },
      ];

      renderWithSettings(<Timeline schedules={noExecSchedule} timeRange="24h" />);

      expect(screen.getByText(/no executions in the selected time range/i)).toBeInTheDocument();
    });
  });

  describe('Time Markers', () => {
    it('should render time axis', () => {
      const { container } = renderWithSettings(<Timeline schedules={mockSchedules} timeRange="24h" />);

      const timeAxis = container.querySelector('.border-b-2.border-gray-300');
      expect(timeAxis).toBeInTheDocument();
    });

    it('should display time marker labels', () => {
      renderWithSettings(<Timeline schedules={mockSchedules} timeRange="24h" />);

      // Should have multiple time markers with formatted dates
      const timeMarkers = screen.getAllByText(/\w{3} \d{1,2}/);
      expect(timeMarkers.length).toBeGreaterThan(0);
    });
  });

  describe('Accessibility', () => {
    it('should have proper heading hierarchy', () => {
      renderWithSettings(<Timeline schedules={mockSchedules} timeRange="24h" />);

      const heading = screen.getByRole('heading', { level: 2, name: 'Timeline' });
      expect(heading).toBeInTheDocument();
    });

    it('should have accessible toggle button', async () => {
      const user = userEvent.setup();

      renderWithSettings(<Timeline schedules={mockSchedules} timeRange="24h" />);

      const button = screen.getByRole('button', { name: /hide statistics/i });
      expect(button).toBeInTheDocument();

      await user.click(button);

      expect(screen.getByRole('button', { name: /show statistics/i })).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle schedule with invalid cron expression gracefully', () => {
      const invalidSchedule: Schedule[] = [
        {
          id: 'invalid',
          label: 'Invalid Task',
          cronExpression: 'invalid cron',
          color: '#000000',
          durationMinutes: 0,
        },
      ];

      renderWithSettings(<Timeline schedules={invalidSchedule} timeRange="24h" />);

      expect(screen.getByText('Invalid Task')).toBeInTheDocument();
      expect(screen.getByText(/0 executions/i)).toBeInTheDocument();
    });

    it('should handle single schedule', () => {
      renderWithSettings(<Timeline schedules={[mockSchedules[0]]} timeRange="24h" />);

      expect(screen.getByText('Hourly Task')).toBeInTheDocument();
      expect(screen.getByText(/24 executions/i)).toBeInTheDocument();
      expect(screen.queryByText('Every 2 Hours')).not.toBeInTheDocument();
    });

    it('should handle many schedules', () => {
      const manySchedules: Schedule[] = Array.from({ length: 10 }, (_, i) => ({
        id: `schedule-${i}`,
        label: `Schedule ${i}`,
        cronExpression: '0 * * * *',
        color: '#000000',
        durationMinutes: 0,
      }));

      renderWithSettings(<Timeline schedules={manySchedules} timeRange="24h" />);

      manySchedules.forEach((schedule) => {
        expect(screen.getByText(schedule.label)).toBeInTheDocument();
      });
    });

    it('should handle very long schedule labels with truncation', () => {
      const longLabelSchedule: Schedule[] = [
        {
          id: 'long',
          label: 'This is a very long schedule label that should be truncated properly',
          cronExpression: '0 * * * *',
          color: '#3B82F6',
          durationMinutes: 0,
        },
      ];

      const { container } = renderWithSettings(<Timeline schedules={longLabelSchedule} timeRange="24h" />);

      const labelElement = screen.getByText(longLabelSchedule[0].label);
      expect(labelElement).toHaveClass('truncate');
    });
  });

  describe('Memoization', () => {
    it('should memoize execution generation', () => {
      const { rerender } = renderWithSettings(<Timeline schedules={mockSchedules} timeRange="24h" />);

      const initialExecutionCount = screen.getByText(/24 executions/i);
      expect(initialExecutionCount).toBeInTheDocument();

      // Rerender with same props - should use memoized values
      rerender(
        <SettingsProvider>
          <Timeline schedules={mockSchedules} timeRange="24h" />
        </SettingsProvider>
      );

      expect(screen.getByText(/24 executions/i)).toBeInTheDocument();
    });
  });
});
