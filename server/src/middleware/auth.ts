import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config';
import { getDatabase } from '../db/connection';
import { AuthRequest, AuthUser } from '../types';

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    let decoded: AuthUser;
    try {
      decoded = jwt.verify(token, JWT_SECRET) as AuthUser;
    } catch {
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }

    // Re-read the account on every request so disabling, deleting or demoting a user
    // takes effect immediately instead of when their token expires
    const user = getDatabase().prepare(`
      SELECT id, username, email, role, is_active
      FROM users
      WHERE id = ?
    `).get(decoded.id) as (AuthUser & { is_active: number }) | undefined;

    if (!user || !user.is_active) {
      res.status(401).json({ error: 'Account not found or disabled' });
      return;
    }

    req.user = { id: user.id, username: user.username, email: user.email, role: user.role };
    next();
  } catch (err) {
    next(err);
  }
}
