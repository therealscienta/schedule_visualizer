import { beforeAll, afterAll, expect } from 'vitest';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
import { createApp } from '../src/app';

// Shared by the API tests. Each test file runs in its own worker, so it gets its own app
// and its own in-memory database (DB_PATH=':memory:' in vitest.config.ts).

export interface Session {
  token: string;
  user: { id: string; username: string; email: string; role: string };
}

let server: Server;
let base: string;

// Serves the app on a free port for the tests in the calling file
export function setupTestServer(): void {
  beforeAll(async () => {
    server = createApp().listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  });

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
  });
}

export async function api(method: string, path: string, token?: string, body?: unknown) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null, headers: response.headers };
}

export async function register(username: string, password = 'secret123'): Promise<Session> {
  const { status, body } = await api('POST', '/auth/register', undefined, {
    username,
    email: `${username}@example.com`,
    password,
  });
  expect(status).toBe(201);
  return body;
}

export async function createProject(session: Session, name = 'Project') {
  const { body } = await api('POST', '/projects', session.token, { name, color: '#123456' });
  return body as { id: string };
}

export async function createSchedule(session: Session, label: string, projectId?: string | null) {
  const { status, body } = await api('POST', '/schedules', session.token, {
    label,
    cronExpression: '0 * * * *',
    color: '#000000',
    projectId,
  });
  expect(status).toBe(201);
  return body as { id: string; projectId: string | null };
}
