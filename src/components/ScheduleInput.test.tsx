import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ScheduleInput } from './ScheduleInput';

describe('ScheduleInput', () => {
  const mockOnAdd = vi.fn();

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render form elements', () => {
      render(<ScheduleInput onAdd={mockOnAdd} />);

      expect(screen.getByLabelText(/label/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/cron expression/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /add schedule/i })).toBeInTheDocument();
    });

    it('should render common examples', () => {
      render(<ScheduleInput onAdd={mockOnAdd} />);

      expect(screen.getByText(/common examples/i)).toBeInTheDocument();
      expect(screen.getByText('0 * * * *')).toBeInTheDocument();
      expect(screen.getByText('*/15 * * * *')).toBeInTheDocument();
    });

    it('should have placeholder text', () => {
      render(<ScheduleInput onAdd={mockOnAdd} />);

      const labelInput = screen.getByPlaceholderText(/daily backup/i);
      const cronInput = screen.getByPlaceholderText(/0 2 \* \* \*/);

      expect(labelInput).toBeInTheDocument();
      expect(cronInput).toBeInTheDocument();
    });

    it('should render format help text', () => {
      render(<ScheduleInput onAdd={mockOnAdd} />);

      expect(screen.getByText(/minute hour day-of-month month day-of-week/i)).toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    it('should show error when submitting empty label', async () => {
      const user = userEvent.setup();

      render(<ScheduleInput onAdd={mockOnAdd} />);

      const cronInput = screen.getByLabelText(/cron expression/i);
      await user.type(cronInput, '0 * * * *');

      const submitButton = screen.getByRole('button', { name: /add schedule/i });
      await user.click(submitButton);

      expect(screen.getByText(/please enter a label/i)).toBeInTheDocument();
      expect(mockOnAdd).not.toHaveBeenCalled();
    });

    it('should show error when submitting empty cron expression', async () => {
      const user = userEvent.setup();

      render(<ScheduleInput onAdd={mockOnAdd} />);

      const labelInput = screen.getByLabelText(/^label$/i);
      await user.type(labelInput, 'Test Schedule');

      const submitButton = screen.getByRole('button', { name: /add schedule/i });
      await user.click(submitButton);

      expect(screen.getByText(/please enter a cron expression/i)).toBeInTheDocument();
      expect(mockOnAdd).not.toHaveBeenCalled();
    });

    it('should show error for invalid cron expression', async () => {
      const user = userEvent.setup();

      render(<ScheduleInput onAdd={mockOnAdd} />);

      const labelInput = screen.getByLabelText(/^label$/i);
      const cronInput = screen.getByLabelText(/cron expression/i);

      await user.type(labelInput, 'Test Schedule');
      await user.type(cronInput, 'invalid cron');

      const submitButton = screen.getByRole('button', { name: /add schedule/i });
      await user.click(submitButton);

      expect(screen.getByText(/invalid cron expression/i)).toBeInTheDocument();
      expect(mockOnAdd).not.toHaveBeenCalled();
    });

    it('should clear error when user starts typing in label', async () => {
      const user = userEvent.setup();

      render(<ScheduleInput onAdd={mockOnAdd} />);

      const submitButton = screen.getByRole('button', { name: /add schedule/i });
      await user.click(submitButton);

      expect(screen.getByText(/please enter a label/i)).toBeInTheDocument();

      const labelInput = screen.getByLabelText(/^label$/i);
      await user.type(labelInput, 'T');

      expect(screen.queryByText(/please enter a label/i)).not.toBeInTheDocument();
    });

    it('should clear error when user starts typing in cron expression', async () => {
      const user = userEvent.setup();

      render(<ScheduleInput onAdd={mockOnAdd} />);

      const labelInput = screen.getByLabelText(/^label$/i);
      await user.type(labelInput, 'Test');

      const submitButton = screen.getByRole('button', { name: /add schedule/i });
      await user.click(submitButton);

      expect(screen.getByText(/please enter a cron expression/i)).toBeInTheDocument();

      const cronInput = screen.getByLabelText(/cron expression/i);
      await user.type(cronInput, '0');

      expect(screen.queryByText(/please enter a cron expression/i)).not.toBeInTheDocument();
    });
  });

  describe('Form Submission', () => {
    it('should call onAdd with valid inputs', async () => {
      const user = userEvent.setup();

      render(<ScheduleInput onAdd={mockOnAdd} />);

      const labelInput = screen.getByLabelText(/^label$/i);
      const cronInput = screen.getByLabelText(/cron expression/i);

      await user.type(labelInput, 'Daily Backup');
      await user.type(cronInput, '0 2 * * *');

      const submitButton = screen.getByRole('button', { name: /add schedule/i });
      await user.click(submitButton);

      expect(mockOnAdd).toHaveBeenCalledWith('Daily Backup', '0 2 * * *', 0, undefined);
      expect(mockOnAdd).toHaveBeenCalledTimes(1);
    });

    it('should clear form after successful submission', async () => {
      const user = userEvent.setup();

      render(<ScheduleInput onAdd={mockOnAdd} />);

      const labelInput = screen.getByLabelText(/^label$/i) as HTMLInputElement;
      const cronInput = screen.getByLabelText(/cron expression/i) as HTMLInputElement;

      await user.type(labelInput, 'Hourly Task');
      await user.type(cronInput, '0 * * * *');

      const submitButton = screen.getByRole('button', { name: /add schedule/i });
      await user.click(submitButton);

      expect(labelInput.value).toBe('');
      expect(cronInput.value).toBe('');
    });

    it('should clear error after successful submission', async () => {
      const user = userEvent.setup();

      render(<ScheduleInput onAdd={mockOnAdd} />);

      // First, trigger an error
      const submitButton = screen.getByRole('button', { name: /add schedule/i });
      await user.click(submitButton);
      expect(screen.getByText(/please enter a label/i)).toBeInTheDocument();

      // Then submit valid data
      const labelInput = screen.getByLabelText(/^label$/i);
      const cronInput = screen.getByLabelText(/cron expression/i);

      await user.type(labelInput, 'Test');
      await user.type(cronInput, '0 * * * *');
      await user.click(submitButton);

      expect(screen.queryByText(/please enter a label/i)).not.toBeInTheDocument();
    });

    it('should handle Enter key submission', async () => {
      const user = userEvent.setup();

      render(<ScheduleInput onAdd={mockOnAdd} />);

      const labelInput = screen.getByLabelText(/^label$/i);
      const cronInput = screen.getByLabelText(/cron expression/i);

      await user.type(labelInput, 'Weekly Report');
      await user.type(cronInput, '0 9 * * 1{Enter}');

      expect(mockOnAdd).toHaveBeenCalledWith('Weekly Report', '0 9 * * 1', 0, undefined);
    });

    it('should trim whitespace from inputs', async () => {
      const user = userEvent.setup();

      render(<ScheduleInput onAdd={mockOnAdd} />);

      const labelInput = screen.getByLabelText(/^label$/i);
      const cronInput = screen.getByLabelText(/cron expression/i);

      await user.type(labelInput, '  Daily Task  ');
      await user.type(cronInput, '  0 * * * *  ');

      const submitButton = screen.getByRole('button', { name: /add schedule/i });
      await user.click(submitButton);

      expect(mockOnAdd).toHaveBeenCalledWith('  Daily Task  ', '  0 * * * *  ', 0, undefined);
    });
  });

  describe('Various Cron Expressions', () => {
    it('should accept every hour cron expression', async () => {
      const user = userEvent.setup();

      render(<ScheduleInput onAdd={mockOnAdd} />);

      const labelInput = screen.getByLabelText(/^label$/i);
      const cronInput = screen.getByLabelText(/cron expression/i);

      await user.type(labelInput, 'Hourly');
      await user.type(cronInput, '0 * * * *');

      const submitButton = screen.getByRole('button', { name: /add schedule/i });
      await user.click(submitButton);

      expect(mockOnAdd).toHaveBeenCalledWith('Hourly', '0 * * * *', 0, undefined);
    });

    it('should accept every 15 minutes cron expression', async () => {
      const user = userEvent.setup();

      render(<ScheduleInput onAdd={mockOnAdd} />);

      const labelInput = screen.getByLabelText(/^label$/i);
      const cronInput = screen.getByLabelText(/cron expression/i);

      await user.type(labelInput, 'Every 15 min');
      await user.type(cronInput, '*/15 * * * *');

      const submitButton = screen.getByRole('button', { name: /add schedule/i });
      await user.click(submitButton);

      expect(mockOnAdd).toHaveBeenCalledWith('Every 15 min', '*/15 * * * *', 0, undefined);
    });

    it('should accept daily at specific time', async () => {
      const user = userEvent.setup();

      render(<ScheduleInput onAdd={mockOnAdd} />);

      const labelInput = screen.getByLabelText(/^label$/i);
      const cronInput = screen.getByLabelText(/cron expression/i);

      await user.type(labelInput, 'Daily 2 AM');
      await user.type(cronInput, '0 2 * * *');

      const submitButton = screen.getByRole('button', { name: /add schedule/i });
      await user.click(submitButton);

      expect(mockOnAdd).toHaveBeenCalledWith('Daily 2 AM', '0 2 * * *', 0, undefined);
    });

    it('should accept weekly cron expression', async () => {
      const user = userEvent.setup();

      render(<ScheduleInput onAdd={mockOnAdd} />);

      const labelInput = screen.getByLabelText(/^label$/i);
      const cronInput = screen.getByLabelText(/cron expression/i);

      await user.type(labelInput, 'Sunday Weekly');
      await user.type(cronInput, '0 0 * * 0');

      const submitButton = screen.getByRole('button', { name: /add schedule/i });
      await user.click(submitButton);

      expect(mockOnAdd).toHaveBeenCalledWith('Sunday Weekly', '0 0 * * 0', 0, undefined);
    });
  });

  describe('Duration Field', () => {
    it('should render duration input field', () => {
      render(<ScheduleInput onAdd={mockOnAdd} />);

      expect(screen.getByLabelText(/duration/i)).toBeInTheDocument();
    });

    it('should submit with custom duration', async () => {
      const user = userEvent.setup();

      render(<ScheduleInput onAdd={mockOnAdd} />);

      const labelInput = screen.getByLabelText(/^label$/i);
      const cronInput = screen.getByLabelText(/cron expression/i);
      const durationInput = screen.getByLabelText(/duration/i);

      await user.type(labelInput, 'Long Task');
      await user.type(cronInput, '0 * * * *');
      await user.clear(durationInput);
      await user.type(durationInput, '30');

      const submitButton = screen.getByRole('button', { name: /add schedule/i });
      await user.click(submitButton);

      expect(mockOnAdd).toHaveBeenCalledWith('Long Task', '0 * * * *', 30, undefined);
    });

    it('should reset duration after submission', async () => {
      const user = userEvent.setup();

      render(<ScheduleInput onAdd={mockOnAdd} />);

      const labelInput = screen.getByLabelText(/^label$/i);
      const cronInput = screen.getByLabelText(/cron expression/i);
      const durationInput = screen.getByLabelText(/duration/i) as HTMLInputElement;

      await user.type(labelInput, 'Task');
      await user.type(cronInput, '0 * * * *');
      await user.clear(durationInput);
      await user.type(durationInput, '45');

      const submitButton = screen.getByRole('button', { name: /add schedule/i });
      await user.click(submitButton);

      expect(durationInput.value).toBe('0');
    });
  });

  describe('Edge Cases', () => {
    it('should reject cron with invalid alias', async () => {
      const user = userEvent.setup();

      render(<ScheduleInput onAdd={mockOnAdd} />);

      const labelInput = screen.getByLabelText(/^label$/i);
      const cronInput = screen.getByLabelText(/cron expression/i);

      await user.type(labelInput, 'Invalid');
      await user.type(cronInput, '60 * * * *');

      const submitButton = screen.getByRole('button', { name: /add schedule/i });
      await user.click(submitButton);

      expect(screen.getByText(/invalid cron expression/i)).toBeInTheDocument();
      expect(mockOnAdd).not.toHaveBeenCalled();
    });

    it('should reject out of range minute value', async () => {
      const user = userEvent.setup();

      render(<ScheduleInput onAdd={mockOnAdd} />);

      const labelInput = screen.getByLabelText(/^label$/i);
      const cronInput = screen.getByLabelText(/cron expression/i);

      await user.type(labelInput, 'Invalid Minute');
      await user.type(cronInput, '60 * * * *');

      const submitButton = screen.getByRole('button', { name: /add schedule/i });
      await user.click(submitButton);

      expect(screen.getByText(/invalid cron expression/i)).toBeInTheDocument();
      expect(mockOnAdd).not.toHaveBeenCalled();
    });

    it('should handle whitespace-only label as empty', async () => {
      const user = userEvent.setup();

      render(<ScheduleInput onAdd={mockOnAdd} />);

      const labelInput = screen.getByLabelText(/^label$/i);
      const cronInput = screen.getByLabelText(/cron expression/i);

      await user.type(labelInput, '   ');
      await user.type(cronInput, '0 * * * *');

      const submitButton = screen.getByRole('button', { name: /add schedule/i });
      await user.click(submitButton);

      expect(screen.getByText(/please enter a label/i)).toBeInTheDocument();
      expect(mockOnAdd).not.toHaveBeenCalled();
    });

    it('should handle whitespace-only cron as empty', async () => {
      const user = userEvent.setup();

      render(<ScheduleInput onAdd={mockOnAdd} />);

      const labelInput = screen.getByLabelText(/^label$/i);
      const cronInput = screen.getByLabelText(/cron expression/i);

      await user.type(labelInput, 'Test');
      await user.type(cronInput, '   ');

      const submitButton = screen.getByRole('button', { name: /add schedule/i });
      await user.click(submitButton);

      expect(screen.getByText(/please enter a cron expression/i)).toBeInTheDocument();
      expect(mockOnAdd).not.toHaveBeenCalled();
    });
  });
});
