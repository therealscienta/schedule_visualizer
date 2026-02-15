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
npm run build
npm start
```

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
- `created_at` (TEXT)
- `updated_at` (TEXT)

### project_shares
- `id` (TEXT, PRIMARY KEY)
- `project_id` (TEXT, FK → projects.id)
- `shared_with_user_id` (TEXT, FK → users.id)
- `permission` (TEXT: 'view' | 'edit')
- `created_at` (TEXT)

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

Tokens expire after 7 days. The token payload includes:
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
