export const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
export const NODE_ENV = process.env.NODE_ENV || 'development';
export const DB_PATH = process.env.DB_PATH || './data/schedules.db';

// Placeholder values from the docs and example configs; anyone could sign tokens with these
const PLACEHOLDER_SECRETS = [
  'dev-secret-change-in-production',
  'change-this-in-production',
  'your-secret',
  'your-secure-secret',
  'your-secret-key-here-change-this',
  'your-secure-random-secret-here',
  'your-strong-production-secret',
];

if (NODE_ENV === 'production' && (!process.env.JWT_SECRET || PLACEHOLDER_SECRETS.includes(process.env.JWT_SECRET))) {
  throw new Error('JWT_SECRET environment variable must be set to a unique secret in production');
}
export const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
