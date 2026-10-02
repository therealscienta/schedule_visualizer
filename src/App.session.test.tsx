import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from './App';
import { SettingsProvider } from './contexts/SettingsContext';
import { AuthProvider } from './contexts/AuthContext';

vi.mock('./components/StatisticsPanel', () => ({
  StatisticsPanel: () => <div data-testid="statistics-panel">Statistics Panel</div>,
}));

const renderApp = () =>
  render(
    <MemoryRouter>
      <SettingsProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </SettingsProvider>
    </MemoryRouter>
  );

type Reply = { status: number; body?: unknown };
type Handler = (method: string, path: string, body: unknown) => Reply | undefined;

// Fakes the API: `handler` answers what it knows, everything else is a 404
function mockApi(handler: Handler) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    const body = init?.body ? JSON.parse(init.body as string) : undefined;
    const reply = handler(method, url.replace(/^\/api/, ''), body) ?? { status: 404, body: { error: 'Not found' } };
    return new Response(reply.status === 204 ? null : JSON.stringify(reply.body ?? {}), { status: reply.status });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const me = { id: 'u1', username: 'alice', email: 'alice@example.com', role: 'user' };

const serverSchedule = (id: string, label: string, ownerId: string, projectId: string | null) => ({
  id, label, ownerId, projectId, cronExpression: '0 3 * * *', color: '#000', durationMinutes: 0, createdAt: '', updatedAt: '',
});

const calls = (fetchMock: ReturnType<typeof mockApi>, method: string, path: string) =>
  fetchMock.mock.calls.filter(([url, init]) => (init?.method ?? 'GET') === method && url === `/api${path}`);

describe('App (sessions and server data)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('project filter', () => {
    it('drops the filter when the filtered project is deleted', async () => {
      localStorage.setItem('projects', JSON.stringify([{ id: 'p1', name: 'Proj', color: '#111' }]));
      localStorage.setItem('schedules', JSON.stringify([
        { id: 's1', label: 'InProj', cronExpression: '0 * * * *', color: '#000', durationMinutes: 0, projectId: 'p1' },
        { id: 's2', label: 'Loose', cronExpression: '0 * * * *', color: '#000', durationMinutes: 0 },
      ]));
      const user = userEvent.setup();
      renderApp();

      await user.click(screen.getAllByRole('button', { name: 'Proj' })[0]);
      expect(screen.queryByText('Loose')).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: '×' }));

      expect(screen.getAllByText('Loose').length).toBeGreaterThan(0);
      expect(screen.getAllByText('InProj').length).toBeGreaterThan(0);
    });
  });

  describe('time range', () => {
    it('restores a saved custom range', async () => {
      localStorage.setItem('timeRange', 'custom');
      localStorage.setItem('customDateRange', JSON.stringify({
        startDate: new Date(2026, 5, 1, 0, 0),
        endDate: new Date(2026, 5, 3, 0, 0),
      }));
      localStorage.setItem('schedules', JSON.stringify([
        { id: 'h', label: 'Hourly', cronExpression: '0 * * * *', color: '#000', durationMinutes: 0 },
      ]));
      renderApp();

      expect(screen.getByRole('button', { name: 'Custom' })).toHaveClass('bg-blue-600');
      expect(screen.getByText('(48 executions)')).toBeInTheDocument();
    });

    it('falls back to 24 hours when a saved custom range has no dates', () => {
      localStorage.setItem('timeRange', 'custom');
      renderApp();

      expect(screen.getByRole('button', { name: '24 Hours' })).toHaveClass('bg-blue-600');
    });

    it('falls back to 24 hours for an unknown saved time range', () => {
      localStorage.setItem('timeRange', '12h');
      renderApp();

      expect(screen.getByRole('button', { name: '24 Hours' })).toHaveClass('bg-blue-600');
    });
  });

  describe('signed in', () => {
    it('marks schedules that scripts manage through the API, and links to the token page', async () => {
      localStorage.setItem('authToken', 'token');
      mockApi((method, path) => {
        if (path === '/auth/me') return { status: 200, body: me };
        if (path === '/projects') return { status: 200, body: [] };
        if (path === '/schedules') {
          return {
            status: 200,
            body: [
              { ...serverSchedule('s-api', 'Synced job', 'u1', null), syncKey: 'nightly' },
              { ...serverSchedule('s-app', 'Manual job', 'u1', null), syncKey: null },
            ],
          };
        }
      });
      const user = userEvent.setup();
      renderApp();
      await waitFor(() => expect(screen.getAllByText('Synced job').length).toBeGreaterThan(0));

      const syncedRow = screen.getAllByText('Synced job').find((el) => el.tagName === 'P')!.closest('.rounded-lg') as HTMLElement;
      expect(within(syncedRow).getByText('API')).toHaveAttribute('title', expect.stringContaining('nightly'));
      const manualRow = screen.getAllByText('Manual job').find((el) => el.tagName === 'P')!.closest('.rounded-lg') as HTMLElement;
      expect(within(manualRow).queryByText('API')).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /alice/ }));
      expect(screen.getByRole('link', { name: 'API tokens' })).toHaveAttribute('href', '/account/tokens');
    });

    it('clears the account data on sign out', async () => {
      localStorage.setItem('authToken', 'token');
      mockApi((method, path) => {
        if (path === '/auth/me') return { status: 200, body: me };
        if (path === '/schedules') return { status: 200, body: [serverSchedule('srv', 'SECRET-FROM-SERVER', 'u1', null)] };
        if (path === '/projects') return { status: 200, body: [] };
      });
      const user = userEvent.setup();
      renderApp();
      await waitFor(() => expect(screen.getAllByText('SECRET-FROM-SERVER').length).toBeGreaterThan(0));

      await user.click(screen.getByRole('button', { name: /alice/ }));
      await user.click(screen.getByRole('button', { name: /sign out/i }));

      expect(screen.queryByText('SECRET-FROM-SERVER')).not.toBeInTheDocument();
      expect(screen.getAllByText('Daily Backup').length).toBeGreaterThan(0);
      expect(localStorage.getItem('schedules')).not.toContain('SECRET-FROM-SERVER');
    });

    it('keeps the session when the server is unreachable', async () => {
      localStorage.setItem('authToken', 'token');
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      mockApi(() => ({ status: 502, body: { error: 'Bad gateway' } }));
      renderApp();

      await waitFor(() => expect(screen.getByRole('link', { name: /sign in/i })).toBeInTheDocument());
      expect(localStorage.getItem('authToken')).toBe('token');
    });

    it('saves imported schedules to the server', async () => {
      localStorage.setItem('authToken', 'token');
      const fetchMock = mockApi((method, path, body) => {
        if (path === '/auth/me') return { status: 200, body: me };
        if (method === 'GET' && (path === '/schedules' || path === '/projects')) return { status: 200, body: [] };
        if (method === 'POST') return { status: 201, body };
      });
      vi.spyOn(window, 'alert').mockImplementation(() => {});
      const user = userEvent.setup();
      const { container } = renderApp();
      await waitFor(() => expect(screen.getByTitle('Refresh data from server')).toBeInTheDocument());

      const content = JSON.stringify({
        schedules: [{ id: 'imp-1', label: 'Imported', cronExpression: '0 4 * * *', color: '#000', durationMinutes: 0, projectId: 'imp-p' }],
        projects: [{ id: 'imp-p', name: 'Imported project', color: '#111' }],
      });
      const file = new File([content], 'export.json', { type: 'application/json' });
      // jsdom's File has no text()
      Object.defineProperty(file, 'text', { value: async () => content });
      await user.upload(container.querySelector<HTMLInputElement>('#import-schedules')!, file);

      await waitFor(() => expect(window.alert).toHaveBeenCalledWith(expect.stringMatching(/^Successfully imported/)));
      expect(calls(fetchMock, 'POST', '/projects')).toHaveLength(1);
      expect(calls(fetchMock, 'POST', '/schedules')).toHaveLength(1);
      expect(JSON.parse(calls(fetchMock, 'POST', '/schedules')[0][1]!.body as string)).toMatchObject({
        id: 'imp-1',
        projectId: 'imp-p',
      });
    });

    it('hides actions the user is not allowed to take on shared data', async () => {
      localStorage.setItem('authToken', 'token');
      mockApi((method, path) => {
        if (path === '/auth/me') return { status: 200, body: me };
        if (path === '/projects') {
          return {
            status: 200,
            body: [
              { id: 'own', ownerId: 'u1', name: 'Own project', color: '#111', role: 'owner' },
              { id: 'shared', ownerId: 'bob', name: 'Shared project', color: '#222', role: 'view' },
            ],
          };
        }
        if (path === '/schedules') {
          return {
            status: 200,
            body: [
              serverSchedule('s-own', 'My job', 'u1', 'own'),
              serverSchedule('s-shared', 'Bobs job', 'bob', 'shared'),
            ],
          };
        }
      });
      renderApp();
      await waitFor(() => expect(screen.getAllByText('Bobs job').length).toBeGreaterThan(0));

      const sharedRow = screen.getAllByText('Bobs job').find((el) => el.tagName === 'P')!.closest('.rounded-lg') as HTMLElement;
      expect(within(sharedRow).queryByTitle('Click to rename')).not.toBeInTheDocument();
      expect(within(sharedRow).queryByRole('button', { name: /remove/i })).not.toBeInTheDocument();

      const ownRow = screen.getAllByText('My job').find((el) => el.tagName === 'P')!.closest('.rounded-lg') as HTMLElement;
      expect(within(ownRow).getByTitle('Click to rename')).toBeInTheDocument();
      expect(within(ownRow).getByRole('button', { name: /remove/i })).toBeInTheDocument();

      // Only one project (the owned one) can be shared or deleted
      expect(screen.getAllByTitle('Share project')).toHaveLength(1);
      expect(screen.getAllByRole('button', { name: '×' })).toHaveLength(1);

      // New schedules can't be added to a view-only project
      const projectSelect = screen.getByLabelText('Project');
      expect(within(projectSelect).queryByText('Shared project')).not.toBeInTheDocument();
    });

    it('reports a rejected change and reloads the server data', async () => {
      localStorage.setItem('authToken', 'token');
      const fetchMock = mockApi((method, path) => {
        if (path === '/auth/me') return { status: 200, body: me };
        if (path === '/schedules' && method === 'GET') return { status: 200, body: [serverSchedule('s1', 'Server label', 'u1', null)] };
        if (path === '/projects') return { status: 200, body: [] };
        if (method === 'PUT') return { status: 500, body: { error: 'Internal server error' } };
      });
      const user = userEvent.setup();
      renderApp();
      await waitFor(() => expect(screen.getAllByText('Server label').length).toBeGreaterThan(0));
      const loadsBefore = calls(fetchMock, 'GET', '/schedules').length;

      await user.click(screen.getByTitle('Click to rename'));
      const input = screen.getByDisplayValue('Server label');
      await user.clear(input);
      await user.type(input, 'Local label{Enter}');

      await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent("Your last change wasn't saved: Internal server error"));
      await waitFor(() => expect(calls(fetchMock, 'GET', '/schedules').length).toBeGreaterThan(loadsBefore));
      await waitFor(() => expect(screen.getAllByText('Server label').length).toBeGreaterThan(0));
      expect(calls(fetchMock, 'POST', '/schedules')).toHaveLength(0);
    });
  });
});
