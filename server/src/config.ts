export const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
export const NODE_ENV = process.env.NODE_ENV || 'development';
export const DB_PATH = process.env.DB_PATH || './data/schedules.db';

if (NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable must be set in production');
}
export const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
