import { Request, Response, NextFunction } from 'express';

interface CustomError extends Error {
  statusCode?: number;
  status?: number;
}

// Express recognises error handlers by their four parameters, so _next must stay
export function errorHandler(err: CustomError, req: Request, res: Response, _next: NextFunction): void {
  console.error('Error:', err);

  const statusCode = err.statusCode || err.status || 500;
  // Client errors (e.g. malformed JSON) explain themselves; server errors stay in the log
  // so SQL and other internals aren't sent to the client
  const message = statusCode < 500 && err.message ? err.message : 'Internal server error';

  res.status(statusCode).json({ error: message });
}
