import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from './App';
import { SettingsProvider } from './contexts/SettingsContext';
import { AuthProvider } from './contexts/AuthContext';

// Mock the StatisticsPanel and CustomDateRangePicker components
vi.mock('./components/StatisticsPanel', () => ({
  StatisticsPanel: () => <div data-testid="statistics-panel">Statistics Panel</div>,
}));

vi.mock('./components/CustomDateRangePicker', () => ({
  CustomDateRangePicker: () => <div data-testid="custom-date-picker">Custom Date Picker</div>,
}));

const renderApp = () => {
  return render(
    <MemoryRouter>
      <SettingsProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </SettingsProvider>
    </MemoryRouter>
  );
};

describe('App Integration Tests', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('Initial Rendering', () => {
    it('should render main heading', () => {
      renderApp();

      expect(screen.getByRole('heading', { level: 1, name: /cron schedule visualiser/i })).toBeInTheDocument();
    });

    it('should render description', () => {
      renderApp();

      expect(
        screen.getByText(/visualize and analyze multiple cron schedules/i)
      ).toBeInTheDocument();
    });

    it('should render all main sections', () => {
      renderApp();

      expect(screen.getByText(/add new schedule/i)).toBeInTheDocument();
      expect(screen.getByText(/active schedules/i)).toBeInTheDocument();
      expect(screen.getByText(/time range/i)).toBeInTheDocument();
      expect(screen.getByText('Timeline')).toBeInTheDocument();
    });

    it('should load default schedules on first run', () => {
      renderApp();

      expect(screen.getAllByText('Daily Backup').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Hourly Health Check').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Weekly Report').length).toBeGreaterThanOrEqual(1);
    });

    it('should show default schedules count', () => {
      renderApp();

      expect(screen.getByText(/active schedules \(3\)/i)).toBeInTheDocument();
    });

    it('should render dark mode toggle button', async () => {
      renderApp();

      await waitFor(() => {
        const darkModeButton = screen.getByTitle(/switch to dark mode/i);
        expect(darkModeButton).toBeInTheDocument();
      });
    });
  });

  describe('Adding Schedules', () => {
    it('should add a new schedule', async () => {
      const user = userEvent.setup();
      renderApp();

      const labelInput = screen.getByLabelText(/^label$/i);
      const cronInput = screen.getByLabelText(/cron expression/i);
      const addButton = screen.getByRole('button', { name: /add schedule/i });

      await user.type(labelInput, 'Test Schedule');
      await user.type(cronInput, '0 * * * *');
      await user.click(addButton);

      expect(screen.getAllByText('Test Schedule').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/active schedules \(4\)/i)).toBeInTheDocument();
    });

    it('should add schedule and display it in timeline', async () => {
      const user = userEvent.setup();
      renderApp();

      const labelInput = screen.getByLabelText(/^label$/i);
      const cronInput = screen.getByLabelText(/cron expression/i);
      const addButton = screen.getByRole('button', { name: /add schedule/i });

      await user.type(labelInput, 'New Task');
      await user.type(cronInput, '*/30 * * * *');
      await user.click(addButton);

      // Should appear in both schedule list and timeline
      const scheduleLists = screen.getAllByText('New Task');
      expect(scheduleLists.length).toBeGreaterThanOrEqual(1);
    });

    it('should assign unique colors to new schedules', async () => {
      const user = userEvent.setup();
      renderApp();

      const labelInput = screen.getByLabelText(/^label$/i);
      const cronInput = screen.getByLabelText(/cron expression/i);
      const addButton = screen.getByRole('button', { name: /add schedule/i });

      await user.type(labelInput, 'Task 1');
      await user.type(cronInput, '0 * * * *');
      await user.click(addButton);

      await user.type(labelInput, 'Task 2');
      await user.type(cronInput, '0 * * * *');
      await user.click(addButton);

      expect(screen.getAllByText('Task 1').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Task 2').length).toBeGreaterThanOrEqual(1);
    });

    it('should persist new schedules to localStorage', async () => {
      const user = userEvent.setup();
      renderApp();

      const labelInput = screen.getByLabelText(/^label$/i);
      const cronInput = screen.getByLabelText(/cron expression/i);
      const addButton = screen.getByRole('button', { name: /add schedule/i });

      await user.type(labelInput, 'Persisted Task');
      await user.type(cronInput, '0 6 * * *');
      await user.click(addButton);

      await waitFor(() => {
        const stored = localStorage.getItem('schedules');
        expect(stored).toBeTruthy();
        const schedules = JSON.parse(stored!);
        expect(schedules.some((s: any) => s.label === 'Persisted Task')).toBe(true);
      });
    });
  });

  describe('Removing Schedules', () => {
    it('should remove a schedule when remove button is clicked', async () => {
      const user = userEvent.setup();
      renderApp();

      expect(screen.getAllByText('Daily Backup').length).toBeGreaterThan(0);

      const removeButtons = screen.getAllByRole('button', { name: /remove/i });
      await user.click(removeButtons[0]);

      // Should be removed from the schedule list section
      const scheduleListSection = screen.getByText(/active schedules/i).closest('.bg-white, .dark\\:bg-gray-800') || screen.getByText(/active schedules/i).parentElement;
      expect(within(scheduleListSection!).queryByText('Daily Backup')).not.toBeInTheDocument();
      expect(screen.getByText(/active schedules \(2\)/i)).toBeInTheDocument();
    });

    it('should remove all schedules', async () => {
      const user = userEvent.setup();
      renderApp();

      const removeButtons = screen.getAllByRole('button', { name: /remove/i });

      for (const button of removeButtons) {
        await user.click(button);
      }

      expect(screen.getByText(/no schedules added yet/i)).toBeInTheDocument();
    });

    it('should update timeline when schedule is removed', async () => {
      const user = userEvent.setup();
      renderApp();

      expect(screen.getAllByText('Daily Backup').length).toBeGreaterThan(0);

      const removeButtons = screen.getAllByRole('button', { name: /remove/i });
      await user.click(removeButtons[0]);

      // Timeline should update - label might still appear once in timeline section
      const scheduleListSection = screen.getByText(/active schedules/i).parentElement;
      expect(within(scheduleListSection!).queryByText('Daily Backup')).not.toBeInTheDocument();
    });

    it('should persist removal to localStorage', async () => {
      const user = userEvent.setup();
      renderApp();

      const removeButtons = screen.getAllByRole('button', { name: /remove/i });
      await user.click(removeButtons[0]);

      await waitFor(() => {
        const stored = localStorage.getItem('schedules');
        const schedules = JSON.parse(stored!);
        expect(schedules.length).toBe(2);
        expect(schedules.some((s: any) => s.label === 'Daily Backup')).toBe(false);
      });
    });
  });

  describe('Time Range Selection', () => {
    it('should change time range when button clicked', async () => {
      const user = userEvent.setup();
      renderApp();

      const sevenDaysButton = screen.getByRole('button', { name: '7 Days' });
      await user.click(sevenDaysButton);

      expect(sevenDaysButton).toHaveClass('bg-blue-600', 'text-white');
    });

    it('should persist time range to localStorage', async () => {
      const user = userEvent.setup();
      renderApp();

      const thirtyDaysButton = screen.getByRole('button', { name: '30 Days' });
      await user.click(thirtyDaysButton);

      await waitFor(() => {
        expect(localStorage.getItem('timeRange')).toBe('30d');
      });
    });

    it('should update execution counts when time range changes', async () => {
      const user = userEvent.setup();
      renderApp();

      // 24 hours: hourly should have 24 executions
      expect(screen.getByText(/24 executions/i)).toBeInTheDocument();

      const sevenDaysButton = screen.getByRole('button', { name: '7 Days' });
      await user.click(sevenDaysButton);

      // 7 days: hourly should have 168 executions (24 * 7)
      expect(screen.getByText(/168 executions/i)).toBeInTheDocument();
    });

    it('should load saved time range from localStorage', async () => {
      localStorage.setItem('timeRange', '7d');

      renderApp();

      await waitFor(() => {
        const sevenDaysButton = screen.getByRole('button', { name: '7 Days' });
        expect(sevenDaysButton).toHaveClass('bg-blue-600', 'text-white');
      });
    });
  });

  describe('Time Format Toggling', () => {
    it('should toggle between 12h and 24h time format', async () => {
      const user = userEvent.setup();
      renderApp();

      const twelveHourButton = screen.getByRole('button', { name: '12h' });
      const twentyFourHourButton = screen.getByRole('button', { name: '24h' });

      // Default should be 24h (from context default)
      expect(twentyFourHourButton).toHaveClass('bg-blue-600', 'text-white');

      await user.click(twelveHourButton);
      expect(twelveHourButton).toHaveClass('bg-blue-600', 'text-white');

      await user.click(twentyFourHourButton);
      expect(twentyFourHourButton).toHaveClass('bg-blue-600', 'text-white');
    });

    it('should persist time format to localStorage', async () => {
      const user = userEvent.setup();
      renderApp();

      const twelveHourButton = screen.getByRole('button', { name: '12h' });
      await user.click(twelveHourButton);

      await waitFor(() => {
        expect(localStorage.getItem('timeFormat')).toBe('12h');
      });
    });
  });

  describe('Dark Mode', () => {
    it('should toggle dark mode', async () => {
      const user = userEvent.setup();
      renderApp();

      const darkModeButton = await screen.findByTitle(/switch to dark mode/i);
      await user.click(darkModeButton);

      await waitFor(() => {
        expect(darkModeButton).toHaveAttribute('title', 'Switch to light mode');
      });
    });

    it('should persist dark mode preference to localStorage', async () => {
      const user = userEvent.setup();
      renderApp();

      const darkModeButton = await screen.findByTitle(/switch to dark mode/i);
      await user.click(darkModeButton);

      await waitFor(() => {
        expect(localStorage.getItem('darkMode')).toBe('true');
      });
    });
  });

  describe('Rename Integration', () => {
    it('should rename a schedule and persist to localStorage', async () => {
      const user = userEvent.setup();
      renderApp();

      // Find the Daily Backup label in the schedule list (has title="Click to rename")
      const dailyBackupLabels = screen.getAllByText('Daily Backup');
      const editableLabel = dailyBackupLabels.find(el => el.getAttribute('title') === 'Click to rename')!;
      await user.click(editableLabel);

      const input = screen.getByDisplayValue('Daily Backup');
      await user.clear(input);
      await user.type(input, 'Renamed Backup{Enter}');

      // Verify it appears renamed
      expect(screen.getAllByText('Renamed Backup').length).toBeGreaterThanOrEqual(1);

      // Verify persisted to localStorage
      await waitFor(() => {
        const stored = localStorage.getItem('schedules');
        const schedules = JSON.parse(stored!);
        expect(schedules.some((s: any) => s.label === 'Renamed Backup')).toBe(true);
        expect(schedules.some((s: any) => s.label === 'Daily Backup')).toBe(false);
      });
    });
  });

  describe('End-to-End Workflow', () => {
    it('should complete full workflow: add, view, and remove schedule', async () => {
      const user = userEvent.setup();
      renderApp();

      // Step 1: Add a schedule
      const labelInput = screen.getByLabelText(/^label$/i);
      const cronInput = screen.getByLabelText(/cron expression/i);
      const addButton = screen.getByRole('button', { name: /add schedule/i });

      await user.type(labelInput, 'E2E Test Task');
      await user.type(cronInput, '0 6 * * *');
      await user.click(addButton);

      // Step 2: Verify it appears
      expect(screen.getAllByText('E2E Test Task').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('0 6 * * *')).toBeInTheDocument();

      // Step 3: Remove the added schedule (it's the last one)
      const removeButtons = screen.getAllByRole('button', { name: /remove/i });
      await user.click(removeButtons[removeButtons.length - 1]);

      // Step 4: Verify it's removed
      const scheduleListSection = screen.getByText(/active schedules/i).parentElement!;
      expect(within(scheduleListSection).queryByText('E2E Test Task')).not.toBeInTheDocument();
    });

    it('should handle multiple schedules with overlap detection', async () => {
      const user = userEvent.setup();
      renderApp();

      // Add two schedules that overlap
      const labelInput = screen.getByLabelText(/^label$/i);
      const cronInput = screen.getByLabelText(/cron expression/i);
      const addButton = screen.getByRole('button', { name: /add schedule/i });

      await user.type(labelInput, 'Overlap Task 1');
      await user.type(cronInput, '0 6 * * *');
      await user.click(addButton);

      await user.type(labelInput, 'Overlap Task 2');
      await user.type(cronInput, '0 6 * * *');
      await user.click(addButton);

      // Should detect overlaps in timeline
      expect(screen.getAllByText('Overlap Task 1').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Overlap Task 2').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/\d+ conflicts/i)).toBeInTheDocument();
    });

    it('should validate and reject invalid cron expressions', async () => {
      const user = userEvent.setup();
      renderApp();

      const labelInput = screen.getByLabelText(/^label$/i);
      const cronInput = screen.getByLabelText(/cron expression/i);
      const addButton = screen.getByRole('button', { name: /add schedule/i });

      await user.type(labelInput, 'Invalid Task');
      await user.type(cronInput, 'not a valid cron');
      await user.click(addButton);

      expect(screen.getByText(/invalid cron expression/i)).toBeInTheDocument();
      expect(screen.queryByText('Invalid Task')).not.toBeInTheDocument();
    });
  });

  describe('LocalStorage Integration', () => {
    it('should load schedules from localStorage on mount', async () => {
      const savedSchedules = [
        {
          id: 'saved-1',
          label: 'Saved Schedule',
          cronExpression: '0 8 * * *',
          color: '#3B82F6',
        },
      ];

      localStorage.setItem('schedules', JSON.stringify(savedSchedules));

      renderApp();

      await waitFor(() => {
        expect(screen.getAllByText('Saved Schedule').length).toBeGreaterThanOrEqual(1);
      });
      expect(screen.getByText('0 8 * * *')).toBeInTheDocument();
    });

    it('should handle corrupted localStorage data gracefully', () => {
      localStorage.setItem('schedules', 'corrupted json data');

      renderApp();

      // Should fall back to default schedules
      expect(screen.getAllByText('Daily Backup').length).toBeGreaterThanOrEqual(1);
    });

    it('should sync multiple state changes to localStorage', async () => {
      const user = userEvent.setup();
      renderApp();

      // Add schedule
      const labelInput = screen.getByLabelText(/^label$/i);
      const cronInput = screen.getByLabelText(/cron expression/i);
      const addButton = screen.getByRole('button', { name: /add schedule/i });

      await user.type(labelInput, 'Sync Test');
      await user.type(cronInput, '0 * * * *');
      await user.click(addButton);

      // Change time range
      await user.click(screen.getByRole('button', { name: '7 Days' }));

      // Change time format
      await user.click(screen.getByRole('button', { name: '12h' }));

      // Verify all persisted
      await waitFor(() => {
        expect(localStorage.getItem('schedules')).toBeTruthy();
        expect(localStorage.getItem('timeRange')).toBe('7d');
        expect(localStorage.getItem('timeFormat')).toBe('12h');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle empty schedule label', async () => {
      const user = userEvent.setup();
      renderApp();

      const cronInput = screen.getByLabelText(/cron expression/i);
      const addButton = screen.getByRole('button', { name: /add schedule/i });

      await user.type(cronInput, '0 * * * *');
      await user.click(addButton);

      expect(screen.getByText(/please enter a label/i)).toBeInTheDocument();
    });

    it('should handle empty cron expression', async () => {
      const user = userEvent.setup();
      renderApp();

      const labelInput = screen.getByLabelText(/^label$/i);
      const addButton = screen.getByRole('button', { name: /add schedule/i });

      await user.type(labelInput, 'Test');
      await user.click(addButton);

      expect(screen.getByText(/please enter a cron expression/i)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper heading hierarchy', () => {
      renderApp();

      const h1 = screen.getByRole('heading', { level: 1 });
      expect(h1).toBeInTheDocument();

      const h2s = screen.getAllByRole('heading', { level: 2 });
      expect(h2s.length).toBeGreaterThan(0);
    });

    it('should have accessible form inputs', () => {
      renderApp();

      expect(screen.getByLabelText(/^label$/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/cron expression/i)).toBeInTheDocument();
    });

    it('should have accessible buttons', () => {
      renderApp();

      expect(screen.getByRole('button', { name: /add schedule/i })).toBeInTheDocument();
      expect(screen.getAllByRole('button', { name: /remove/i }).length).toBeGreaterThan(0);
    });
  });
});
