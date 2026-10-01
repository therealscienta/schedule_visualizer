# Cron Schedule Visualiser

A full-stack web application for visualizing and analyzing multiple cron schedules simultaneously. Built to help developers and system administrators identify schedule overlaps and optimize job timing. Features user authentication, server-side persistence, project sharing between users, and an admin panel.

## Project Description

This application allows users to:
- Add multiple cron expressions with custom labels and optional durations
- Organize schedules into projects with color coding
- Visualize all schedules on an interactive timeline
- Identify execution overlaps between different schedules
- Switch between different time ranges (24 hours, 7 days, 30 days, or custom date ranges)
- See execution counts and timing details for each schedule
- View comprehensive statistics dashboard with busiest hours and days
- Export timeline as PNG or SVG images
- Export and import schedules as JSON files
- Zoom in/out on the timeline for detailed inspection
- Toggle between light and dark mode
- Switch between 12-hour and 24-hour time formats
- Register and log in with JWT-based authentication
- Share projects with other users (view or edit permissions)
- Admin panel for user and project management
- Full mobile responsiveness

The application includes three default example schedules on first load to demonstrate functionality. When authenticated, all data is persisted to the server (SQLite). When not authenticated, data is stored in localStorage.

## Tech Stack

### Frontend
- **React 18.2** with **React Router 6** - UI framework and routing
- **TypeScript 5.2** - Type-safe JavaScript
- **Vite 5.2** - Build tool and dev server (proxies `/api` to backend)
- **Tailwind CSS 3.4** - Utility-first styling
- **cron-parser 5.10** - Cron expression parsing and execution generation (4.x was ~40x slower for minute-level schedules)
- **html2canvas** - PNG export functionality
- **Vitest** - Unit testing framework

### Backend
- **Express 4.18** - HTTP server framework
- **better-sqlite3 9.2** - SQLite database (WAL mode, foreign keys enabled)
- **jsonwebtoken 9.0** - JWT authentication (7-day expiry)
- **bcrypt 5.1** - Password hashing (12 rounds)
- **zod 3.22** - Request validation
- **uuid 9.0** - ID generation
- **tsx** - TypeScript execution for development

## How to Run

### Development (Frontend + Backend)

```bash
# Install frontend dependencies
npm install

# Install backend dependencies
cd server && npm install && cd ..

# Start both servers concurrently
npm run dev:all
```

- Frontend: `http://localhost:5173` (Vite dev server, proxies `/api` to backend)
- Backend: `http://localhost:3001` (Express API server)

### Production Build

```bash
npm run build          # Build frontend (outputs to dist/)
cd server && npm run build  # Build backend (outputs to server/dist/)
node server/dist/index.js   # Serves both API and SPA from port 3001
```

### Docker Deployment

```bash
# JWT_SECRET is required; compose reads it from .env
echo "JWT_SECRET=$(openssl rand -hex 32)" > .env

# Build and run with Docker Compose (http://localhost:3001)
docker compose up -d

# Or build the image directly (http://localhost:8080)
docker build -t schedule-visualiser .
docker run -p 8080:3001 -v ./data:/app/data -e JWT_SECRET="$(openssl rand -hex 32)" schedule-visualiser
```

### Type Checking

```bash
npx tsc --noEmit              # Frontend type check
cd server && npx tsc --noEmit # Backend type check
```

### Testing

```bash
npm test              # Run tests once (frontend + backend)
npm run test:watch    # Watch mode
npm run test:coverage # With coverage report (fails below the 80% thresholds)
npm run lint          # ESLint (.eslintrc.cjs)
```

Vitest runs two projects (see `vitest.config.ts`): `web` (jsdom, `src/**/*.test.tsx?`) and `server` (Node, `server/test/**/*.test.ts`, against an in-memory SQLite database via `createApp()`). The server project needs `server/node_modules` installed.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Backend server port |
| `JWT_SECRET` | `dev-secret-change-in-production` (development only) | Secret for signing JWT tokens. **Required in production**: the server refuses to start without it or with a known placeholder value |
| `DB_PATH` | `./data/schedules.db` | Path to SQLite database file |
| `NODE_ENV` | `development` | `development` or `production` |

## Project Structure

```
schedule-visualiser/
├── index.html                  # HTML entry point
├── package.json                # Frontend dependencies and scripts
├── tsconfig.json               # Frontend TypeScript config (strict mode)
├── vite.config.ts              # Vite config (proxy /api -> localhost:3001)
├── tailwind.config.js          # Tailwind CSS configuration
├── Dockerfile                  # Multi-stage Docker build
├── docker-compose.yml          # Docker Compose for deployment
├── CLAUDE.md                   # This file
├── src/
│   ├── main.tsx                # React entry point with router setup
│   ├── App.tsx                 # Root component with state management
│   ├── index.css               # Global styles and Tailwind directives
│   ├── components/
│   │   ├── AuthHeader.tsx              # User menu (login/register links or user dropdown)
│   │   ├── RequireAuth.tsx             # Route guard for authenticated users
│   │   ├── RequireAdmin.tsx            # Route guard for admin users
│   │   ├── ScheduleInput.tsx           # Form for adding new schedules
│   │   ├── ScheduleList.tsx            # List of active schedules
│   │   ├── Timeline.tsx                # Main visualization component with zoom
│   │   ├── TimeRangeSelector.tsx       # Time range selector buttons
│   │   ├── CustomDateRangePicker.tsx   # Modal for custom date range selection
│   │   ├── StatisticsPanel.tsx         # Statistics dashboard
│   │   ├── ExportMenu.tsx              # Export dropdown (PNG/SVG/JSON)
│   │   ├── ImportSchedules.tsx         # Import schedules from JSON
│   │   ├── ProjectManager.tsx          # Create/rename/delete projects
│   │   ├── ProjectFilter.tsx           # Filter schedules by project
│   │   └── ShareProjectModal.tsx       # Modal to share projects with users
│   ├── contexts/
│   │   ├── AuthContext.tsx             # Auth state (user, login, register, logout)
│   │   └── SettingsContext.tsx         # Theme and time format settings
│   ├── hooks/
│   │   └── useServerSync.ts           # Server data sync (CRUD + data loader with refresh)
│   ├── pages/
│   │   ├── LoginPage.tsx              # Login form
│   │   ├── RegisterPage.tsx           # Registration form
│   │   └── admin/
│   │       ├── AdminLayout.tsx        # Admin panel layout with navigation
│   │       ├── AdminDashboard.tsx     # Admin stats overview
│   │       ├── AdminUsers.tsx         # User management (roles, activate/deactivate)
│   │       └── AdminProjects.tsx      # Project management (view all, delete)
│   ├── utils/
│   │   ├── api.ts               # API fetch wrapper with auth headers
│   │   ├── cronParser.ts        # Cron parsing, execution generation, overlap detection
│   │   ├── colors.ts            # Color palette for schedules
│   │   ├── exportTimeline.ts    # Export utilities (PNG, SVG, JSON)
│   │   ├── formatTime.ts        # Time formatting utilities
│   │   └── id.ts                # UUID generation
│   └── types/
│       └── index.ts             # TypeScript type definitions
├── server/
│   ├── package.json             # Backend dependencies
│   ├── tsconfig.json            # Backend TypeScript config
│   ├── test/
│   │   └── api.test.ts          # API tests (run by the root `npm test`)
│   └── src/
│       ├── index.ts             # Starts the server
│       ├── app.ts               # createApp(): Express app setup, route mounting, static serving
│       ├── config.ts            # Environment variable configuration
│       ├── types.ts             # AuthUser and AuthRequest types
│       ├── db/
│       │   ├── connection.ts    # SQLite connection (singleton, WAL mode)
│       │   ├── schema.ts       # Table creation (users, projects, schedules, project_shares)
│       │   └── users.ts         # Username/email lookup (emails take precedence)
│       ├── middleware/
│       │   ├── auth.ts          # JWT verification + per-request account check
│       │   ├── admin.ts         # Admin role check middleware
│       │   └── errorHandler.ts  # Global error handler
│       └── routes/
│           ├── auth.ts          # POST /register, POST /login, GET /me
│           ├── schedules.ts     # CRUD + /sync for bulk import
│           ├── projects.ts      # CRUD for projects
│           ├── sharing.ts       # POST /:id/share, DELETE /:id/share/:userId, GET /:id/shared-users
│           └── admin.ts         # GET/PUT/DELETE /users, GET/DELETE /projects, GET /stats
└── data/                        # SQLite database directory (created at runtime)
```

## API Endpoints

All API routes are prefixed with `/api`.

### Authentication (`/api/auth`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/register` | No | Register new user (first user becomes admin) |
| POST | `/login` | No | Login with username/email + password |
| GET | `/me` | Yes | Get current user profile |

### Schedules (`/api/schedules`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | Yes | List all accessible schedules (owned + shared) |
| POST | `/` | Yes | Create a schedule (`projectId` may be null; 409 if the id exists) |
| PUT | `/:id` | Yes | Update a schedule (owner or edit permission; only the owner can move it to another project) |
| DELETE | `/:id` | Yes | Delete a schedule (owner only) |
| POST | `/sync` | Yes | Bulk sync from localStorage (replaces all owned schedules; only into projects the user can edit) |

### Projects (`/api/projects`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | Yes | List all accessible projects (owned + shared, includes role) |
| POST | `/` | Yes | Create a project (409 if the id exists) |
| PUT | `/:id` | Yes | Update a project (owner or edit permission; 404 if it doesn't exist) |
| DELETE | `/:id` | Yes | Delete a project (owner only, cascades) |

### Sharing (`/api/projects`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/:id/share` | Yes | Share project with user (by username/email) |
| DELETE | `/:id/share/:userId` | Yes | Revoke share (owner only) |
| GET | `/:id/shared-users` | Yes | List users a project is shared with (owner only) |

### Admin (`/api/admin`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/users` | Admin | List all users |
| PUT | `/users/:id` | Admin | Update user role/active status |
| DELETE | `/users/:id` | Admin | Delete user (cascades all data) |
| GET | `/projects` | Admin | List all projects with stats |
| DELETE | `/projects/:id` | Admin | Delete any project |
| GET | `/stats` | Admin | System statistics |

### Health
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | No | Health check endpoint |

## Database Schema

SQLite database with four tables:

- **users**: id, username (unique), email (unique), password_hash, role (user/admin), is_active, timestamps
- **projects**: id, owner_id (FK users), name, color, timestamps
- **schedules**: id, owner_id (FK users), project_id (FK projects, nullable, SET NULL on delete), label, cron_expression, color, duration_minutes, timestamps
- **project_shares**: id, project_id (FK projects, CASCADE), shared_with_user_id (FK users, CASCADE), permission (view/edit), created_at. Unique constraint on (project_id, shared_with_user_id)

Foreign keys are enforced. Projects cascade-delete their shares. Users cascade-delete all their data.

## Key Architecture Decisions

### Authentication
- JWT tokens stored in localStorage, sent as `Bearer` header
- First registered user automatically becomes admin
- Tokens expire after 7 days, but every request re-reads the account: disabling, deleting or demoting a user takes effect immediately, and the frontend signs out on any 401
- Login and sharing accept username or email; an email match wins over a username match, and usernames can't contain `@`
- Server errors (5xx) return a generic message; details are only logged

### Data Sync Strategy
- Unauthenticated: all data in localStorage with default example schedules
- On first login: localStorage schedules are synced to server (if server has no data)
- Authenticated: server is the source of truth; `useServerDataLoader` loads on auth change
- `refreshFromServer()` can be triggered manually (refresh button) or automatically (tab focus)
- Changes are applied optimistically; if the server rejects one, an error banner is shown and data is reloaded from the server
- Import while signed in adds/updates the imported projects and schedules on the server (nothing is deleted); as a guest it replaces local data
- localStorage still used as cache/fallback; signing out clears it, and the main view remounts per user

### Sharing Model
- Projects are the unit of sharing (not individual schedules)
- Share permissions: `view` (read-only) or `edit` (can modify schedules in the project)
- `GET /schedules` returns owned schedules plus every schedule in projects the user owns or that are shared with the user
- The UI only offers actions the role allows (`role` on projects, `ownerId` on schedules)
- `GET /projects` returns both owned projects and shared projects (with role field)

### Frontend Routing
- `/` - Main app (schedule input, timeline, statistics)
- `/login` - Login page
- `/register` - Registration page
- `/admin` - Admin panel (requires admin role)
- `/admin/users` - User management
- `/admin/projects` - Project management

### Production Deployment
- Multi-stage Docker build: frontend built with Vite, backend compiled with tsc
- Express serves both the API routes and the static SPA files
- SPA fallback: all non-`/api` routes serve `index.html`
- SQLite database persisted via Docker volume mount at `/app/data`

## Features Implemented

- Interactive cron schedule visualization with timeline
- Multiple time ranges (24h, 7d, 30d, custom)
- Overlap detection and display
- Comprehensive statistics dashboard
- Export as PNG/SVG/JSON, import from JSON
- Zoom controls (50% to 300%)
- Dark mode with localStorage persistence
- 12h/24h time format toggle
- Multi-row and single-row timeline modes
- Project organization with color coding
- User authentication (register, login, JWT)
- Server-side persistence (SQLite)
- Project sharing (view/edit permissions)
- Admin panel (user management, project oversight, system stats)
- Automatic data refresh on tab focus
- Manual refresh button for server data
- Mobile-responsive design

## Claude Reference Files

Additional documentation generated during development is stored in the [`CLAUDE/`](CLAUDE/) directory:

| File | Description |
|------|-------------|
| [`CHANGELOG.md`](CHANGELOG.md) | Version history and notable changes (root level) |
| [`CLAUDE/FEATURES.md`](CLAUDE/FEATURES.md) | Detailed feature documentation |
| [`CLAUDE/ENHANCEMENTS_README.md`](CLAUDE/ENHANCEMENTS_README.md) | Overview of v2.0 enhancements |
| [`CLAUDE/COMPLETION_REPORT.md`](CLAUDE/COMPLETION_REPORT.md) | Implementation completion report |
| [`CLAUDE/IMPLEMENTATION_SUMMARY.md`](CLAUDE/IMPLEMENTATION_SUMMARY.md) | Technical implementation summary |
| [`CLAUDE/TESTING.md`](CLAUDE/TESTING.md) | Testing notes and coverage details |
