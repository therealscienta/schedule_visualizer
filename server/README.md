# Schedule Visualiser Backend API

Express.js + TypeScript backend for the Cron Schedule Visualiser application.

## Features

- User authentication with JWT
- Schedule CRUD operations with ownership
- Project management for organizing schedules
- Project sharing with view/edit permissions
- Admin dashboard for user and project management
- SQLite database with WAL mode
- Role-based access control (RBAC)
- Bulk sync endpoint for localStorage migration
- API tokens and a token-only `/api/v1` for scripts: read and manage projects and schedules, keep a project's schedules in sync with a file, calculate runs and overlaps (described by an OpenAPI document)

## Quick Start

### Installation

```bash
cd server
npm install
```

### Development

```bash
npm run dev
```

Server will start on `http://localhost:3001` (or PORT from environment)

### Production Build

```bash
npm run build   # type-checks, then bundles src/index.ts to dist/index.js with esbuild
npm start
```

The bundle includes the frontend's `../src/utils/cronParser.ts` (so build from a full checkout), while `cron-parser` and the other npm packages stay external and are loaded from `server/node_modules` at runtime.

### Environment Variables

Create a `.env` file in the server directory:

```env
PORT=3001
JWT_SECRET=your-secret-key-here-change-this
DB_PATH=./data/schedules.db
NODE_ENV=development
```

## Database Schema

### users
- `id` (TEXT, PRIMARY KEY)
- `username` (TEXT, UNIQUE)
- `email` (TEXT, UNIQUE)
- `password_hash` (TEXT)
- `role` (TEXT: 'user' | 'admin')
- `is_active` (INTEGER: 0 | 1)
- `created_at` (TEXT)
- `updated_at` (TEXT)

### projects
- `id` (TEXT, PRIMARY KEY)
- `owner_id` (TEXT, FK → users.id)
- `name` (TEXT)
- `color` (TEXT)
- `created_at` (TEXT)
- `updated_at` (TEXT)

### schedules
- `id` (TEXT, PRIMARY KEY)
- `owner_id` (TEXT, FK → users.id)
- `project_id` (TEXT, FK → projects.id, nullable)
- `label` (TEXT)
- `cron_expression` (TEXT)
- `color` (TEXT)
- `duration_minutes` (INTEGER)
- `sync_key` (TEXT, nullable): set for schedules a script manages through `PUT /api/v1/projects/:id/schedules`; unique per project and owner. A trigger clears it when the schedule's project changes (moved, or its project deleted).
- `created_at` (TEXT)
- `updated_at` (TEXT)

### project_shares
- `id` (TEXT, PRIMARY KEY)
- `project_id` (TEXT, FK → projects.id)
- `shared_with_user_id` (TEXT, FK → users.id)
- `permission` (TEXT: 'view' | 'edit')
- `created_at` (TEXT)

### api_tokens
- `id` (TEXT, PRIMARY KEY)
- `user_id` (TEXT, FK → users.id, CASCADE)
- `project_id` (TEXT, FK → projects.id, CASCADE, nullable): the only project the token may use
- `name` (TEXT)
- `token_hash` (TEXT, UNIQUE): SHA-256 of the token; the token itself is never stored
- `token_prefix` (TEXT): the first 12 characters, to tell tokens apart
- `scope` (TEXT: 'read' | 'write')
- `expires_at` (TEXT, nullable)
- `last_used_at` (TEXT, nullable; refreshed at most once a minute)
- `created_at` (TEXT)

Tables are created, and columns added, when the server starts.

## API Endpoints

### Authentication

#### POST /api/auth/register
Register a new user. First user becomes admin.

**Request:**
```json
{
  "username": "john_doe",
  "email": "john@example.com",
  "password": "securepass123"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid-here",
    "username": "john_doe",
    "email": "john@example.com",
    "role": "user",
    "is_active": 1
  }
}
```

#### POST /api/auth/login
Login with username/email and password.

**Request:**
```json
{
  "identifier": "john_doe",
  "password": "securepass123"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid-here",
    "username": "john_doe",
    "email": "john@example.com",
    "role": "user",
    "is_active": 1
  }
}
```

#### GET /api/auth/me
Get current user profile (requires auth).

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "id": "uuid-here",
  "username": "john_doe",
  "email": "john@example.com",
  "role": "user",
  "is_active": 1,
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-01T00:00:00Z"
}
```

### Schedules

All schedule endpoints require authentication.

#### GET /api/schedules
List all schedules owned by or shared with the user.

**Response:**
```json
[
  {
    "id": "uuid-here",
    "ownerId": "user-uuid",
    "projectId": "project-uuid",
    "label": "Daily Backup",
    "cronExpression": "0 2 * * *",
    "color": "#3b82f6",
    "durationMinutes": 30,
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-01T00:00:00Z"
  }
]
```

#### POST /api/schedules
Create a new schedule.

**Request:**
```json
{
  "label": "Daily Backup",
  "cronExpression": "0 2 * * *",
  "color": "#3b82f6",
  "durationMinutes": 30,
  "projectId": "project-uuid" // optional
}
```

#### PUT /api/schedules/:id
Update a schedule (owner or editor).

**Request:**
```json
{
  "label": "Nightly Backup",
  "durationMinutes": 45
}
```

#### DELETE /api/schedules/:id
Delete a schedule (owner only).

#### POST /api/schedules/sync
Bulk sync schedules (for localStorage migration).

**Request:**
```json
{
  "schedules": [
    {
      "id": "uuid-1",
      "label": "Schedule 1",
      "cronExpression": "0 2 * * *",
      "color": "#3b82f6",
      "durationMinutes": 0,
      "projectId": null
    }
  ]
}
```

### Projects

All project endpoints require authentication.

#### GET /api/projects
List all projects (owned + shared).

**Response:**
```json
[
  {
    "id": "uuid-here",
    "ownerId": "user-uuid",
    "name": "Production",
    "color": "#ef4444",
    "role": "owner",
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-01T00:00:00Z"
  }
]
```

#### POST /api/projects
Create a new project.

**Request:**
```json
{
  "name": "Production",
  "color": "#ef4444"
}
```

#### PUT /api/projects/:id
Update a project (owner or editor).

**Request:**
```json
{
  "name": "Production Servers",
  "color": "#dc2626"
}
```

#### DELETE /api/projects/:id
Delete a project (owner only).

### Sharing

All sharing endpoints require authentication.

#### POST /api/projects/:id/share
Share a project with another user (owner only).

**Request:**
```json
{
  "identifier": "jane_doe",
  "permission": "edit"
}
```

**Response:**
```json
{
  "id": "share-uuid",
  "projectId": "project-uuid",
  "userId": "user-uuid",
  "username": "jane_doe",
  "email": "jane@example.com",
  "permission": "edit"
}
```

#### DELETE /api/projects/:id/share/:userId
Revoke project share (owner only).

#### GET /api/projects/:id/shared-users
List all users a project is shared with (owner only).

**Response:**
```json
[
  {
    "id": "share-uuid",
    "userId": "user-uuid",
    "username": "jane_doe",
    "email": "jane@example.com",
    "permission": "edit"
  }
]
```

### Admin

All admin endpoints require authentication with admin role.

#### GET /api/admin/users
List all users.

#### PUT /api/admin/users/:id
Update user role or status.

**Request:**
```json
{
  "role": "admin",
  "is_active": 1
}
```

#### DELETE /api/admin/users/:id
Delete a user (cannot delete yourself).

#### GET /api/admin/projects
List all projects with statistics.

**Response:**
```json
[
  {
    "id": "uuid-here",
    "name": "Production",
    "color": "#ef4444",
    "ownerId": "user-uuid",
    "ownerUsername": "john_doe",
    "ownerEmail": "john@example.com",
    "scheduleCount": 5,
    "shareCount": 2,
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-01T00:00:00Z"
  }
]
```

#### DELETE /api/admin/projects/:id
Delete any project.

#### GET /api/admin/stats
Get system statistics.

**Response:**
```json
{
  "userCount": 10,
  "projectCount": 15,
  "scheduleCount": 47,
  "shareCount": 8
}
```

### API tokens

Managed with a login session (JWT) only; an API token is rejected here.

#### GET /api/tokens
List the user's tokens (never the tokens themselves): `id`, `name`, `prefix`, `scope`, `projectId`, `projectName`, `expiresAt`, `lastUsedAt`, `createdAt`, `expired`.

#### POST /api/tokens
Create a token. The response contains the token in `token`; it is not stored and cannot be shown again.

**Request:**
```json
{
  "name": "Nightly deploy",
  "scope": "write",
  "projectId": "project-uuid",
  "expiresInDays": 90
}
```
`scope` is `read` or `write`. `projectId` (optional) limits the token to one project the user can access. `expiresInDays` (1-3650) may be omitted or `null` for a token that never expires.

#### DELETE /api/tokens/:id
Revoke a token (204).

### Token API (`/api/v1`)

For scripts and CI jobs. Authenticated with an API token only (`Authorization: Bearer svt_...`); login tokens are rejected here. A token acts as its user, with the same access to projects and schedules as in the web app, and stops working when the token expires or is revoked, or the account is disabled or deleted. The complete description is the OpenAPI document at `GET /api/v1/openapi.json`.

- **Read-only tokens** may use `GET` requests and `POST /overlaps/check`; everything else needs a read-write token.
- **Project-limited tokens** only see and change their project and its schedules (anything else is a 404), create schedules in that project, and cannot create or delete projects.
- Timestamps are ISO 8601 in UTC.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/me` | The user and token making the request |
| GET, POST | `/projects` | List projects (with the user's `role`), create a project |
| GET, PATCH, DELETE | `/projects/:id` | Read, update, delete (owner only) |
| PUT | `/projects/:id/schedules` | Sync: make the project's synced schedules match a list (`?dryRun=true` to preview) |
| GET, POST | `/schedules` | List (`?projectId=`), create (colour optional) |
| GET, PATCH, DELETE | `/schedules/:id` | Read, update, delete (owner only) |
| GET | `/runs` | When schedules run: `from`, `to`, `tz`, `projectId`, `scheduleId`, `limit` |
| GET | `/overlaps` | When schedules run at the same time (range of at most 31 days) |
| POST | `/overlaps/check` | Would new schedules overlap with the existing ones? Saves nothing |
| GET | `/openapi.json` | The OpenAPI document (no token needed) |

Schedules use the same rules as in the web app: invalid cron expressions are rejected (400), editors can change but not move or delete other people's schedules, and viewers can only read.

#### PUT /api/v1/projects/:id/schedules
Declarative and repeatable: send the full list every time. Schedules are identified by `key`; new keys are created, keys that differ are updated, and keys missing from the list are deleted. Only schedules created through this endpoint by the token's user are managed; schedules made in the web app, and other members' schedules, are never touched. Nothing is changed if any entry is invalid.

**Request:**
```json
{
  "schedules": [
    { "key": "nightly-backup", "label": "Nightly backup", "cronExpression": "0 2 * * *", "durationMinutes": 45 },
    { "key": "weekly-report", "label": "Weekly report", "cronExpression": "0 6 * * 1" }
  ]
}
```

**Response:** the keys in each outcome.
```json
{ "dryRun": false, "created": ["weekly-report"], "updated": [], "deleted": [], "unchanged": ["nightly-backup"] }
```

#### GET /api/v1/runs
Runs in the range [`from`, `to`), oldest first. `from` defaults to now and `to` to 24 hours later (ISO 8601 with an offset or `Z`; at most 366 days). `tz` (default `UTC`) is the time zone the cron expressions are read in. `limit` (default 1000, at most 10000) caps the runs per schedule; schedules that were cut off are listed in `truncatedScheduleIds`.

```bash
# When does a schedule run next?
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3001/api/v1/runs?scheduleId=$ID&limit=1&to=2027-01-01T00:00:00Z&tz=Europe/Stockholm"
```

#### POST /api/v1/overlaps/check
Checks up to 50 proposed schedules against the stored ones. Returns `hasOverlap` and the overlaps that involve a proposed schedule, with the existing schedules taking part in `scheduleIds` and the proposed ones, by position in the request, in `candidates`.

**Request:**
```json
{
  "schedules": [{ "cronExpression": "30 2 * * *", "durationMinutes": 20 }],
  "from": "2026-10-05T00:00:00Z",
  "to": "2026-10-06T00:00:00Z",
  "tz": "Europe/Stockholm"
}
```

### Health Check

#### GET /api/health
Check server status.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

## Authentication

All protected endpoints require a JWT token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

Tokens expire after 7 days. Scripts should use API tokens instead (see above). The token payload includes:
```json
{
  "id": "user-uuid",
  "username": "john_doe",
  "email": "john@example.com",
  "role": "user"
}
```

## Error Responses

All errors follow this format:

```json
{
  "error": "Error message here"
}
```

Validation errors (400) also have `details`, the zod issues that say which fields are wrong.

Common status codes:
- `400` - Bad Request (validation error)
- `401` - Unauthorized (missing/invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `409` - Conflict (duplicate username/email)
- `500` - Internal Server Error

## Security Features

- Password hashing with bcrypt (12 rounds)
- JWT-based authentication
- API tokens are random (256 bits), stored only as SHA-256 hashes, and checked against the account on every request
- Role-based access control (user/admin)
- Foreign key constraints with CASCADE delete
- SQL injection prevention via prepared statements
- CORS enabled for cross-origin requests
- Input validation with Zod

## Production Deployment

1. Build the backend:
   ```bash
   cd server
   npm run build
   ```

2. Build the frontend:
   ```bash
   cd ..
   npm run build
   ```

3. Set production environment variables:
   ```bash
   export NODE_ENV=production
   export JWT_SECRET=<strong-secret-key>
   export DB_PATH=/path/to/data/schedules.db
   export PORT=3001
   ```

4. Start the server:
   ```bash
   cd server
   npm start
   ```

The server will serve the frontend static files from `../dist` and handle API requests on `/api/*`.

## Database Backup

The SQLite database file is located at `./data/schedules.db` by default. To backup:

```bash
# Create backup
cp data/schedules.db data/schedules.db.backup

# Or use SQLite backup command
sqlite3 data/schedules.db ".backup data/schedules.db.backup"
```

WAL mode files (`schedules.db-shm` and `schedules.db-wal`) are temporary and created automatically.
