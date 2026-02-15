import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';

export function adminMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  if (req.user.role !== 'admin') {
    res.status(403).json({ error: 'Admin privileges required' });
    return;
  }

  next();
}
