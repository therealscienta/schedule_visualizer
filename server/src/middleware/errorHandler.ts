import { Request, Response, NextFunction } from 'express';

interface CustomError extends Error {
  statusCode?: number;
  status?: number;
  details?: unknown; // What was wrong with the request, e.g. zod issues
}

// Express recognises error handlers by their four parameters, so _next must stay
export function errorHandler(err: CustomError, req: Request, res: Response, _next: NextFunction): void {
  const statusCode = err.statusCode || err.status || 500;
  if (statusCode >= 500) {
    console.error('Error:', err);
  }

  // Client errors (e.g. malformed JSON) explain themselves; server errors stay in the log
  // so SQL and other internals aren't sent to the client
  const message = statusCode < 500 && err.message ? err.message : 'Internal server error';
  const body: { error: string; details?: unknown } = { error: message };
  if (statusCode < 500 && err.details !== undefined) {
    body.details = err.details;
  }

  res.status(statusCode).json(body);
}
