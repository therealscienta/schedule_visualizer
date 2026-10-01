import { describe, it, expect, vi, afterEach } from 'vitest';
import { apiFetch, setUnauthorizedHandler } from './api';

const respond = (status: number) =>
  vi.fn(async () => new Response(JSON.stringify({ error: 'Nope' }), { status }));

describe('apiFetch', () => {
  afterEach(() => {
    setUnauthorizedHandler(null);
    vi.unstubAllGlobals();
  });

  it('ends the session when the server rejects the token', async () => {
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);
    localStorage.setItem('authToken', 'expired');
    vi.stubGlobal('fetch', respond(401));

    await expect(apiFetch('/schedules')).rejects.toThrow('Nope');
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });

  it('does not end the session for a failed login attempt', async () => {
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);
    localStorage.setItem('authToken', 'current');
    vi.stubGlobal('fetch', respond(401));

    await expect(apiFetch('/auth/login', { method: 'POST' })).rejects.toThrow();
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('does not end the session for other errors', async () => {
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);
    localStorage.setItem('authToken', 'current');
    vi.stubGlobal('fetch', respond(403));

    await expect(apiFetch('/projects/p1', { method: 'DELETE' })).rejects.toThrow();
    expect(onUnauthorized).not.toHaveBeenCalled();
  });
});
