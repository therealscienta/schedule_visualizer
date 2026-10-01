import { getDatabase } from './connection';

// Resolves a login/share identifier to a user. An email match wins over a username
// match, so a username that looks like someone else's email can't shadow that account.
export function findUserByIdentifier<T>(identifier: string, columns: string): T | undefined {
  const db = getDatabase();
  const byEmail = db.prepare(`SELECT ${columns} FROM users WHERE email = ?`).get(identifier);
  if (byEmail) {
    return byEmail as T;
  }
  return db.prepare(`SELECT ${columns} FROM users WHERE username = ?`).get(identifier) as T | undefined;
}
