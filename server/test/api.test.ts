import { describe, it, expect, beforeAll, vi } from 'vitest';
import bcrypt from 'bcryptjs';
import { getDatabase } from '../src/db/connection';
import { errorHandler } from '../src/middleware/errorHandler';
import { api, createProject, createSchedule, register, Session, setupTestServer } from './helpers';

// Runs against an in-memory SQLite database (DB_PATH=':memory:' in vitest.config.ts)

setupTestServer();

const labelsFor = async (session: Session) =>
  ((await api('GET', '/schedules', session.token)).body as { label: string }[]).map((s) => s.label).sort();

describe('API', () => {
  let admin: Session;
  let owner: Session;
  let editor: Session;
  let viewer: Session;

  beforeAll(async () => {
    admin = await register('admin'); // first user becomes admin
    owner = await register('owner');
    editor = await register('editor');
    viewer = await register('viewer');
  });

  describe('updates', () => {
    it('renames a schedule', async () => {
      const schedule = await createSchedule(owner, 'Before');
      const { status, body } = await api('PUT', `/schedules/${schedule.id}`, owner.token, { label: 'After' });
      expect(status).toBe(200);
      expect(body.label).toBe('After');
    });

    it('renames a project', async () => {
      const project = await createProject(owner, 'Old name');
      const { status, body } = await api('PUT', `/projects/${project.id}`, owner.token, { name: 'New name' });
      expect(status).toBe(200);
      expect(body.name).toBe('New name');
    });

    it('lets an admin change roles', async () => {
      const target = await register('promotable');
      const { status, body } = await api('PUT', `/admin/users/${target.user.id}`, admin.token, { role: 'admin' });
      expect(status).toBe(200);
      expect(body.role).toBe('admin');
    });

    it('returns 404 for an unknown project so clients can create it instead', async () => {
      const { status } = await api('PUT', '/projects/does-not-exist', owner.token, { name: 'x' });
      expect(status).toBe(404);
    });
  });

  it('creates a schedule with projectId: null', async () => {
    const schedule = await createSchedule(owner, 'Unassigned job', null);
    expect(schedule.projectId).toBeNull();
  });

  describe('identifier lookups', () => {
    it('rejects usernames containing "@"', async () => {
      const { status } = await api('POST', '/auth/register', undefined, {
        username: 'someone@example.com',
        email: 'someone-else@example.com',
        password: 'secret123',
      });
      expect(status).toBe(400);
    });

    it('resolves an email to its owner even if another username equals it', async () => {
      const victim = await register('victim', 'victim-pass');
      // A username like this could only exist from before usernames were restricted
      getDatabase()
        .prepare("INSERT INTO users (id, username, email, password_hash, role) VALUES (?, ?, ?, ?, 'user')")
        .run('legacy-user', victim.user.email, 'mallory@example.com', bcrypt.hashSync('mallory-pass', 4));

      const login = await api('POST', '/auth/login', undefined, { identifier: victim.user.email, password: 'victim-pass' });
      expect(login.status).toBe(200);
      expect(login.body.user.id).toBe(victim.user.id);

      const project = await createProject(owner, 'For victim');
      const share = await api('POST', `/projects/${project.id}/share`, owner.token, {
        identifier: victim.user.email,
        permission: 'edit',
      });
      expect(share.status).toBe(201);
      expect(share.body.userId).toBe(victim.user.id);
    });
  });

  describe('sessions', () => {
    const setUser = (id: string, column: 'role' | 'is_active', value: string | number) =>
      getDatabase().prepare(`UPDATE users SET ${column} = ? WHERE id = ?`).run(value, id);

    it('rejects tokens of disabled accounts', async () => {
      const user = await register('disabled');
      setUser(user.user.id, 'is_active', 0);
      expect((await api('GET', '/schedules', user.token)).status).toBe(401);
    });

    it('applies a demotion to existing tokens', async () => {
      const user = await register('demoted');
      setUser(user.user.id, 'role', 'admin');
      const adminToken = (await api('POST', '/auth/login', undefined, { identifier: 'demoted', password: 'secret123' })).body.token;
      expect((await api('GET', '/admin/users', adminToken)).status).toBe(200);
      setUser(user.user.id, 'role', 'user');
      expect((await api('GET', '/admin/users', adminToken)).status).toBe(403);
    });

    it('rejects tokens of deleted accounts', async () => {
      const user = await register('deleted');
      await api('DELETE', `/admin/users/${user.user.id}`, admin.token);
      expect((await api('POST', '/schedules', user.token, { label: 'x', cronExpression: '* * * * *', color: '#000' })).status).toBe(401);
    });
  });

  describe('shared projects', () => {
    let project: { id: string };

    beforeAll(async () => {
      project = await createProject(owner, 'Shared');
      await api('POST', `/projects/${project.id}/share`, owner.token, { identifier: 'editor', permission: 'edit' });
      await api('POST', `/projects/${project.id}/share`, owner.token, { identifier: 'viewer', permission: 'view' });
    });

    it('shows the project owner schedules that editors add', async () => {
      await createSchedule(editor, 'Added by editor', project.id);
      expect(await labelsFor(owner)).toContain('Added by editor');
      expect(await labelsFor(viewer)).toContain('Added by editor');
    });

    it('rejects /sync into projects the user cannot edit', async () => {
      const outsider = await register('outsider');
      const { status } = await api('POST', '/schedules/sync', outsider.token, {
        schedules: [{ id: 'injected', label: 'Injected', cronExpression: '* * * * *', color: '#f00', projectId: project.id }],
      });
      expect(status).toBe(403);
      expect(await labelsFor(viewer)).not.toContain('Injected');
    });

    it("lets editors rename but not move the owner's schedules", async () => {
      const schedule = await createSchedule(owner, 'Owned', project.id);
      const elsewhere = await createProject(editor, 'Editor project');

      const move = await api('PUT', `/schedules/${schedule.id}`, editor.token, { projectId: elsewhere.id });
      expect(move.status).toBe(403);
      const unassign = await api('PUT', `/schedules/${schedule.id}`, editor.token, { projectId: null });
      expect(unassign.status).toBe(403);

      const rename = await api('PUT', `/schedules/${schedule.id}`, editor.token, { label: 'Renamed', projectId: project.id });
      expect(rename.status).toBe(200);
    });

    it('lets owners edit their schedule in a project they can only view', async () => {
      const project2 = await createProject(owner, 'Downgraded');
      await api('POST', `/projects/${project2.id}/share`, owner.token, { identifier: 'editor', permission: 'edit' });
      const schedule = await createSchedule(editor, 'Mine', project2.id);
      await api('POST', `/projects/${project2.id}/share`, owner.token, { identifier: 'editor', permission: 'view' });

      const { status } = await api('PUT', `/schedules/${schedule.id}`, editor.token, { label: 'Still mine', projectId: project2.id });
      expect(status).toBe(200);
    });
  });

  describe('id collisions', () => {
    it('returns 409 for an existing schedule id', async () => {
      const schedule = await createSchedule(owner, 'Original');
      const { status } = await api('POST', '/schedules', viewer.token, {
        id: schedule.id,
        label: 'Clash',
        cronExpression: '* * * * *',
        color: '#000',
      });
      expect(status).toBe(409);
    });

    it('returns 409 for an existing project id', async () => {
      const project = await createProject(owner, 'Original');
      const { status } = await api('POST', '/projects', viewer.token, { id: project.id, name: 'Clash', color: '#000' });
      expect(status).toBe(409);
    });

    it('returns 409 when /sync reuses another user\'s schedule id', async () => {
      const schedule = await createSchedule(owner, 'Original');
      const { status } = await api('POST', '/schedules/sync', viewer.token, {
        schedules: [{ id: schedule.id, label: 'Clash', cronExpression: '* * * * *', color: '#000' }],
      });
      expect(status).toBe(409);
    });
  });
});

describe('errorHandler', () => {
  const respond = (err: Error & { statusCode?: number }) => {
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    vi.spyOn(console, 'error').mockImplementation(() => {});
    errorHandler(err, {} as never, res as never, vi.fn());
    return res;
  };

  it('hides internal error messages', () => {
    const res = respond(new Error('no such column: secret_internal_detail'));
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
  });

  it('keeps client error messages', () => {
    const res = respond(Object.assign(new Error('Unexpected token in JSON'), { statusCode: 400 }));
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unexpected token in JSON' });
  });
});

describe('config', () => {
  it('refuses placeholder JWT secrets in production', async () => {
    vi.resetModules();
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('JWT_SECRET', 'change-this-in-production');
    await expect(import('../src/config')).rejects.toThrow(/JWT_SECRET/);
    vi.unstubAllEnvs();
  });
});
