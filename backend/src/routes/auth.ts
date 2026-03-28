import { Hono } from 'hono';
import { z } from 'zod';
import * as authService from '../services/auth-service.js';
import { authMiddleware, getUser } from '../middleware/auth.js';

const auth = new Hono();

const registerSchema = z.object({
  organizationName: z.string().min(1),
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

auth.post('/register', async (c) => {
  const body = await c.req.json();
  const input = registerSchema.parse(body);
  const result = await authService.register(input);
  return c.json(result, 201);
});

auth.post('/login', async (c) => {
  const body = await c.req.json();
  const input = loginSchema.parse(body);
  const result = await authService.login(input);
  return c.json(result);
});

auth.get('/me', authMiddleware, async (c) => {
  const user = getUser(c);
  const profile = await authService.getProfile(user.id);
  return c.json(profile);
});

export default auth;
