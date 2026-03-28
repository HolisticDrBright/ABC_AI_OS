import { Context, Next } from 'hono';
import jwt from 'jsonwebtoken';
import { config } from '../lib/config.js';
import { UnauthorizedError } from '../lib/errors.js';

export interface AuthUser {
  id: string;
  organizationId: string;
  email: string;
  role: string;
}

export async function authMiddleware(c: Context, next: Next) {
  const header = c.req.header('Authorization');
  if (!header?.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing authorization token');
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, config.jwtSecret) as AuthUser;
    c.set('user', payload);
    await next();
  } catch {
    throw new UnauthorizedError('Invalid or expired token');
  }
}

export function getUser(c: Context): AuthUser {
  const user = c.get('user') as AuthUser | undefined;
  if (!user) throw new UnauthorizedError();
  return user;
}
