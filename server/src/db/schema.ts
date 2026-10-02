import { getDatabase } from './connection';

export function initializeDatabase(): void {
  const db = getDatabase();

  // Create users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Create projects table
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      color TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Create schedules table
  db.exec(`
    CREATE TABLE IF NOT EXISTS schedules (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
      label TEXT NOT NULL,
      cron_expression TEXT NOT NULL,
      color TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Create project_shares table
  db.exec(`
    CREATE TABLE IF NOT EXISTS project_shares (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      shared_with_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      permission TEXT NOT NULL DEFAULT 'view',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(project_id, shared_with_user_id)
    );
  `);

  // Create api_tokens table. Only a SHA-256 hash of each token is stored, so a copy of the
  // database can't be used to call the API
  db.exec(`
    CREATE TABLE IF NOT EXISTS api_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      token_prefix TEXT NOT NULL,
      scope TEXT NOT NULL CHECK (scope IN ('read', 'write')),
      expires_at TEXT,
      last_used_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_api_tokens_user ON api_tokens(user_id);
  `);

  // sync_key identifies a schedule that a script manages through PUT /api/v1/projects/:id/schedules.
  // Databases created before API tokens don't have the column yet.
  const scheduleColumns = db.prepare('PRAGMA table_info(schedules)').all() as { name: string }[];
  if (!scheduleColumns.some((column) => column.name === 'sync_key')) {
    db.exec('ALTER TABLE schedules ADD COLUMN sync_key TEXT');
  }
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_schedules_sync_key
      ON schedules(project_id, owner_id, sync_key) WHERE sync_key IS NOT NULL;

    -- A synced schedule that leaves its project (moved, or its project was deleted) is no
    -- longer managed by the script, so the next sync can't update or delete it
    CREATE TRIGGER IF NOT EXISTS trg_schedules_clear_sync_key
      AFTER UPDATE OF project_id ON schedules
      WHEN NEW.sync_key IS NOT NULL AND NEW.project_id IS NOT OLD.project_id
    BEGIN
      UPDATE schedules SET sync_key = NULL WHERE id = NEW.id;
    END;
  `);

  console.log('Database schema initialized successfully');
}
