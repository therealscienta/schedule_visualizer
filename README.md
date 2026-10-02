# Cron Schedule Visualiser

A full-stack web application for visualizing and analyzing multiple cron schedules simultaneously. Features user authentication, project-based organization, sharing between users, and an admin panel.

## Features

- Add multiple cron expressions with custom labels and durations
- Interactive timeline visualization with overlap detection
- Organize schedules into color-coded projects
- Share projects with other users (view or edit permissions)
- Multiple time range views (24h, 7d, 30d, custom)
- Statistics dashboard (busiest hours, days, overlap counts)
- Export timeline as PNG/SVG, import/export schedules as JSON
- Zoom controls (50% to 300%)
- Dark mode and 12h/24h time format toggle
- User authentication with JWT
- Admin panel for user and project management
- API tokens and a token API for scripts: manage schedules, sync a project's schedules from a file, calculate runs and overlaps
- Automatic data refresh on tab focus
- Mobile-responsive design

## Quick Start

### Development

```bash
# Install dependencies
npm install
cd server && npm install && cd ..

# Start frontend and backend together
npm run dev:all
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:3001

### Docker

`JWT_SECRET` is required: Docker Compose refuses to start without it, and the server refuses to start in production with a missing or placeholder secret. Put a long random value in a `.env` file next to `docker-compose.yml`:

```bash
echo "JWT_SECRET=$(openssl rand -hex 32)" > .env

# Using Docker Compose
docker compose up -d

# The app will be available at http://localhost:3001
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `JWT_SECRET` | `dev-secret-change-in-production` (development only) | Secret for JWT tokens. **Required in production**; placeholder values are rejected. |
| `PORT` | `3001` | Backend server port |
| `DB_PATH` | `./data/schedules.db` | SQLite database file path |
| `NODE_ENV` | `development` | `development` or `production` |

## Technology Stack

### Frontend
- React 18 + TypeScript + Vite
- Tailwind CSS
- React Router 6
- cron-parser, html2canvas
- Vitest (testing)

### Backend
- Express + TypeScript
- SQLite (better-sqlite3)
- JWT authentication (jsonwebtoken + bcrypt) and API tokens
- Zod validation

## Usage

1. The app loads with three example schedules by default
2. Register an account to enable server persistence and sharing
3. Create projects to organize schedules, then share them with other users
4. Use the timeline to visualize execution patterns and identify overlaps
5. The first registered user automatically becomes an admin

## API access

Scripts and CI jobs can use the app through a token API at `/api/v1`. Create a token under **API tokens** in the user menu: it can be read-only or read-write, can expire, and can be limited to one project. A token acts as you, with the same access to projects and schedules as in the web app.

```bash
TOKEN=svt_...   # shown once, when the token is created
API=http://localhost:3001/api/v1

# Who am I, and what can the token do?
curl -H "Authorization: Bearer $TOKEN" $API/me

# List schedules
curl -H "Authorization: Bearer $TOKEN" $API/schedules

# Keep a project's schedules in sync with a list. Repeatable: send the full list every
# time; schedules made in the web app are left alone. Drop ?dryRun=true to apply.
curl -X PUT -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"schedules":[{"key":"nightly-backup","label":"Nightly backup","cronExpression":"0 2 * * *","durationMinutes":45}]}' \
  "$API/projects/$PROJECT_ID/schedules?dryRun=true"

# When does a schedule run next?
curl -H "Authorization: Bearer $TOKEN" \
  "$API/runs?scheduleId=$SCHEDULE_ID&limit=1&to=2027-01-01T00:00:00Z&tz=Europe/Stockholm"

# Would a new job overlap with existing ones? Saves nothing, so a read-only token works.
curl -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"schedules":[{"cronExpression":"30 2 * * *","durationMinutes":20}]}' \
  $API/overlaps/check
```

The complete description is the OpenAPI document at `/api/v1/openapi.json`; see also [server/README.md](server/README.md).

## Documentation

See [CLAUDE.md](CLAUDE.md) for detailed architecture, API reference, database schema, and project structure.
