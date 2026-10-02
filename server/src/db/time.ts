// SQLite's datetime('now') is UTC without a zone marker ("2026-10-01 12:00:00"); the APIs return ISO 8601
export function sqliteToIso(value: string): string;
export function sqliteToIso(value: string | null): string | null;
export function sqliteToIso(value: string | null): string | null {
  return value === null ? null : new Date(`${value.replace(' ', 'T')}Z`).toISOString();
}

// The inverse, so a timestamp built in JS compares correctly with datetime('now') in SQL
export function toSqliteTimestamp(date: Date): string {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}
