// OpenAPI description of /api/v1, served at GET /api/v1/openapi.json.
// A test checks that it lists exactly the routes the router has.

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const jsonBody = (schema: object, required = true) => ({ required, content: { 'application/json': { schema } } });
const jsonResponse = (description: string, schema: object) => ({ description, content: { 'application/json': { schema } } });
const errorResponse = (name: string) => ({ $ref: `#/components/responses/${name}` });
const array = (items: object) => ({ type: 'array', items });
const nullable = (type: string, extra: object = {}) => ({ type: [type, 'null'], ...extra });
const string = (description?: string, extra: object = {}) => ({ type: 'string', ...(description ? { description } : {}), ...extra });
const dateTime = (description?: string) => string(description, { format: 'date-time' });

const idPath = { name: 'id', in: 'path', required: true, schema: { type: 'string' } };
const query = (name: string, schema: object, description: string) => ({ name, in: 'query', required: false, schema, description });

const rangeParameters = [
  query('from', { type: 'string', format: 'date-time' }, 'Start of the range, inclusive. ISO 8601 with an offset or Z. Default: now.'),
  query('to', { type: 'string', format: 'date-time' }, 'End of the range, exclusive. Default: 24 hours after `from`.'),
  query('tz', { type: 'string' }, 'Time zone the cron expressions are read in, e.g. `Europe/Stockholm`. Default: `UTC`.'),
  query('projectId', { type: 'string' }, 'Only use the schedules of this project.'),
];

const writeErrors = {
  '400': errorResponse('BadRequest'),
  '401': errorResponse('Unauthorized'),
  '403': errorResponse('Forbidden'),
  '404': errorResponse('NotFound'),
};

export const openApiDocument = {
  openapi: '3.1.0',
  info: {
    title: 'Schedule Visualiser API',
    version: '1.0.0',
    description: [
      'Read and manage projects and schedules, and calculate when schedules run and overlap.',
      '',
      'Create a token under **API tokens** in the web app and send it as `Authorization: Bearer svt_…`.',
      'A token acts as the user who created it, with the same access to projects and schedules as in the web app.',
      'Read-only tokens may only use `GET` requests and `POST /overlaps/check`; a token can also be limited to one project.',
    ].join('\n'),
  },
  servers: [{ url: '/api/v1' }],
  security: [{ bearerAuth: [] }],
  paths: {
    '/openapi.json': {
      get: {
        operationId: 'getOpenApiDocument',
        summary: 'This document',
        security: [],
        responses: { '200': { description: 'The OpenAPI document', content: { 'application/json': { schema: { type: 'object' } } } } },
      },
    },
    '/me': {
      get: {
        operationId: 'getMe',
        summary: 'The user and token making the request',
        responses: { '200': jsonResponse('The user and token', ref('Me')), '401': errorResponse('Unauthorized') },
      },
    },
    '/projects': {
      get: {
        operationId: 'listProjects',
        summary: 'List the projects the user owns or that are shared with them',
        responses: { '200': jsonResponse('Projects, with the user\'s role in each', array(ref('Project'))), '401': errorResponse('Unauthorized') },
      },
      post: {
        operationId: 'createProject',
        summary: 'Create a project',
        description: 'Not available to tokens limited to one project.',
        requestBody: jsonBody(ref('NewProject')),
        responses: { '201': jsonResponse('The created project', ref('Project')), '400': errorResponse('BadRequest'), '401': errorResponse('Unauthorized'), '403': errorResponse('Forbidden') },
      },
    },
    '/projects/{id}': {
      get: {
        operationId: 'getProject',
        summary: 'Get a project',
        parameters: [idPath],
        responses: { '200': jsonResponse('The project', ref('Project')), '401': errorResponse('Unauthorized'), '404': errorResponse('NotFound') },
      },
      patch: {
        operationId: 'updateProject',
        summary: 'Rename or recolour a project',
        description: 'Needs edit access to the project.',
        parameters: [idPath],
        requestBody: jsonBody(ref('UpdateProject')),
        responses: { '200': jsonResponse('The updated project', ref('Project')), ...writeErrors },
      },
      delete: {
        operationId: 'deleteProject',
        summary: 'Delete a project',
        description: 'Only the owner can delete a project. Its schedules are kept, unassigned. Not available to tokens limited to one project.',
        parameters: [idPath],
        responses: { '204': { description: 'Deleted' }, '401': errorResponse('Unauthorized'), '403': errorResponse('Forbidden'), '404': errorResponse('NotFound') },
      },
    },
    '/projects/{id}/schedules': {
      put: {
        operationId: 'syncProjectSchedules',
        summary: 'Make the project\'s synced schedules match a list',
        description: [
          'Declarative and repeatable: send the full list every time and the project ends up with exactly those schedules.',
          'Each schedule is identified by its `key`. Keys that are new are created, keys whose fields differ are updated, and keys missing from the list are deleted.',
          '',
          'Only schedules that were created through this endpoint, by the token\'s user, are managed. Schedules made in the web app or by other members are never changed.',
          'A synced schedule that is moved to another project, or whose project is deleted, is no longer managed.',
          'Needs edit access to the project. Nothing is changed if any entry is invalid.',
        ].join('\n'),
        parameters: [idPath, query('dryRun', { type: 'string', enum: ['true', 'false'] }, 'Set to `true` to see what would change without changing anything.')],
        requestBody: jsonBody(ref('SyncRequest')),
        responses: { '200': jsonResponse('What changed, as lists of keys', ref('SyncResult')), ...writeErrors },
      },
    },
    '/schedules': {
      get: {
        operationId: 'listSchedules',
        summary: 'List the schedules the user can see',
        description: 'Their own, plus every schedule in projects they own or that are shared with them.',
        parameters: [query('projectId', { type: 'string' }, 'Only the schedules of this project.')],
        responses: { '200': jsonResponse('Schedules, newest first', array(ref('Schedule'))), '400': errorResponse('BadRequest'), '401': errorResponse('Unauthorized'), '404': errorResponse('NotFound') },
      },
      post: {
        operationId: 'createSchedule',
        summary: 'Create a schedule',
        description: 'Into a project needs edit access to it. A token limited to one project creates schedules in that project.',
        requestBody: jsonBody(ref('NewSchedule')),
        responses: { '201': jsonResponse('The created schedule', ref('Schedule')), '400': errorResponse('BadRequest'), '401': errorResponse('Unauthorized'), '403': errorResponse('Forbidden') },
      },
    },
    '/schedules/{id}': {
      get: {
        operationId: 'getSchedule',
        summary: 'Get a schedule',
        parameters: [idPath],
        responses: { '200': jsonResponse('The schedule', ref('Schedule')), '401': errorResponse('Unauthorized'), '404': errorResponse('NotFound') },
      },
      patch: {
        operationId: 'updateSchedule',
        summary: 'Update a schedule',
        description: 'The owner, or anyone with edit access to its project, can change it. Only the owner can move it to another project.',
        parameters: [idPath],
        requestBody: jsonBody(ref('UpdateSchedule')),
        responses: { '200': jsonResponse('The updated schedule', ref('Schedule')), ...writeErrors },
      },
      delete: {
        operationId: 'deleteSchedule',
        summary: 'Delete a schedule',
        description: 'Only the owner can delete a schedule.',
        parameters: [idPath],
        responses: { '204': { description: 'Deleted' }, '401': errorResponse('Unauthorized'), '403': errorResponse('Forbidden'), '404': errorResponse('NotFound') },
      },
    },
    '/runs': {
      get: {
        operationId: 'listRuns',
        summary: 'When schedules run',
        description: [
          'Every run in the range [`from`, `to`), oldest first. The range can be at most 366 days.',
          'For the next run of one schedule, pass `scheduleId`, `limit=1` and a `to` far enough ahead.',
        ].join('\n'),
        parameters: [
          ...rangeParameters,
          query('scheduleId', { type: 'string' }, 'Only this schedule.'),
          query('limit', { type: 'integer', minimum: 1, maximum: 10000, default: 1000 }, 'Most runs to return per schedule. Schedules with more runs are listed in `truncatedScheduleIds`. With many schedules the limit is lowered so that a request calculates at most 100,000 runs in total.'),
        ],
        responses: { '200': jsonResponse('The runs', ref('RunsResponse')), '400': errorResponse('BadRequest'), '401': errorResponse('Unauthorized'), '404': errorResponse('NotFound') },
      },
    },
    '/overlaps': {
      get: {
        operationId: 'listOverlaps',
        summary: 'When schedules run at the same time',
        description: 'Periods in the range [`from`, `to`) where two or more schedules are running. A schedule with no duration is running at the instant it starts. The range can be at most 31 days.',
        parameters: rangeParameters,
        responses: { '200': jsonResponse('The overlaps', ref('OverlapsResponse')), '400': errorResponse('BadRequest'), '401': errorResponse('Unauthorized'), '404': errorResponse('NotFound') },
      },
    },
    '/overlaps/check': {
      post: {
        operationId: 'checkOverlaps',
        summary: 'Would new schedules overlap with the existing ones?',
        description: 'Nothing is saved, and read-only tokens may use it. Only overlaps that involve at least one of the given schedules are returned; those are identified by their position in `schedules`.',
        requestBody: jsonBody(ref('OverlapCheckRequest')),
        responses: { '200': jsonResponse('The overlaps involving the given schedules', ref('OverlapCheckResponse')), '400': errorResponse('BadRequest'), '401': errorResponse('Unauthorized'), '404': errorResponse('NotFound') },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', description: 'An API token (`svt_…`) from the web app' },
    },
    responses: {
      BadRequest: { description: 'The request is invalid', content: { 'application/json': { schema: ref('Error') } } },
      Unauthorized: { description: 'The token is missing, invalid, expired or revoked', content: { 'application/json': { schema: ref('Error') } } },
      Forbidden: { description: 'The token or the user isn\'t allowed to do this', content: { 'application/json': { schema: ref('Error') } } },
      NotFound: { description: 'It doesn\'t exist, or the user can\'t see it', content: { 'application/json': { schema: ref('Error') } } },
    },
    schemas: {
      Error: {
        type: 'object',
        required: ['error'],
        properties: { error: string(), details: { description: 'What is wrong with the request, when it is invalid' } },
      },
      Me: {
        type: 'object',
        required: ['user', 'token'],
        properties: {
          user: { type: 'object', required: ['id', 'username', 'email'], properties: { id: string(), username: string(), email: string() } },
          token: {
            type: 'object',
            required: ['id', 'name', 'scope', 'projectId', 'expiresAt'],
            properties: {
              id: string(),
              name: string(),
              scope: { type: 'string', enum: ['read', 'write'] },
              projectId: nullable('string', { description: 'The only project the token may use, if limited' }),
              expiresAt: nullable('string', { format: 'date-time' }),
            },
          },
        },
      },
      Project: {
        type: 'object',
        required: ['id', 'ownerId', 'name', 'color', 'role', 'createdAt', 'updatedAt'],
        properties: {
          id: string(),
          ownerId: string(),
          name: string(),
          color: string(),
          role: { type: 'string', enum: ['owner', 'edit', 'view'], description: 'The user\'s access to the project' },
          createdAt: dateTime(),
          updatedAt: dateTime(),
        },
      },
      NewProject: {
        type: 'object',
        required: ['name', 'color'],
        properties: { name: string(undefined, { minLength: 1 }), color: string('For example `#3B82F6`', { minLength: 1 }) },
      },
      UpdateProject: {
        type: 'object',
        properties: { name: string(undefined, { minLength: 1 }), color: string(undefined, { minLength: 1 }) },
      },
      Schedule: {
        type: 'object',
        required: ['id', 'ownerId', 'projectId', 'label', 'cronExpression', 'color', 'durationMinutes', 'syncKey', 'createdAt', 'updatedAt'],
        properties: {
          id: string(),
          ownerId: string(),
          projectId: nullable('string'),
          label: string(),
          cronExpression: string('Five fields (or an alias such as `@daily`), without seconds'),
          color: string(),
          durationMinutes: { type: 'integer', minimum: 0, description: 'How long a run lasts; 0 for a point in time' },
          syncKey: nullable('string', { description: 'Set when the schedule is managed through the project sync endpoint' }),
          createdAt: dateTime(),
          updatedAt: dateTime(),
        },
      },
      NewSchedule: {
        type: 'object',
        required: ['label', 'cronExpression'],
        properties: {
          label: string(undefined, { minLength: 1 }),
          cronExpression: string('Five fields (or an alias such as `@daily`), without seconds', { minLength: 1 }),
          color: string('Default: the next colour of the palette', { minLength: 1 }),
          durationMinutes: { type: 'integer', minimum: 0, default: 0 },
          projectId: nullable('string'),
        },
      },
      UpdateSchedule: {
        type: 'object',
        properties: {
          label: string(undefined, { minLength: 1 }),
          cronExpression: string(undefined, { minLength: 1 }),
          color: string(undefined, { minLength: 1 }),
          durationMinutes: { type: 'integer', minimum: 0 },
          projectId: nullable('string', { description: 'Move the schedule to this project, or out of its project with null' }),
        },
      },
      SyncRequest: {
        type: 'object',
        required: ['schedules'],
        properties: {
          schedules: array({
            type: 'object',
            required: ['key', 'label', 'cronExpression'],
            properties: {
              key: string('Identifies the schedule between syncs. Unique within the list.', { minLength: 1, maxLength: 200 }),
              label: string(undefined, { minLength: 1 }),
              cronExpression: string(undefined, { minLength: 1 }),
              durationMinutes: { type: 'integer', minimum: 0, default: 0 },
              color: string('Only changed when sent. New schedules otherwise get the next colour of the palette.', { minLength: 1 }),
            },
          }),
        },
      },
      SyncResult: {
        type: 'object',
        required: ['dryRun', 'created', 'updated', 'deleted', 'unchanged'],
        properties: {
          dryRun: { type: 'boolean' },
          created: array(string()),
          updated: array(string()),
          deleted: array(string()),
          unchanged: array(string()),
        },
      },
      RunsResponse: {
        type: 'object',
        required: ['from', 'to', 'timezone', 'runs', 'truncatedScheduleIds'],
        properties: {
          from: dateTime(),
          to: dateTime(),
          timezone: string(),
          runs: array({
            type: 'object',
            required: ['scheduleId', 'label', 'start', 'end'],
            properties: {
              scheduleId: string(),
              label: string(),
              start: dateTime(),
              end: dateTime('Equal to `start` for schedules without a duration'),
            },
          }),
          truncatedScheduleIds: array(string('A schedule with more runs in the range than `limit`')),
        },
      },
      OverlapsResponse: {
        type: 'object',
        required: ['from', 'to', 'timezone', 'overlaps', 'truncatedScheduleIds'],
        properties: {
          from: dateTime(),
          to: dateTime(),
          timezone: string(),
          overlaps: array({
            type: 'object',
            required: ['start', 'end', 'scheduleIds', 'count'],
            properties: { start: dateTime(), end: dateTime(), scheduleIds: array(string()), count: { type: 'integer' } },
          }),
          truncatedScheduleIds: array(string('A schedule with more than 10,000 runs in the range (fewer when there are many schedules); overlaps after its last calculated run are missing')),
        },
      },
      OverlapCheckRequest: {
        type: 'object',
        required: ['schedules'],
        properties: {
          schedules: {
            type: 'array',
            minItems: 1,
            maxItems: 50,
            items: {
              type: 'object',
              required: ['cronExpression'],
              properties: {
                label: string(),
                cronExpression: string(undefined, { minLength: 1 }),
                durationMinutes: { type: 'integer', minimum: 0, default: 0 },
              },
            },
          },
          from: dateTime('Default: now'),
          to: dateTime('Default: 24 hours after `from`'),
          tz: string('Default: `UTC`'),
          projectId: string('Only compare with the schedules of this project'),
        },
      },
      OverlapCheckResponse: {
        type: 'object',
        required: ['from', 'to', 'timezone', 'hasOverlap', 'overlaps', 'truncatedScheduleIds', 'truncatedCandidates'],
        properties: {
          from: dateTime(),
          to: dateTime(),
          timezone: string(),
          hasOverlap: { type: 'boolean' },
          overlaps: array({
            type: 'object',
            required: ['start', 'end', 'scheduleIds', 'candidates', 'count'],
            properties: {
              start: dateTime(),
              end: dateTime(),
              scheduleIds: array(string('Existing schedules taking part')),
              candidates: array({ type: 'integer', description: 'Positions in the request\'s `schedules` taking part' }),
              count: { type: 'integer' },
            },
          }),
          truncatedScheduleIds: array(string()),
          truncatedCandidates: array({ type: 'integer' }),
        },
      },
    },
  },
};
