import { Role } from '@prisma/client';
import { signAccessToken } from '../utils/jwt';

/** Builds a Supertest-ready Authorization header for the given role. */
export function authHeader(role: Role, userId = `${role.toLowerCase()}-user-1`): { Authorization: string } {
  return { Authorization: `Bearer ${signAccessToken({ sub: userId, role })}` };
}
