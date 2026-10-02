import { createHash } from 'crypto';
import { describe, it, expect, beforeAll } from 'vitest';
import { getDatabase } from '../src/db/connection';
import { api, createProject, register, Session, setupTestServer } from './helpers';

setupTestServer();

interface CreatedToken {
  id: string;
  token: string;
  prefix: string;
  scope: string;
  projectId: string | null;
  expiresAt: string | null;
}

async function createToken(session: Session, body: object = {}): Promise<CreatedToken> {
  const { status, body: created } = await api('POST', '/tokens', session.token, { name: 'CI', scope: 'write', ...body });
  expect(status).toBe(201);
  return created;
}

const tokenRow = (id: string) => getDatabase().prepare('SELECT * FROM api_tokens WHERE id = ?').get(id) as Record<string, any>;

describe('API tokens', () => {
  let admin: Session;
  let alice: Session;
  let bob: Session;

  beforeAll(async () => {
    admin = await register('admin'); // first user becomes admin
    alice = await register('alice');
    bob = await register('bob');
  });

  describe('creating', () => {
    it('shows the token once and stores only its hash', async () => {
      const created = await createToken(alice, { name: 'Deploy script' });
      expect(created.token).toMatch(/^svt_[A-Za-z0-9_-]{43}$/);
      expect(created.prefix).toBe(created.token.slice(0, 12));

      const list = await api('GET', '/tokens', alice.token);
      expect(list.status).toBe(200);
      expect(list.body.map((t: { id: string }) => t.id)).toContain(created.id);
      expect(JSON.stringify(list.body)).not.toContain(created.token);

      const row = tokenRow(created.id);
      expect(row.token_hash).toBe(createHash('sha256').update(created.token).digest('hex'));
      expect(JSON.stringify(row)).not.toContain(created.token);
    });

    it('can expire and can be limited to a project', async () => {
      const project = await createProject(alice, 'Limited');
      const created = await createToken(alice, { scope: 'read', projectId: project.id, expiresInDays: 30 });
      expect(created.scope).toBe('read');
      expect(created.projectId).toBe(project.id);

      const days = (Date.parse(created.expiresAt as string) - Date.now()) / (24 * 60 * 60 * 1000);
      expect(days).toBeGreaterThan(29.9);
      expect(days).toBeLessThan(30.1);

      const forever = await createToken(alice);
      expect(forever.expiresAt).toBeNull();
    });

    it('rejects invalid requests', async () => {
      expect((await api('POST', '/tokens', alice.token, { scope: 'read' })).status).toBe(400);
      expect((await api('POST', '/tokens', alice.token, { name: '  ', scope: 'read' })).status).toBe(400);
      expect((await api('POST', '/tokens', alice.token, { name: 'x', scope: 'admin' })).status).toBe(400);
      expect((await api('POST', '/tokens', alice.token, { name: 'x', scope: 'read', expiresInDays: 0 })).status).toBe(400);
      expect((await api('POST', '/tokens', undefined, { name: 'x', scope: 'read' })).status).toBe(401);
    });

    it("won't limit a token to a project the user can't see", async () => {
      const bobsProject = await createProject(bob, 'Private');
      const { status } = await api('POST', '/tokens', alice.token, { name: 'x', scope: 'read', projectId: bobsProject.id });
      expect(status).toBe(404);
    });
  });

  describe('using', () => {
    it('acts as the user who created it', async () => {
      const { token } = await createToken(alice);
      const me = await api('GET', '/v1/me', token);
      expect(me.status).toBe(200);
      expect(me.body.user).toEqual({ id: alice.user.id, username: 'alice', email: 'alice@example.com' });
      expect(me.body.token.scope).toBe('write');
    });

    it('rejects requests without a valid token', async () => {
      const none = await api('GET', '/v1/me');
      expect(none.status).toBe(401);
      expect(none.headers.get('www-authenticate')).toMatch(/^Bearer/);

      expect((await api('GET', '/v1/me', 'svt_doesnotexist')).status).toBe(401);
      expect((await api('GET', '/v1/me', 'not-even-a-token')).status).toBe(401);
    });

    it('rejects revoked tokens', async () => {
      const { id, token } = await createToken(alice);
      expect((await api('GET', '/v1/me', token)).status).toBe(200);
      expect((await api('DELETE', `/tokens/${id}`, alice.token)).status).toBe(204);
      expect((await api('GET', '/v1/me', token)).status).toBe(401);
    });

    it('rejects expired tokens and lists them as expired', async () => {
      const { id, token } = await createToken(alice, { expiresInDays: 1 });
      expect((await api('GET', '/v1/me', token)).status).toBe(200);

      getDatabase().prepare("UPDATE api_tokens SET expires_at = datetime('now', '-1 minute') WHERE id = ?").run(id);
      expect((await api('GET', '/v1/me', token)).status).toBe(401);

      const list = await api('GET', '/tokens', alice.token);
      expect(list.body.find((t: { id: string }) => t.id === id).expired).toBe(true);
    });

    it('stops working when the account is disabled or deleted', async () => {
      const user = await register('leaver');
      const { id, token } = await createToken(user);

      getDatabase().prepare('UPDATE users SET is_active = 0 WHERE id = ?').run(user.user.id);
      expect((await api('GET', '/v1/me', token)).status).toBe(401);

      getDatabase().prepare('UPDATE users SET is_active = 1 WHERE id = ?').run(user.user.id);
      expect((await api('GET', '/v1/me', token)).status).toBe(200);

      expect((await api('DELETE', `/admin/users/${user.user.id}`, admin.token)).status).toBe(204);
      expect((await api('GET', '/v1/me', token)).status).toBe(401);
      expect(tokenRow(id)).toBeUndefined();
    });

    it('is removed with the project it is limited to', async () => {
      const project = await createProject(alice, 'Short-lived');
      const { id, token } = await createToken(alice, { projectId: project.id });
      expect((await api('GET', '/v1/me', token)).status).toBe(200);

      await api('DELETE', `/projects/${project.id}`, alice.token);
      expect((await api('GET', '/v1/me', token)).status).toBe(401);
      expect(tokenRow(id)).toBeUndefined();
    });

    it('refreshes last_used_at at most once a minute', async () => {
      const { id, token } = await createToken(alice);
      expect(tokenRow(id).last_used_at).toBeNull();

      await api('GET', '/v1/me', token);
      const first = tokenRow(id).last_used_at;
      expect(first).not.toBeNull();

      const setLastUsed = (modifier: string) =>
        getDatabase().prepare(`UPDATE api_tokens SET last_used_at = datetime('now', ?) WHERE id = ?`).run(modifier, id);

      setLastUsed('-10 seconds');
      const recent = tokenRow(id).last_used_at;
      await api('GET', '/v1/me', token);
      expect(tokenRow(id).last_used_at).toBe(recent);

      setLastUsed('-2 minutes');
      const stale = tokenRow(id).last_used_at;
      await api('GET', '/v1/me', token);
      expect(tokenRow(id).last_used_at > stale).toBe(true);
    });
  });

  describe('managing', () => {
    it("keeps other users' tokens private", async () => {
      const { id, token } = await createToken(alice, { name: 'Alice only' });

      const bobsList = await api('GET', '/tokens', bob.token);
      expect(bobsList.body.map((t: { id: string }) => t.id)).not.toContain(id);

      expect((await api('DELETE', `/tokens/${id}`, bob.token)).status).toBe(404);
      expect((await api('GET', '/v1/me', token)).status).toBe(200);
    });
  });

  describe('keeping tokens and logins apart', () => {
    it('only accepts API tokens on /api/v1', async () => {
      expect((await api('GET', '/v1/me', alice.token)).status).toBe(401);
      expect((await api('GET', '/v1/projects', alice.token)).status).toBe(401);
    });

    it('rejects API tokens on the routes for logged-in users', async () => {
      const { token } = await createToken(alice);
      const project = await createProject(alice, 'Shared');

      const attempts: [string, string, unknown?][] = [
        ['GET', '/auth/me'],
        ['GET', '/schedules'],
        ['POST', '/schedules/sync', { schedules: [] }],
        ['GET', '/projects'],
        ['POST', `/projects/${project.id}/share`, { identifier: 'bob', permission: 'edit' }],
        ['GET', '/tokens'],
        ['POST', '/tokens', { name: 'more', scope: 'write' }],
        ['GET', '/admin/users'],
      ];
      for (const [method, path, body] of attempts) {
        const { status } = await api(method, path, token, body);
        expect(status, `${method} ${path}`).toBe(401);
      }
    });
  });

  describe('read-only tokens', () => {
    it('can read but not change anything', async () => {
      const { token } = await createToken(alice, { scope: 'read' });
      const project = await createProject(alice, 'Read me');

      expect((await api('GET', '/v1/projects', token)).status).toBe(200);
      expect((await api('GET', `/v1/projects/${project.id}`, token)).status).toBe(200);

      const writes: [string, string, unknown][] = [
        ['POST', '/v1/projects', { name: 'x', color: '#000' }],
        ['PATCH', `/v1/projects/${project.id}`, { name: 'y' }],
        ['DELETE', `/v1/projects/${project.id}`, undefined],
        ['POST', '/v1/schedules', { label: 'x', cronExpression: '* * * * *' }],
        ['PUT', `/v1/projects/${project.id}/schedules`, { schedules: [] }],
      ];
      for (const [method, path, body] of writes) {
        const { status, body: error } = await api(method, path, token, body);
        expect(status, `${method} ${path}`).toBe(403);
        expect(error.error).toBe('This token is read-only');
      }
      expect((await api('GET', `/v1/projects/${project.id}`, token)).body.name).toBe('Read me');
    });

    it('can still check for overlaps, which saves nothing', async () => {
      const { token } = await createToken(alice, { scope: 'read' });
      const { status } = await api('POST', '/v1/overlaps/check', token, { schedules: [{ cronExpression: '* * * * *' }] });
      expect(status).toBe(200);
    });
  });
});
