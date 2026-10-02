import { Response, NextFunction } from 'express';
import { authenticateToken } from '../services/apiTokens';
import { AuthRequest } from '../types';

// POST requests that only read: their input doesn't fit in a query string, but nothing is changed
const READ_ONLY_POSTS = new Set(['/overlaps/check']);

function reject(res: Response, message: string): void {
  res.set('WWW-Authenticate', 'Bearer realm="schedule-visualiser"').status(401).json({ error: message });
}

// Authenticates a /api/v1 request with an API token. Everything but reads needs a read-write
// token, so a route added later is protected without having to remember to ask for it.
export function apiTokenMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    reject(res, 'No token provided');
    return;
  }

  const auth = authenticateToken(header.substring(7).trim());
  if (!auth) {
    reject(res, 'Invalid, expired or revoked token');
    return;
  }

  const readsOnly = req.method === 'GET' || req.method === 'HEAD' || (req.method === 'POST' && READ_ONLY_POSTS.has(req.path));
  if (!readsOnly && auth.token.scope !== 'write') {
    res.status(403).json({ error: 'This token is read-only' });
    return;
  }

  req.user = auth.user;
  req.apiToken = auth.token;
  next();
}
