import { Context } from 'hono';
import { AppError } from '../lib/errors.js';

export function errorHandler(err: Error, c: Context) {
  console.error(`[Error] ${err.message}`, err.stack);

  if (err instanceof AppError) {
    return c.json(
      { error: { message: err.message, code: err.code } },
      err.statusCode as any,
    );
  }

  return c.json(
    { error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } },
    500,
  );
}
