import { z } from 'zod';

// An error that knows the HTTP status to answer with; its message is safe to show to clients
export class HttpError extends Error {
  constructor(public statusCode: number, message: string, public details?: unknown) {
    super(message);
    this.name = 'HttpError';
  }
}

// Validates request data against a zod schema, answering 400 with the issues when it doesn't match
export function parse<S extends z.ZodTypeAny>(schema: S, data: unknown): z.infer<S> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new HttpError(400, 'Invalid input', result.error.errors);
  }
  return result.data;
}
