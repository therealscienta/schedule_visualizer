# Backend Setup Guide

## Initial Setup

### 1. Install Dependencies

```bash
cd server
npm install
```

### 2. Create Environment File

Copy the example environment file and customize it:

```bash
cp .env.example .env
```

Edit `.env` and update the JWT_SECRET for production:

```env
PORT=3001
NODE_ENV=development
JWT_SECRET=your-secure-random-secret-here
DB_PATH=./data/schedules.db
```

### 3. Start Development Server

```bash
npm run dev
```

The server will:
- Create the `data` directory automatically
- Initialize the SQLite database with all tables
- Start listening on port 3001 (or your configured PORT)

### 4. Test the API

Test the health endpoint:

```bash
curl http://localhost:3001/api/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

## Creating Your First Admin User

The first user registered becomes an admin automatically:

```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "email": "admin@example.com",
    "password": "secure123"
  }'
```

Response will include a JWT token:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "...",
    "username": "admin",
    "email": "admin@example.com",
    "role": "admin",
    "is_active": 1
  }
}
```

Save this token for API requests!

## Testing Protected Endpoints

Use the token from registration/login:

```bash
# Get current user profile
curl http://localhost:3001/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"

# Create a schedule
curl -X POST http://localhost:3001/api/schedules \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "label": "Daily Backup",
    "cronExpression": "0 2 * * *",
    "color": "#3b82f6",
    "durationMinutes": 30
  }'

# List schedules
curl http://localhost:3001/api/schedules \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## Production Build

### 1. Build the TypeScript code

```bash
npm run build
```

This creates compiled JavaScript in the `dist/` directory.

### 2. Set production environment

```bash
export NODE_ENV=production
export JWT_SECRET=your-strong-production-secret
export DB_PATH=/var/data/schedules.db
export PORT=3001
```

### 3. Start production server

```bash
npm start
```

## Database Location

By default, the SQLite database is created at:
- Development: `./data/schedules.db`
- Production: Configured via `DB_PATH` environment variable

The database file is automatically created on first run with all required tables.

## Troubleshooting

### Port Already in Use

If port 3001 is taken, change it in `.env`:
```env
PORT=8080
```

### Database Permission Issues

Ensure the `data` directory is writable:
```bash
chmod 755 data
chmod 644 data/schedules.db
```

### JWT Token Expired

Tokens expire after 7 days. Login again to get a new token:
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "identifier": "admin",
    "password": "secure123"
  }'
```

### Cannot Find Module Errors

Reinstall dependencies:
```bash
rm -rf node_modules package-lock.json
npm install
```

## Development Tips

### Watch Mode

Use `tsx watch` for automatic reloading during development:
```bash
npm run dev
```

Changes to TypeScript files will automatically restart the server.

### Type Checking

Run TypeScript compiler in check mode:
```bash
npx tsc --noEmit
```

### Database Inspection

Use SQLite CLI to inspect the database:
```bash
sqlite3 data/schedules.db

# Inside SQLite shell:
.tables                    # List all tables
.schema users              # Show users table schema
SELECT * FROM users;       # Query users
.quit                      # Exit
```

### Reset Database

To start fresh, delete the database file:
```bash
rm -rf data/
npm run dev  # Will recreate database
```

## Integration with Frontend

### Development Mode

Frontend (port 5173) → Backend API (port 3001)

Configure frontend to proxy API requests:

```typescript
// vite.config.ts
export default {
  server: {
    proxy: {
      '/api': 'http://localhost:3001'
    }
  }
}
```

### Production Mode

Backend serves both API and frontend static files:
- API routes: `http://your-domain.com/api/*`
- Frontend: `http://your-domain.com/` (serves from `../dist`)

Build both before deploying:
```bash
# Build frontend
npm run build

# Build backend
cd server
npm run build

# Start production server
npm start
```

## Security Checklist for Production

- [ ] Change `JWT_SECRET` to a strong random value (32+ characters)
- [ ] Set `NODE_ENV=production`
- [ ] Use HTTPS/TLS for all traffic
- [ ] Set up database backups
- [ ] Configure proper CORS origins (not wildcard)
- [ ] Set up rate limiting (e.g., express-rate-limit)
- [ ] Enable logging and monitoring
- [ ] Run behind a reverse proxy (nginx, Apache)
- [ ] Keep dependencies updated (`npm audit`, `npm update`)
- [ ] Restrict database file permissions
