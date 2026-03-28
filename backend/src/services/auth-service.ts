import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../lib/db.js';
import { config } from '../lib/config.js';
import { writeAuditLog } from '../lib/audit.js';
import { UnauthorizedError, ValidationError, NotFoundError } from '../lib/errors.js';

export interface RegisterInput {
  organizationName: string;
  name: string;
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

function signToken(user: { id: string; organizationId: string; email: string; role: string }): string {
  return jwt.sign(
    { id: user.id, organizationId: user.organizationId, email: user.email, role: user.role },
    config.jwtSecret,
    { expiresIn: '7d' },
  );
}

export async function register(input: RegisterInput) {
  const existing = await db.user.findUnique({ where: { email: input.email } });
  if (existing) throw new ValidationError('Email already registered');

  const passwordHash = await bcrypt.hash(input.password, 12);

  const result = await db.$transaction(async (tx) => {
    const org = await tx.organization.create({
      data: { name: input.organizationName },
    });

    const user = await tx.user.create({
      data: {
        organizationId: org.id,
        name: input.name,
        email: input.email,
        passwordHash,
        role: 'admin',
      },
    });

    return { org, user };
  });

  await writeAuditLog({
    organizationId: result.org.id,
    userId: result.user.id,
    entityType: 'user',
    entityId: result.user.id,
    action: 'register',
  });

  const token = signToken(result.user);
  return {
    token,
    user: { id: result.user.id, name: result.user.name, email: result.user.email, role: result.user.role },
    organization: { id: result.org.id, name: result.org.name },
  };
}

export async function login(input: LoginInput) {
  const user = await db.user.findUnique({
    where: { email: input.email },
    include: { organization: true },
  });
  if (!user) throw new UnauthorizedError('Invalid credentials');
  if (!user.isActive) throw new UnauthorizedError('Account deactivated');

  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) throw new UnauthorizedError('Invalid credentials');

  await writeAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    entityType: 'user',
    entityId: user.id,
    action: 'login',
  });

  const token = signToken(user);
  return {
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
    organization: { id: user.organization.id, name: user.organization.name },
  };
}

export async function getProfile(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: { organization: true },
  });
  if (!user) throw new NotFoundError('User');
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    organization: { id: user.organization.id, name: user.organization.name },
  };
}
