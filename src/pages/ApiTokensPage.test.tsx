import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ApiTokensPage } from './ApiTokensPage';
import type { ApiToken } from '../types';

type Reply = { status: number; body?: unknown };
type Handler = (method: string, path: string, body: any) => Reply | undefined;

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

const token = (overrides: Partial<ApiToken> = {}): ApiToken => ({
  id: 't1',
  name: 'Nightly deploy',
  prefix: 'svt_AbCdEfGh',
  scope: 'write',
  projectId: null,
  projectName: null,
  expiresAt: null,
  lastUsedAt: null,
  createdAt: '2026-10-01T10:00:00.000Z',
  expired: false,
  ...overrides,
});

const projects = [
  { id: 'p1', name: 'Platform', color: '#111', role: 'owner' },
  { id: 'p2', name: 'Shared with me', color: '#222', role: 'view' },
];

const renderPage = () =>
  render(
    <MemoryRouter>
      <ApiTokensPage />
    </MemoryRouter>
  );

describe('ApiTokensPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('lists the tokens without ever showing a token', async () => {
    mockApi((method, path) => {
      if (method === 'GET' && path === '/tokens') {
        return {
          status: 200,
          body: [
            token(),
            token({
              id: 't2',
              name: 'Dashboard',
              scope: 'read',
              projectId: 'p1',
              projectName: 'Platform',
              lastUsedAt: '2026-10-02T08:00:00.000Z',
              expiresAt: '2026-09-01T00:00:00.000Z',
              expired: true,
            }),
          ],
        };
      }
      if (method === 'GET' && path === '/projects') return { status: 200, body: projects };
      return undefined;
    });
    renderPage();

    const [deploy, dashboard] = await screen.findAllByRole('listitem');
    expect(within(deploy).getByText('Nightly deploy')).toBeInTheDocument();
    expect(within(deploy).getByText('svt_AbCdEfGh…')).toBeInTheDocument();
    expect(within(deploy).getByText('Read and write')).toBeInTheDocument();
    expect(within(deploy).getByText('All projects')).toBeInTheDocument();

    expect(within(dashboard).getByText('Read only')).toBeInTheDocument();
    expect(within(dashboard).getByText('Platform')).toBeInTheDocument();
    expect(within(dashboard).getByText('Expired')).toBeInTheDocument();
    expect(within(deploy).getAllByText('Never').length).toBe(2); // Last used, expires
  });

  it('says so when there are no tokens', async () => {
    mockApi((method, path) => (method === 'GET' ? { status: 200, body: path === '/projects' ? projects : [] } : undefined));
    renderPage();

    expect(await screen.findByText('No tokens yet.')).toBeInTheDocument();
  });

  it('creates a token and shows it once', async () => {
    const created = token({ id: 't9', name: 'CI', scope: 'read', expiresAt: '2027-01-01T00:00:00.000Z' });
    let listed: ApiToken[] = [];
    const fetchMock = mockApi((method, path) => {
      if (method === 'GET' && path === '/tokens') return { status: 200, body: listed };
      if (method === 'GET' && path === '/projects') return { status: 200, body: projects };
      if (method === 'POST' && path === '/tokens') {
        listed = [created];
        return { status: 201, body: { ...created, token: 'svt_the-secret-token' } };
      }
      return undefined;
    });
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('No tokens yet.');

    await user.type(screen.getByLabelText('Name'), '  CI  ');
    await user.click(screen.getByRole('button', { name: 'Create token' }));

    // Defaults to the safest choices: read only, 90 days
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST')!;
    expect(JSON.parse(post[1]!.body as string)).toEqual({ name: 'CI', scope: 'read', projectId: null, expiresInDays: 90 });

    expect(await screen.findByTestId('new-token')).toHaveTextContent('svt_the-secret-token');
    expect(screen.getByRole('status')).toHaveTextContent('won’t be shown again');
    expect(screen.getByText(/curl -H "Authorization: Bearer svt_the-secret-token"/)).toBeInTheDocument();
    expect(await screen.findByText('svt_AbCdEfGh…')).toBeInTheDocument(); // Listed
    expect(screen.getByLabelText('Name')).toHaveValue('');

    await user.click(screen.getByRole('button', { name: 'Copy' }));
    expect(await screen.findByRole('button', { name: 'Copied' })).toBeInTheDocument();
    expect(await navigator.clipboard.readText()).toBe('svt_the-secret-token');

    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.queryByTestId('new-token')).not.toBeInTheDocument();
    expect(screen.queryByText('svt_the-secret-token')).not.toBeInTheDocument();
  });

  it('sends the chosen access, project and expiry', async () => {
    const fetchMock = mockApi((method, path) => {
      if (method === 'GET') return { status: 200, body: path === '/projects' ? projects : [] };
      if (method === 'POST') return { status: 201, body: { ...token(), token: 'svt_x' } };
      return undefined;
    });
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('No tokens yet.');

    await user.type(screen.getByLabelText('Name'), 'Deploy');
    await user.selectOptions(screen.getByLabelText('Access'), 'write');
    await user.selectOptions(screen.getByLabelText('Projects'), 'p1');
    await user.selectOptions(screen.getByLabelText('Expires after'), 'never');
    expect(screen.getByRole('option', { name: 'Shared with me (view)' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Create token' }));

    const post = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST')!;
    expect(JSON.parse(post[1]!.body as string)).toEqual({ name: 'Deploy', scope: 'write', projectId: 'p1', expiresInDays: null });
  });

  it("needs a name and reports the server's refusal", async () => {
    mockApi((method, path) => {
      if (method === 'GET') return { status: 200, body: path === '/projects' ? projects : [] };
      if (method === 'POST') return { status: 404, body: { error: 'Project not found' } };
      return undefined;
    });
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('No tokens yet.');

    expect(screen.getByRole('button', { name: 'Create token' })).toBeDisabled();
    await user.type(screen.getByLabelText('Name'), 'Deploy');
    await user.click(screen.getByRole('button', { name: 'Create token' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Project not found');
    expect(screen.queryByTestId('new-token')).not.toBeInTheDocument();
  });

  it('revokes a token after confirming', async () => {
    let listed = [token(), token({ id: 't2', name: 'Dashboard' })];
    const fetchMock = mockApi((method, path) => {
      if (method === 'GET') return { status: 200, body: path === '/projects' ? projects : listed };
      if (method === 'DELETE' && path === '/tokens/t1') {
        listed = listed.filter((t) => t.id !== 't1');
        return { status: 204 };
      }
      return undefined;
    });
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValue(true);
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Nightly deploy');

    await user.click(screen.getByRole('button', { name: 'Revoke Nightly deploy' }));
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('Nightly deploy'));
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(false);

    await user.click(screen.getByRole('button', { name: 'Revoke Nightly deploy' }));
    await vi.waitFor(() => expect(screen.queryByText('Nightly deploy')).not.toBeInTheDocument());
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('reports a failure to load', async () => {
    mockApi(() => ({ status: 500, body: { error: 'Internal server error' } }));
    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent('Internal server error');
  });
});
