import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ScheduleList } from './ScheduleList';
import type { Schedule } from '../types';

describe('ScheduleList', () => {
  const mockOnRemove = vi.fn();
  const mockOnRename = vi.fn();

  const mockSchedules: Schedule[] = [
    {
      id: 'schedule-1',
      label: 'Daily Backup',
      cronExpression: '0 2 * * *',
      color: '#3B82F6',
      durationMinutes: 0,
    },
    {
      id: 'schedule-2',
      label: 'Hourly Check',
      cronExpression: '0 * * * *',
      color: '#EF4444',
      durationMinutes: 0,
    },
  ];

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Empty State', () => {
    it('should render empty state when no schedules', () => {
      render(<ScheduleList schedules={[]} onRemove={mockOnRemove} onRename={mockOnRename} />);

      expect(screen.getByText('Active Schedules')).toBeInTheDocument();
      expect(screen.getByText(/No schedules added yet/i)).toBeInTheDocument();
    });

    it('should not render schedule list when empty', () => {
      render(<ScheduleList schedules={[]} onRemove={mockOnRemove} onRename={mockOnRename} />);

      expect(screen.queryByText(/Daily Backup/)).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /remove/i })).not.toBeInTheDocument();
    });
  });

  describe('With Schedules', () => {
    it('should render all schedules', () => {
      render(<ScheduleList schedules={mockSchedules} onRemove={mockOnRemove} onRename={mockOnRename} />);

      expect(screen.getByText('Daily Backup')).toBeInTheDocument();
      expect(screen.getByText('Hourly Check')).toBeInTheDocument();
    });

    it('should display schedule count in header', () => {
      render(<ScheduleList schedules={mockSchedules} onRemove={mockOnRemove} onRename={mockOnRename} />);

      expect(screen.getByText('Active Schedules (2)')).toBeInTheDocument();
    });

    it('should display cron expressions', () => {
      render(<ScheduleList schedules={mockSchedules} onRemove={mockOnRemove} onRename={mockOnRename} />);

      expect(screen.getByText('0 2 * * *')).toBeInTheDocument();
      expect(screen.getByText('0 * * * *')).toBeInTheDocument();
    });

    it('should render color indicators', () => {
      const { container } = render(<ScheduleList schedules={mockSchedules} onRemove={mockOnRemove} onRename={mockOnRename} />);

      const colorDots = container.querySelectorAll('.rounded-full');
      expect(colorDots).toHaveLength(2);
    });

    it('should render remove buttons for each schedule', () => {
      render(<ScheduleList schedules={mockSchedules} onRemove={mockOnRemove} onRename={mockOnRename} />);

      const removeButtons = screen.getAllByText('Remove');
      expect(removeButtons).toHaveLength(2);
    });

    it('should call onRemove with correct id when remove is clicked', async () => {
      const user = userEvent.setup();

      render(<ScheduleList schedules={mockSchedules} onRemove={mockOnRemove} onRename={mockOnRename} />);

      const removeButtons = screen.getAllByText('Remove');
      await user.click(removeButtons[0]);

      expect(mockOnRemove).toHaveBeenCalledWith('schedule-1');
      expect(mockOnRemove).toHaveBeenCalledTimes(1);
    });

    it('should handle multiple remove clicks', async () => {
      const user = userEvent.setup();

      render(<ScheduleList schedules={mockSchedules} onRemove={mockOnRemove} onRename={mockOnRename} />);

      const removeButtons = screen.getAllByText('Remove');
      await user.click(removeButtons[0]);
      await user.click(removeButtons[1]);

      expect(mockOnRemove).toHaveBeenCalledTimes(2);
      expect(mockOnRemove).toHaveBeenNthCalledWith(1, 'schedule-1');
      expect(mockOnRemove).toHaveBeenNthCalledWith(2, 'schedule-2');
    });
  });

  describe('Rename Feature', () => {
    it('should enter edit mode when label is clicked', async () => {
      const user = userEvent.setup();

      render(<ScheduleList schedules={mockSchedules} onRemove={mockOnRemove} onRename={mockOnRename} />);

      await user.click(screen.getByText('Daily Backup'));

      const input = screen.getByDisplayValue('Daily Backup');
      expect(input).toBeInTheDocument();
      expect(input.tagName).toBe('INPUT');
    });

    it('should save on Enter key', async () => {
      const user = userEvent.setup();

      render(<ScheduleList schedules={mockSchedules} onRemove={mockOnRemove} onRename={mockOnRename} />);

      await user.click(screen.getByText('Daily Backup'));
      const input = screen.getByDisplayValue('Daily Backup');
      await user.clear(input);
      await user.type(input, 'New Name{Enter}');

      expect(mockOnRename).toHaveBeenCalledWith('schedule-1', 'New Name');
    });

    it('should cancel on Escape key', async () => {
      const user = userEvent.setup();

      render(<ScheduleList schedules={mockSchedules} onRemove={mockOnRemove} onRename={mockOnRename} />);

      await user.click(screen.getByText('Daily Backup'));
      const input = screen.getByDisplayValue('Daily Backup');
      await user.clear(input);
      await user.type(input, 'New Name{Escape}');

      expect(mockOnRename).not.toHaveBeenCalled();
      // Should exit edit mode
      expect(screen.getByText('Daily Backup')).toBeInTheDocument();
    });

    it('should save on blur', async () => {
      const user = userEvent.setup();

      render(<ScheduleList schedules={mockSchedules} onRemove={mockOnRemove} onRename={mockOnRename} />);

      await user.click(screen.getByText('Daily Backup'));
      const input = screen.getByDisplayValue('Daily Backup');
      await user.clear(input);
      await user.type(input, 'Blurred Name');
      await user.tab(); // triggers blur

      expect(mockOnRename).toHaveBeenCalledWith('schedule-1', 'Blurred Name');
    });

    it('should not save empty label', async () => {
      const user = userEvent.setup();

      render(<ScheduleList schedules={mockSchedules} onRemove={mockOnRemove} onRename={mockOnRename} />);

      await user.click(screen.getByText('Daily Backup'));
      const input = screen.getByDisplayValue('Daily Backup');
      await user.clear(input);
      await user.keyboard('{Enter}');

      expect(mockOnRename).not.toHaveBeenCalled();
    });

    it('should not save whitespace-only label', async () => {
      const user = userEvent.setup();

      render(<ScheduleList schedules={mockSchedules} onRemove={mockOnRemove} onRename={mockOnRename} />);

      await user.click(screen.getByText('Daily Backup'));
      const input = screen.getByDisplayValue('Daily Backup');
      await user.clear(input);
      await user.type(input, '   {Enter}');

      expect(mockOnRename).not.toHaveBeenCalled();
    });
  });

  describe('Collapsible View', () => {
    it('should show collapse toggle button', () => {
      render(<ScheduleList schedules={mockSchedules} onRemove={mockOnRemove} onRename={mockOnRename} />);

      expect(screen.getByRole('button', { name: /collapse schedules/i })).toBeInTheDocument();
    });

    it('should hide schedule items when collapsed', async () => {
      const user = userEvent.setup();

      render(<ScheduleList schedules={mockSchedules} onRemove={mockOnRemove} onRename={mockOnRename} />);

      const toggleButton = screen.getByRole('button', { name: /collapse schedules/i });
      await user.click(toggleButton);

      expect(screen.queryByText('Daily Backup')).not.toBeInTheDocument();
      expect(screen.queryByText('Hourly Check')).not.toBeInTheDocument();
    });

    it('should keep header with count visible when collapsed', async () => {
      const user = userEvent.setup();

      render(<ScheduleList schedules={mockSchedules} onRemove={mockOnRemove} onRename={mockOnRename} />);

      const toggleButton = screen.getByRole('button', { name: /collapse schedules/i });
      await user.click(toggleButton);

      expect(screen.getByText('Active Schedules (2)')).toBeInTheDocument();
    });

    it('should change aria-label when toggled', async () => {
      const user = userEvent.setup();

      render(<ScheduleList schedules={mockSchedules} onRemove={mockOnRemove} onRename={mockOnRename} />);

      const toggleButton = screen.getByRole('button', { name: /collapse schedules/i });
      await user.click(toggleButton);

      expect(screen.getByRole('button', { name: /expand schedules/i })).toBeInTheDocument();
    });

    it('should show items again when expanded', async () => {
      const user = userEvent.setup();

      render(<ScheduleList schedules={mockSchedules} onRemove={mockOnRemove} onRename={mockOnRename} />);

      const toggleButton = screen.getByRole('button', { name: /collapse schedules/i });
      await user.click(toggleButton);
      await user.click(screen.getByRole('button', { name: /expand schedules/i }));

      expect(screen.getByText('Daily Backup')).toBeInTheDocument();
      expect(screen.getByText('Hourly Check')).toBeInTheDocument();
    });

    it('should not show toggle when no schedules', () => {
      render(<ScheduleList schedules={[]} onRemove={mockOnRemove} onRename={mockOnRename} />);

      expect(screen.queryByRole('button', { name: /collapse schedules/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /expand schedules/i })).not.toBeInTheDocument();
    });
  });

  describe('Single Schedule', () => {
    it('should render with single schedule', () => {
      render(<ScheduleList schedules={[mockSchedules[0]]} onRemove={mockOnRemove} onRename={mockOnRename} />);

      expect(screen.getByText('Active Schedules (1)')).toBeInTheDocument();
      expect(screen.getByText('Daily Backup')).toBeInTheDocument();
    });

    it('should handle remove for single schedule', async () => {
      const user = userEvent.setup();

      render(<ScheduleList schedules={[mockSchedules[0]]} onRemove={mockOnRemove} onRename={mockOnRename} />);

      const removeButton = screen.getByText('Remove');
      await user.click(removeButton);

      expect(mockOnRemove).toHaveBeenCalledWith('schedule-1');
    });
  });

  describe('Many Schedules', () => {
    it('should render many schedules correctly', () => {
      const manySchedules: Schedule[] = Array.from({ length: 10 }, (_, i) => ({
        id: `schedule-${i}`,
        label: `Schedule ${i}`,
        cronExpression: '0 * * * *',
        color: '#000000',
        durationMinutes: 0,
      }));

      render(<ScheduleList schedules={manySchedules} onRemove={mockOnRemove} onRename={mockOnRename} />);

      expect(screen.getByText('Active Schedules (10)')).toBeInTheDocument();
      expect(screen.getAllByText('Remove')).toHaveLength(10);
    });
  });

  describe('Duration Display', () => {
    it('should show duration when durationMinutes > 0', () => {
      const scheduleWithDuration: Schedule[] = [
        {
          id: 'dur-1',
          label: 'Long Task',
          cronExpression: '0 * * * *',
          color: '#3B82F6',
          durationMinutes: 30,
        },
      ];

      render(<ScheduleList schedules={scheduleWithDuration} onRemove={mockOnRemove} onRename={mockOnRename} />);

      expect(screen.getByText('(30min)')).toBeInTheDocument();
    });

    it('should not show duration when durationMinutes is 0', () => {
      render(<ScheduleList schedules={mockSchedules} onRemove={mockOnRemove} onRename={mockOnRename} />);

      expect(screen.queryByText(/min\)/)).not.toBeInTheDocument();
    });
  });

  describe('Long Labels', () => {
    it('should truncate long labels with CSS', () => {
      const longLabelSchedule: Schedule = {
        id: 'long-1',
        label: 'This is a very long schedule label that should be truncated',
        cronExpression: '0 0 * * *',
        color: '#10B981',
        durationMinutes: 0,
      };

      render(
        <ScheduleList schedules={[longLabelSchedule]} onRemove={mockOnRemove} onRename={mockOnRename} />
      );

      const labelElement = screen.getByText(longLabelSchedule.label);
      expect(labelElement).toHaveClass('truncate');
    });
  });

  describe('Accessibility', () => {
    it('should have proper button roles', () => {
      render(<ScheduleList schedules={mockSchedules} onRemove={mockOnRemove} onRename={mockOnRename} />);

      // 2 remove buttons + 1 collapse toggle
      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(3);
    });

    it('should render schedule details in proper hierarchy', () => {
      render(<ScheduleList schedules={mockSchedules} onRemove={mockOnRemove} onRename={mockOnRename} />);

      const heading = screen.getByRole('heading', { level: 2 });
      expect(heading).toHaveTextContent('Active Schedules (2)');
    });
  });
});
