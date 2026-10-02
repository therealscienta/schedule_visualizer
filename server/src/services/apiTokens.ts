import { createHash, randomBytes } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../db/connection';
import { sqliteToIso, toSqliteTimestamp } from '../db/time';
import { HttpError } from '../errors';
import { ApiTokenInfo, AuthUser, TokenScope } from '../types';
import { getProjectRole } from './access';

export const TOKEN_PREFIX = 'svt_';

// Tokens are 256 random bits, so a fast hash is enough (no salt or key stretching needed)
// and lets a request find its token with one indexed lookup
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

interface TokenRow {
  id: string;
  name: string;
  token_prefix: string;
  scope: TokenScope;
  project_id: string | null;
  project_name: string | null;
  expires_at: string | null;
  last_used_at: string | null;
  created_at: string;
  expired: number;
}

// What the token list shows. The token itself is never stored, so it can't be shown again.
export interface ApiTokenSummary {
  id: string;
  name: string;
  prefix: string; // The first characters of the token, to tell tokens apart
  scope: TokenScope;
  projectId: string | null;
  projectName: string | null;
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
  expired: boolean;
}

const SUMMARIES = `
  SELECT t.id, t.name, t.token_prefix, t.scope, t.project_id, p.name AS project_name,
         t.expires_at, t.last_used_at, t.created_at,
         (t.expires_at IS NOT NULL AND t.expires_at <= datetime('now')) AS expired
  FROM api_tokens t
  LEFT JOIN projects p ON p.id = t.project_id
`;

function toSummary(row: TokenRow): ApiTokenSummary {
  return {
    id: row.id,
    name: row.name,
    prefix: row.token_prefix,
    scope: row.scope,
    projectId: row.project_id,
    projectName: row.project_name,
    expiresAt: sqliteToIso(row.expires_at),
    lastUsedAt: sqliteToIso(row.last_used_at),
    createdAt: sqliteToIso(row.created_at),
    expired: row.expired === 1,
  };
}

export function listApiTokens(userId: string): ApiTokenSummary[] {
  const rows = getDatabase().prepare(`
    ${SUMMARIES}
    WHERE t.user_id = ?
    ORDER BY t.created_at DESC, t.rowid DESC
  `).all(userId) as TokenRow[];
  return rows.map(toSummary);
}

export interface NewApiToken {
  name: string;
  scope: TokenScope;
  projectId?: string | null; // Limits the token to one project the user can access
  expiresInDays?: number | null;
}

// Returns the token itself, which is only available here
export function createApiToken(userId: string, input: NewApiToken): { token: string; summary: ApiTokenSummary } {
  if (input.projectId && getProjectRole(userId, input.projectId) === null) {
    throw new HttpError(404, 'Project not found');
  }

  const token = TOKEN_PREFIX + randomBytes(32).toString('base64url');
  const id = uuidv4();
  const expiresAt = input.expiresInDays ? toSqliteTimestamp(new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000)) : null;

  const db = getDatabase();
  db.prepare(`
    INSERT INTO api_tokens (id, user_id, project_id, name, token_hash, token_prefix, scope, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, userId, input.projectId || null, input.name, hashToken(token), token.slice(0, 12), input.scope, expiresAt);

  const row = db.prepare(`${SUMMARIES} WHERE t.id = ?`).get(id) as TokenRow;
  return { token, summary: toSummary(row) };
}

export function revokeApiToken(userId: string, tokenId: string): void {
  const result = getDatabase().prepare('DELETE FROM api_tokens WHERE id = ? AND user_id = ?').run(tokenId, userId);
  if (result.changes === 0) {
    throw new HttpError(404, 'Token not found');
  }
}

// How often a token's last_used_at is refreshed, so that reads don't each cause a write
const LAST_USED_RESOLUTION_MS = 60 * 1000;

// The token's account and limits, or null when the token is unknown, expired or revoked,
// or its account is disabled or deleted
export function authenticateToken(plaintext: string): { token: ApiTokenInfo; user: AuthUser } | null {
  if (!plaintext.startsWith(TOKEN_PREFIX)) {
    return null;
  }

  const db = getDatabase();
  const row = db.prepare(`
    SELECT t.id, t.name, t.scope, t.project_id, t.expires_at, t.last_used_at,
           u.id AS user_id, u.username, u.email, u.role
    FROM api_tokens t
    JOIN users u ON u.id = t.user_id
    WHERE t.token_hash = ?
      AND u.is_active = 1
      AND (t.expires_at IS NULL OR t.expires_at > datetime('now'))
  `).get(hashToken(plaintext)) as
    | (Omit<TokenRow, 'token_prefix' | 'project_name' | 'created_at' | 'expired'> & Pick<AuthUser, 'username' | 'email' | 'role'> & { user_id: string })
    | undefined;
  if (!row) {
    return null;
  }

  if (!row.last_used_at || Date.now() - Date.parse(sqliteToIso(row.last_used_at)) >= LAST_USED_RESOLUTION_MS) {
    db.prepare("UPDATE api_tokens SET last_used_at = datetime('now') WHERE id = ?").run(row.id);
  }

  return {
    token: {
      id: row.id,
      name: row.name,
      scope: row.scope,
      projectId: row.project_id,
      expiresAt: sqliteToIso(row.expires_at),
    },
    user: { id: row.user_id, username: row.username, email: row.email, role: row.role },
  };
}
