import { describe, it, expect, beforeAll } from 'vitest';
import { getDatabase } from '../src/db/connection';
import { openApiDocument } from '../src/openapi';
import v1Router from '../src/routes/v1';
import { runsPerSchedule } from '../src/routes/v1/timeline';
import { api, createProject, register, Session, setupTestServer } from './helpers';

setupTestServer();

const v1 = (method: string, path: string, token?: string, body?: unknown) => api(method, `/v1${path}`, token, body);

async function tokenFor(session: Session, options: object = {}): Promise<string> {
  const { status, body } = await api('POST', '/tokens', session.token, { name: 'test', scope: 'write', ...options });
  expect(status).toBe(201);
  return body.token;
}

async function createViaApi(token: string, schedule: object) {
  const { status, body } = await v1('POST', '/schedules', token, schedule);
  expect(status).toBe(201);
  return body as { id: string; projectId: string | null; color: string };
}

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

describe('API v1', () => {
  let owner: Session;
  let editor: Session;
  let viewer: Session;
  let outsider: Session;
  let ownerToken: string;
  let editorToken: string;
  let viewerToken: string;
  let outsiderToken: string;
  let shared: { id: string };

  beforeAll(async () => {
    await register('admin'); // the first user becomes admin
    owner = await register('owner');
    editor = await register('editor');
    viewer = await register('viewer');
    outsider = await register('outsider');
    [ownerToken, editorToken, viewerToken, outsiderToken] = await Promise.all(
      [owner, editor, viewer, outsider].map((session) => tokenFor(session))
    );

    shared = await createProject(owner, 'Shared');
    await api('POST', `/projects/${shared.id}/share`, owner.token, { identifier: 'editor', permission: 'edit' });
    await api('POST', `/projects/${shared.id}/share`, owner.token, { identifier: 'viewer', permission: 'view' });
  });

  describe('projects', () => {
    it("lists the user's projects with their role in each", async () => {
      const roleOf = async (token: string) =>
        ((await v1('GET', '/projects', token)).body as { id: string; role: string }[]).find((p) => p.id === shared.id)?.role;
      expect(await roleOf(ownerToken)).toBe('owner');
      expect(await roleOf(editorToken)).toBe('edit');
      expect(await roleOf(viewerToken)).toBe('view');
      expect(await roleOf(outsiderToken)).toBeUndefined();
    });

    it('returns a project to those who can see it only', async () => {
      const found = await v1('GET', `/projects/${shared.id}`, viewerToken);
      expect(found.status).toBe(200);
      expect(found.body).toMatchObject({ id: shared.id, name: 'Shared', role: 'view' });
      expect(found.body.createdAt).toMatch(ISO);

      expect((await v1('GET', `/projects/${shared.id}`, outsiderToken)).status).toBe(404);
      expect((await v1('GET', '/projects/does-not-exist', ownerToken)).status).toBe(404);
    });

    it('creates, updates and deletes projects under the same rules as the web app', async () => {
      const created = await v1('POST', '/projects', ownerToken, { name: 'Mine', color: '#abcdef' });
      expect(created.status).toBe(201);
      expect(created.body).toMatchObject({ name: 'Mine', role: 'owner', ownerId: owner.user.id });
      const id = created.body.id;

      await api('POST', `/projects/${id}/share`, owner.token, { identifier: 'editor', permission: 'edit' });
      await api('POST', `/projects/${id}/share`, owner.token, { identifier: 'viewer', permission: 'view' });

      expect((await v1('PATCH', `/projects/${id}`, viewerToken, { name: 'Nope' })).status).toBe(403);
      expect((await v1('PATCH', `/projects/${id}`, outsiderToken, { name: 'Nope' })).status).toBe(403);
      expect((await v1('PATCH', `/projects/${id}`, editorToken, { name: 'Renamed' })).body.name).toBe('Renamed');
      expect((await v1('PATCH', `/projects/${id}`, ownerToken, {})).status).toBe(400);
      expect((await v1('PATCH', '/projects/does-not-exist', ownerToken, { name: 'x' })).status).toBe(404);

      expect((await v1('DELETE', `/projects/${id}`, editorToken)).status).toBe(403);
      expect((await v1('DELETE', `/projects/${id}`, ownerToken)).status).toBe(204);
      expect((await v1('GET', `/projects/${id}`, ownerToken)).status).toBe(404);
    });

    it('explains what is wrong with a request', async () => {
      const { status, body } = await v1('POST', '/projects', ownerToken, { color: '#000' });
      expect(status).toBe(400);
      expect(body.error).toBe('Invalid input');
      expect(body.details[0].path).toEqual(['name']);
    });
  });

  describe('schedules', () => {
    it('creates a schedule with a default colour', async () => {
      const { status, body } = await v1('POST', '/schedules', ownerToken, {
        label: 'Nightly backup',
        cronExpression: '0 2 * * *',
        durationMinutes: 45,
      });
      expect(status).toBe(201);
      expect(body).toMatchObject({
        label: 'Nightly backup',
        cronExpression: '0 2 * * *',
        durationMinutes: 45,
        ownerId: owner.user.id,
        projectId: null,
        syncKey: null,
      });
      expect(body.color).toMatch(/^#[0-9A-F]{6}$/);
      expect(body.createdAt).toMatch(ISO);

      const fetched = await v1('GET', `/schedules/${body.id}`, ownerToken);
      expect(fetched.body).toEqual(body);
      expect((await v1('GET', `/schedules/${body.id}`, outsiderToken)).status).toBe(404);
    });

    it("shows the same schedules in the web app's list, with ISO timestamps", async () => {
      const schedule = await createViaApi(ownerToken, { label: 'Seen by both', cronExpression: '5 4 * * *' });
      const list = (await api('GET', '/schedules', owner.token)).body as { id: string; createdAt: string; syncKey: null }[];
      const found = list.find((s) => s.id === schedule.id);
      expect(found?.createdAt).toMatch(ISO);
      expect(found?.syncKey).toBeNull();
    });

    it('rejects invalid cron expressions, on both APIs', async () => {
      for (const cronExpression of ['not a cron', '* * * * * *', '61 * * * *', '@secondly']) {
        const viaToken = await v1('POST', '/schedules', ownerToken, { label: 'Bad', cronExpression });
        expect(viaToken.status, cronExpression).toBe(400);
        expect(viaToken.body.error).toBe('Invalid cron expression');

        const viaLogin = await api('POST', '/schedules', owner.token, { label: 'Bad', cronExpression, color: '#000' });
        expect(viaLogin.status, cronExpression).toBe(400);
      }

      const schedule = await createViaApi(ownerToken, { label: 'Valid', cronExpression: '* * * * *' });
      expect((await v1('PATCH', `/schedules/${schedule.id}`, ownerToken, { cronExpression: 'nope' })).status).toBe(400);
      expect((await api('PUT', `/schedules/${schedule.id}`, owner.token, { cronExpression: 'nope' })).status).toBe(400);
    });

    it('lets schedules saved with an invalid expression be renamed', async () => {
      getDatabase()
        .prepare("INSERT INTO schedules (id, owner_id, label, cron_expression, color) VALUES ('legacy', ?, 'Legacy', '* * * * * *', '#000')")
        .run(owner.user.id);

      expect((await v1('PATCH', '/schedules/legacy', ownerToken, { label: 'Renamed' })).status).toBe(200);
      expect((await v1('PATCH', '/schedules/legacy', ownerToken, { label: 'Again', cronExpression: '* * * * * *' })).status).toBe(200);
      expect((await v1('PATCH', '/schedules/legacy', ownerToken, { cronExpression: '* * * * * * *' })).status).toBe(400);
    });

    it('applies the sharing rules of the web app', async () => {
      const own = await createViaApi(ownerToken, { label: 'Owner job', cronExpression: '0 * * * *', projectId: shared.id });
      const byEditor = await createViaApi(editorToken, { label: 'Editor job', cronExpression: '30 * * * *', projectId: shared.id });

      // Viewers can see but not add or change
      expect((await v1('GET', `/schedules/${own.id}`, viewerToken)).status).toBe(200);
      expect((await v1('POST', '/schedules', viewerToken, { label: 'x', cronExpression: '* * * * *', projectId: shared.id })).status).toBe(403);
      expect((await v1('PATCH', `/schedules/${own.id}`, viewerToken, { label: 'x' })).status).toBe(403);

      // Editors can change schedules in the project, but not move or delete other people's
      expect((await v1('PATCH', `/schedules/${own.id}`, editorToken, { label: 'Edited' })).body.label).toBe('Edited');
      expect((await v1('PATCH', `/schedules/${own.id}`, editorToken, { projectId: null })).status).toBe(403);
      expect((await v1('DELETE', `/schedules/${own.id}`, editorToken)).status).toBe(403);

      // The project's owner sees what editors add, and may delete only their own schedules
      expect((await v1('GET', `/schedules/${byEditor.id}`, ownerToken)).status).toBe(200);
      expect((await v1('DELETE', `/schedules/${byEditor.id}`, ownerToken)).status).toBe(403);
      expect((await v1('DELETE', `/schedules/${byEditor.id}`, editorToken)).status).toBe(204);

      expect((await v1('PATCH', `/schedules/${own.id}`, outsiderToken, { label: 'x' })).status).toBe(403);
      expect((await v1('PATCH', '/schedules/does-not-exist', ownerToken, { label: 'x' })).status).toBe(404);
      expect((await v1('DELETE', `/schedules/${own.id}`, ownerToken)).status).toBe(204);
    });

    it('lists schedules, optionally of one project', async () => {
      const project = await createProject(owner, 'Filtered');
      const inside = await createViaApi(ownerToken, { label: 'Inside', cronExpression: '1 * * * *', projectId: project.id });
      const outside = await createViaApi(ownerToken, { label: 'Outside', cronExpression: '2 * * * *' });

      const all = (await v1('GET', '/schedules', ownerToken)).body as { id: string }[];
      expect(all.map((s) => s.id)).toEqual(expect.arrayContaining([inside.id, outside.id]));

      const filtered = (await v1('GET', `/schedules?projectId=${project.id}`, ownerToken)).body as { id: string }[];
      expect(filtered.map((s) => s.id)).toEqual([inside.id]);
      expect((await v1('GET', '/schedules?projectId=', ownerToken)).status).toBe(400);
    });
  });

  describe('tokens limited to a project', () => {
    let home: { id: string };
    let elsewhere: { id: string };
    let inHome: { id: string };
    let inElsewhere: { id: string };
    let limited: string;

    beforeAll(async () => {
      home = await createProject(owner, 'Home');
      elsewhere = await createProject(owner, 'Elsewhere');
      inHome = await createViaApi(ownerToken, { label: 'At home', cronExpression: '3 * * * *', projectId: home.id });
      inElsewhere = await createViaApi(ownerToken, { label: 'Away', cronExpression: '4 * * * *', projectId: elsewhere.id });
      limited = await tokenFor(owner, { projectId: home.id });
    });

    it('only sees its project and the schedules in it', async () => {
      const projects = (await v1('GET', '/projects', limited)).body as { id: string }[];
      expect(projects.map((p) => p.id)).toEqual([home.id]);

      const schedules = (await v1('GET', '/schedules', limited)).body as { id: string }[];
      expect(schedules.map((s) => s.id)).toEqual([inHome.id]);
      expect((await v1('GET', `/schedules/${inHome.id}`, limited)).status).toBe(200);
    });

    it('treats everything else as missing', async () => {
      expect((await v1('GET', `/projects/${elsewhere.id}`, limited)).status).toBe(404);
      expect((await v1('PATCH', `/projects/${elsewhere.id}`, limited, { name: 'x' })).status).toBe(404);
      expect((await v1('GET', `/schedules/${inElsewhere.id}`, limited)).status).toBe(404);
      expect((await v1('PATCH', `/schedules/${inElsewhere.id}`, limited, { label: 'x' })).status).toBe(404);
      expect((await v1('DELETE', `/schedules/${inElsewhere.id}`, limited)).status).toBe(404);
      expect((await v1('GET', `/schedules?projectId=${elsewhere.id}`, limited)).status).toBe(404);
      expect((await v1('PUT', `/projects/${elsewhere.id}/schedules`, limited, { schedules: [] })).status).toBe(404);
      expect((await v1('GET', `/runs?scheduleId=${inElsewhere.id}`, limited)).status).toBe(404);
    });

    it('cannot create or delete projects', async () => {
      expect((await v1('POST', '/projects', limited, { name: 'New', color: '#000' })).status).toBe(403);
      expect((await v1('DELETE', `/projects/${home.id}`, limited)).status).toBe(403);
    });

    it('creates schedules in its project, and nowhere else', async () => {
      const created = await createViaApi(limited, { label: 'Default home', cronExpression: '5 * * * *' });
      expect(created.projectId).toBe(home.id);

      const elsewhereAttempt = await v1('POST', '/schedules', limited, { label: 'x', cronExpression: '5 * * * *', projectId: elsewhere.id });
      expect(elsewhereAttempt.status).toBe(403);
      const unassignedAttempt = await v1('POST', '/schedules', limited, { label: 'x', cronExpression: '5 * * * *', projectId: null });
      expect(unassignedAttempt.status).toBe(403);
    });

    it('cannot move schedules out of its project', async () => {
      expect((await v1('PATCH', `/schedules/${inHome.id}`, limited, { projectId: elsewhere.id })).status).toBe(403);
      expect((await v1('PATCH', `/schedules/${inHome.id}`, limited, { projectId: null })).status).toBe(403);
      expect((await v1('PATCH', `/schedules/${inHome.id}`, limited, { projectId: home.id, label: 'Still home' })).body.label).toBe('Still home');
    });

    it('calculates runs and overlaps for its project only', async () => {
      const range = 'from=2026-01-15T00:00:00Z&to=2026-01-15T02:00:00Z';
      const runs = (await v1('GET', `/runs?${range}`, limited)).body.runs as { scheduleId: string }[];
      const scheduleIds = runs.map((r) => r.scheduleId);
      expect(scheduleIds).toContain(inHome.id);
      expect(scheduleIds).not.toContain(inElsewhere.id);
    });
  });

  describe('syncing a project', () => {
    const backup = { key: 'backup', label: 'Backup', cronExpression: '0 2 * * *', durationMinutes: 30 };
    const report = { key: 'report', label: 'Report', cronExpression: '0 6 * * 1' };

    async function freshProject(name: string) {
      const project = await createProject(owner, name);
      await api('POST', `/projects/${project.id}/share`, owner.token, { identifier: 'editor', permission: 'edit' });
      await api('POST', `/projects/${project.id}/share`, owner.token, { identifier: 'viewer', permission: 'view' });
      return project;
    }

    const sync = (token: string, projectId: string, schedules: object[], query = '') =>
      v1('PUT', `/projects/${projectId}/schedules${query}`, token, { schedules });
    const schedulesIn = async (token: string, projectId: string) =>
      (await v1('GET', `/schedules?projectId=${projectId}`, token)).body as {
        id: string; label: string; syncKey: string | null; color: string; cronExpression: string; updatedAt: string; ownerId: string;
      }[];

    it('creates what is missing, and does nothing the second time', async () => {
      const project = await freshProject('Synced');

      const first = await sync(ownerToken, project.id, [backup, report]);
      expect(first.status).toBe(200);
      expect(first.body).toEqual({ dryRun: false, created: ['backup', 'report'], updated: [], deleted: [], unchanged: [] });

      const before = await schedulesIn(ownerToken, project.id);
      expect(before.map((s) => s.syncKey).sort()).toEqual(['backup', 'report']);
      expect(before.find((s) => s.syncKey === 'backup')).toMatchObject({ label: 'Backup', cronExpression: '0 2 * * *', ownerId: owner.user.id });

      const second = await sync(ownerToken, project.id, [backup, report]);
      expect(second.body).toEqual({ dryRun: false, created: [], updated: [], deleted: [], unchanged: ['backup', 'report'] });
      expect(await schedulesIn(ownerToken, project.id)).toEqual(before);
    });

    it('updates what changed and deletes what is gone', async () => {
      const project = await freshProject('Changing');
      await sync(ownerToken, project.id, [backup, report]);
      const ids = Object.fromEntries((await schedulesIn(ownerToken, project.id)).map((s) => [s.syncKey, s.id]));

      const changed = await sync(ownerToken, project.id, [{ ...backup, cronExpression: '30 3 * * *', label: 'Backup (new)' }, report]);
      expect(changed.body).toMatchObject({ created: [], updated: ['backup'], deleted: [], unchanged: ['report'] });
      const afterChange = await schedulesIn(ownerToken, project.id);
      expect(afterChange.find((s) => s.syncKey === 'backup')).toMatchObject({ id: ids.backup, label: 'Backup (new)', cronExpression: '30 3 * * *' });

      const shorter = await sync(ownerToken, project.id, [report]);
      expect(shorter.body).toMatchObject({ created: [], updated: [], deleted: ['backup'], unchanged: ['report'] });
      expect((await schedulesIn(ownerToken, project.id)).map((s) => s.id)).toEqual([ids.report]);

      const empty = await sync(ownerToken, project.id, []);
      expect(empty.body.deleted).toEqual(['report']);
      expect(await schedulesIn(ownerToken, project.id)).toEqual([]);
    });

    it('only changes the colour when one is sent', async () => {
      const project = await freshProject('Colours');
      await sync(ownerToken, project.id, [backup]);
      const original = (await schedulesIn(ownerToken, project.id))[0].color;
      expect(original).toMatch(/^#[0-9A-F]{6}$/);

      expect((await sync(ownerToken, project.id, [backup])).body.unchanged).toEqual(['backup']);

      const recoloured = await sync(ownerToken, project.id, [{ ...backup, color: '#ff0000' }]);
      expect(recoloured.body.updated).toEqual(['backup']);
      expect((await schedulesIn(ownerToken, project.id))[0].color).toBe('#ff0000');

      expect((await sync(ownerToken, project.id, [backup])).body.unchanged).toEqual(['backup']);
      expect((await schedulesIn(ownerToken, project.id))[0].color).toBe('#ff0000');
    });

    it('reports a dry run without changing anything', async () => {
      const project = await freshProject('Dry');

      const preview = await sync(ownerToken, project.id, [backup, report], '?dryRun=true');
      expect(preview.body).toEqual({ dryRun: true, created: ['backup', 'report'], updated: [], deleted: [], unchanged: [] });
      expect(await schedulesIn(ownerToken, project.id)).toEqual([]);

      await sync(ownerToken, project.id, [backup, report]);
      const before = await schedulesIn(ownerToken, project.id);
      const preview2 = await sync(ownerToken, project.id, [{ ...backup, label: 'Other' }], '?dryRun=true');
      expect(preview2.body).toEqual({ dryRun: true, created: [], updated: ['backup'], deleted: ['report'], unchanged: [] });
      expect(await schedulesIn(ownerToken, project.id)).toEqual(before);

      expect((await sync(ownerToken, project.id, [], '?dryRun=maybe')).status).toBe(400);
    });

    it('applies nothing when an entry is invalid', async () => {
      const project = await freshProject('Strict');
      await sync(ownerToken, project.id, [backup]);
      const before = await schedulesIn(ownerToken, project.id);

      const duplicate = await sync(ownerToken, project.id, [backup, { ...report, key: 'backup' }]);
      expect(duplicate.status).toBe(400);
      expect(duplicate.body.error).toBe('Duplicate key "backup"');

      const badCron = await sync(ownerToken, project.id, [{ ...backup, label: 'Changed' }, { ...report, cronExpression: 'soon' }]);
      expect(badCron.status).toBe(400);
      expect(badCron.body.error).toContain('"report"');

      expect((await sync(ownerToken, project.id, [{ key: '', label: 'x', cronExpression: '* * * * *' }])).status).toBe(400);
      expect((await v1('PUT', `/projects/${project.id}/schedules`, ownerToken, {})).status).toBe(400);

      expect(await schedulesIn(ownerToken, project.id)).toEqual(before);
    });

    it("leaves schedules it doesn't manage alone", async () => {
      const project = await freshProject('Mixed');
      const manual = await createViaApi(ownerToken, { label: 'Made in the app', cronExpression: '9 * * * *', projectId: project.id });

      await sync(ownerToken, project.id, [backup]);
      await sync(editorToken, project.id, [{ ...backup, label: 'Editors backup' }]);
      expect((await schedulesIn(ownerToken, project.id)).length).toBe(3);

      const cleared = await sync(ownerToken, project.id, []);
      expect(cleared.body.deleted).toEqual(['backup']);

      const remaining = await schedulesIn(ownerToken, project.id);
      expect(remaining.map((s) => s.label).sort()).toEqual(['Editors backup', 'Made in the app']);
      expect(remaining.find((s) => s.id === manual.id)?.syncKey).toBeNull();
      expect(remaining.find((s) => s.label === 'Editors backup')?.ownerId).toBe(editor.user.id);
    });

    it('needs edit access to the project', async () => {
      const project = await freshProject('Guarded');
      expect((await sync(viewerToken, project.id, [backup])).status).toBe(403);
      expect((await sync(outsiderToken, project.id, [backup])).status).toBe(403);
      expect((await sync(editorToken, project.id, [backup])).status).toBe(200);
      expect((await sync(ownerToken, 'does-not-exist', [backup])).status).toBe(404);
    });

    it('stops managing a schedule that leaves its project', async () => {
      const project = await freshProject('Leaving');
      const other = await createProject(owner, 'Destination');
      await sync(ownerToken, project.id, [backup]);
      const synced = (await schedulesIn(ownerToken, project.id))[0];

      // Moved in the web app
      expect((await api('PUT', `/schedules/${synced.id}`, owner.token, { projectId: other.id })).body.syncKey).toBeNull();
      expect((await sync(ownerToken, project.id, [backup])).body.created).toEqual(['backup']);
      expect((await schedulesIn(ownerToken, other.id)).map((s) => s.id)).toEqual([synced.id]);

      // Its project deleted
      const doomed = await freshProject('Doomed');
      await sync(ownerToken, doomed.id, [report]);
      const orphan = (await schedulesIn(ownerToken, doomed.id))[0];
      await api('DELETE', `/projects/${doomed.id}`, owner.token);
      expect((await v1('GET', `/schedules/${orphan.id}`, ownerToken)).body).toMatchObject({ projectId: null, syncKey: null });
    });
  });

  describe('runs and overlaps', () => {
    let planner: Session;
    let token: string;
    let hourly: { id: string };
    let halfPast: { id: string };
    let daily: { id: string };

    beforeAll(async () => {
      planner = await register('planner');
      token = await tokenFor(planner);
      hourly = await createViaApi(token, { label: 'Hourly', cronExpression: '0 * * * *', durationMinutes: 30 });
      halfPast = await createViaApi(token, { label: 'Quarter past', cronExpression: '15 * * * *', durationMinutes: 30 });
      daily = await createViaApi(token, { label: 'Daily at nine', cronExpression: '0 9 * * *' });
    });

    const starts = (runs: { start: string }[]) => runs.map((r) => r.start);

    describe('GET /runs', () => {
      it('lists the runs in the range, including its start and excluding its end', async () => {
        const { status, body } = await v1('GET', `/runs?scheduleId=${hourly.id}&from=2026-01-15T00:00:00Z&to=2026-01-15T03:00:00Z`, token);
        expect(status).toBe(200);
        expect(starts(body.runs)).toEqual(['2026-01-15T00:00:00.000Z', '2026-01-15T01:00:00.000Z', '2026-01-15T02:00:00.000Z']);
        expect(body.runs[0]).toEqual({
          scheduleId: hourly.id,
          label: 'Hourly',
          start: '2026-01-15T00:00:00.000Z',
          end: '2026-01-15T00:30:00.000Z',
        });
        expect(body).toMatchObject({ from: '2026-01-15T00:00:00.000Z', to: '2026-01-15T03:00:00.000Z', timezone: 'UTC', truncatedScheduleIds: [] });
      });

      it('accepts offsets and defaults to the next 24 hours', async () => {
        const offset = await v1('GET', `/runs?scheduleId=${hourly.id}&from=2026-01-15T01:00:00%2B01:00&to=2026-01-15T00:30:00Z`, token);
        expect(starts(offset.body.runs)).toEqual(['2026-01-15T00:00:00.000Z']);

        const defaults = await v1('GET', `/runs?scheduleId=${daily.id}`, token);
        expect(defaults.body.runs.length).toBeGreaterThanOrEqual(1);
        expect(Date.parse(defaults.body.to) - Date.parse(defaults.body.from)).toBe(24 * 60 * 60 * 1000);
      });

      it('reads expressions in the requested time zone', async () => {
        const run = async (from: string, tz?: string) => {
          const query = `scheduleId=${daily.id}&from=${from}${tz ? `&tz=${encodeURIComponent(tz)}` : ''}`;
          return (await v1('GET', `/runs?${query}`, token)).body;
        };
        expect(starts((await run('2026-01-15T00:00:00Z')).runs)).toEqual(['2026-01-15T09:00:00.000Z']);
        expect(starts((await run('2026-01-15T00:00:00Z', 'Europe/Stockholm')).runs)).toEqual(['2026-01-15T08:00:00.000Z']);
        expect(starts((await run('2026-07-15T00:00:00Z', 'Europe/Stockholm')).runs)).toEqual(['2026-07-15T07:00:00.000Z']);
        expect((await run('2026-01-15T00:00:00Z', 'Europe/Stockholm')).timezone).toBe('Europe/Stockholm');
      });

      it('rejects ranges, time zones and limits that make no sense', async () => {
        const bad = async (query: string) => (await v1('GET', `/runs?${query}`, token)).status;
        expect(await bad('from=2026-01-15T03:00:00Z&to=2026-01-15T03:00:00Z')).toBe(400);
        expect(await bad('from=2026-01-15T03:00:00Z&to=2026-01-15T02:00:00Z')).toBe(400);
        expect(await bad('from=2026-01-01T00:00:00Z&to=2027-01-03T00:00:00Z')).toBe(400); // 367 days
        expect(await bad('from=2026-01-01T00:00:00Z&to=2027-01-02T00:00:00Z')).toBe(200); // 366 days
        expect(await bad('from=2026-01-15T03:00:00')).toBe(400); // no offset
        expect(await bad('from=yesterday')).toBe(400);
        expect(await bad('tz=Mars/Phobos')).toBe(400);
        expect(await bad('limit=0')).toBe(400);
        expect(await bad('limit=10001')).toBe(400);
        expect(await bad('limit=lots')).toBe(400);
        expect(await bad('scheduleId=does-not-exist')).toBe(404);
      });

      it('caps the runs per schedule and says which schedules were cut off', async () => {
        const busy = await register('busy');
        const busyToken = await tokenFor(busy);
        const everyMinute = await createViaApi(busyToken, { label: 'Every minute', cronExpression: '* * * * *' });
        const range = 'from=2026-01-15T00:00:00Z&to=2026-01-15T01:00:00Z';

        const capped = (await v1('GET', `/runs?${range}&limit=5`, busyToken)).body;
        expect(capped.runs.length).toBe(5);
        expect(capped.truncatedScheduleIds).toEqual([everyMinute.id]);

        const complete = (await v1('GET', `/runs?${range}&limit=60`, busyToken)).body;
        expect(complete.runs.length).toBe(60);
        expect(complete.truncatedScheduleIds).toEqual([]);

        const next = (await v1('GET', `/runs?scheduleId=${everyMinute.id}&from=2026-01-15T00:00:30Z&limit=1`, busyToken)).body;
        expect(starts(next.runs)).toEqual(['2026-01-15T00:01:00.000Z']);
      });
    });

    describe('GET /overlaps', () => {
      it('finds the periods where schedules run at the same time', async () => {
        const { status, body } = await v1('GET', '/overlaps?from=2026-01-15T00:00:00Z&to=2026-01-15T02:00:00Z', token);
        expect(status).toBe(200);
        expect(body.overlaps).toEqual([
          { start: '2026-01-15T00:15:00.000Z', end: '2026-01-15T00:30:00.000Z', scheduleIds: expect.arrayContaining([hourly.id, halfPast.id]), count: 2 },
          { start: '2026-01-15T01:15:00.000Z', end: '2026-01-15T01:30:00.000Z', scheduleIds: expect.arrayContaining([hourly.id, halfPast.id]), count: 2 },
        ]);
        expect(body.truncatedScheduleIds).toEqual([]);
      });

      it('does not count runs that follow each other as overlapping', async () => {
        const sequencer = await register('sequencer');
        const sequencerToken = await tokenFor(sequencer);
        await createViaApi(sequencerToken, { label: 'First', cronExpression: '0 * * * *', durationMinutes: 15 });
        await createViaApi(sequencerToken, { label: 'Second', cronExpression: '15 * * * *', durationMinutes: 15 });

        const { body } = await v1('GET', '/overlaps?from=2026-01-15T00:00:00Z&to=2026-01-15T02:00:00Z', sequencerToken);
        expect(body.overlaps).toEqual([]);
      });

      it('limits the range to 31 days', async () => {
        expect((await v1('GET', '/overlaps?from=2026-01-01T00:00:00Z&to=2026-02-01T00:00:00Z', token)).status).toBe(200);
        expect((await v1('GET', '/overlaps?from=2026-01-01T00:00:00Z&to=2026-02-01T00:00:01Z', token)).status).toBe(400);
      });
    });

    describe('POST /overlaps/check', () => {
      const range = { from: '2026-01-15T00:00:00Z', to: '2026-01-15T02:00:00Z' };

      it('reports the existing schedules that new ones would overlap with', async () => {
        const before = (await v1('GET', '/schedules', token)).body.length;
        const { status, body } = await v1('POST', '/overlaps/check', token, {
          ...range,
          schedules: [{ label: 'Planned', cronExpression: '10 * * * *', durationMinutes: 10 }, { cronExpression: '45 * * * *', durationMinutes: 5 }],
        });
        expect(status).toBe(200);
        expect(body.hasOverlap).toBe(true);
        // 00:10-00:20 overlaps "Hourly" (00:00-00:30); the 00:45 run touches nothing
        expect(body.overlaps[0]).toEqual({
          start: '2026-01-15T00:10:00.000Z',
          end: '2026-01-15T00:15:00.000Z',
          scheduleIds: [hourly.id],
          candidates: [0],
          count: 2,
        });
        expect(body.overlaps.every((o: { candidates: number[] }) => !o.candidates.includes(1))).toBe(true);
        expect(body.truncatedCandidates).toEqual([]);

        // Nothing was saved
        expect((await v1('GET', '/schedules', token)).body.length).toBe(before);
      });

      it('reports no overlap when there is none', async () => {
        const { body } = await v1('POST', '/overlaps/check', token, { ...range, schedules: [{ cronExpression: '50 * * * *', durationMinutes: 5 }] });
        expect(body).toMatchObject({ hasOverlap: false, overlaps: [] });
      });

      it('reports new schedules that overlap each other', async () => {
        const { body } = await v1('POST', '/overlaps/check', token, {
          ...range,
          projectId: (await createProject(planner, 'Empty')).id,
          schedules: [{ cronExpression: '0 * * * *', durationMinutes: 20 }, { cronExpression: '10 * * * *', durationMinutes: 20 }],
        });
        expect(body.hasOverlap).toBe(true);
        expect(body.overlaps[0]).toMatchObject({ scheduleIds: [], candidates: expect.arrayContaining([0, 1]), count: 2 });
      });

      it('rejects invalid input', async () => {
        const bad = async (body: object) => (await v1('POST', '/overlaps/check', token, body)).status;
        expect(await bad({ schedules: [] })).toBe(400);
        expect(await bad({})).toBe(400);
        expect(await bad({ schedules: [{ cronExpression: 'soon' }] })).toBe(400);
        expect(await bad({ schedules: [{ cronExpression: '* * * * *' }], tz: 'Mars/Phobos' })).toBe(400);
        expect(await bad({ schedules: Array.from({ length: 51 }, () => ({ cronExpression: '* * * * *' })) })).toBe(400);
        expect(await bad({ schedules: [{ cronExpression: '* * * * *' }], ...range, to: range.from })).toBe(400);
      });
    });
  });

  describe('limits', () => {
    it('lowers the runs per schedule when there are many schedules', () => {
      expect(runsPerSchedule(1000, 5)).toBe(1000);
      expect(runsPerSchedule(10000, 10)).toBe(10000);
      expect(runsPerSchedule(10000, 20)).toBe(5000);
      expect(runsPerSchedule(10000, 1000)).toBe(100);
      expect(runsPerSchedule(10000, 1_000_000)).toBe(1);
      expect(runsPerSchedule(10000, 0)).toBe(10000);
    });
  });

  describe('OpenAPI document', () => {
    it('is served without a token', async () => {
      const { status, body } = await v1('GET', '/openapi.json');
      expect(status).toBe(200);
      expect(body.openapi).toBe('3.1.0');
      expect(body.paths['/schedules']).toBeDefined();
    });

    // Every route sits on the one router, so the document can be checked against it
    const routerRoutes: { method: string; path: string }[] = (v1Router as any).stack
      .filter((layer: any) => layer.route)
      .flatMap((layer: any) =>
        Object.keys(layer.route.methods).map((method) => ({ method: method.toUpperCase(), path: layer.route.path as string }))
      );

    it('describes exactly the routes the API has', () => {
      const expected = routerRoutes.map(({ method, path }) => `${method} ${path.replace(/:(\w+)/g, '{$1}')}`).sort();
      const documented = Object.entries(openApiDocument.paths as Record<string, Record<string, unknown>>)
        .flatMap(([path, operations]) => Object.keys(operations).map((method) => `${method.toUpperCase()} ${path}`))
        .sort();
      expect(documented).toEqual(expected);
    });

    it('gives every operation a distinct id', () => {
      const ids = Object.values(openApiDocument.paths as Record<string, Record<string, { operationId: string }>>)
        .flatMap((operations) => Object.values(operations).map((operation) => operation.operationId));
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('keeps every route that changes something away from read-only tokens', async () => {
      const readOnly = await tokenFor(owner, { scope: 'read' });
      const changing = routerRoutes.filter(({ method, path }) => method !== 'GET' && path !== '/overlaps/check');
      expect(changing.length).toBeGreaterThan(5);

      for (const { method, path } of changing) {
        const { status } = await v1(method, path.replace(/:(\w+)/g, 'x'), readOnly, {});
        expect(status, `${method} ${path}`).toBe(403);
      }
    });
  });
});
