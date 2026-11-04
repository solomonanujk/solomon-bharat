import jwt, { SignOptions } from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from '../config/env';
import { Role } from '@prisma/client';

const accessTokenExpiresIn = env.JWT_EXPIRES_IN as SignOptions['expiresIn'];
const refreshTokenExpiresIn = env.JWT_REFRESH_EXPIRES_IN as SignOptions['expiresIn'];

export interface AccessTokenPayload {
  sub: string; // user id
  role: Role;
}

export interface RefreshTokenPayload {
  sub: string; // user id
  jti: string; // refresh token record id
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: accessTokenExpiresIn });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.JWT_SECRET) as AccessTokenPayload;
}

export function signRefreshToken(payload: RefreshTokenPayload): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, { expiresIn: refreshTokenExpiresIn });
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshTokenPayload;
}

/**
 * Signup ticket: issued once a buyer proves they own an email (6-digit code), and
 * required by POST /auth/signup. `purpose` stops an access token (same secret)
 * from being replayed as a ticket.
 */
export interface SignupTicketPayload {
  email: string;
  purpose: 'signup';
}

export function signSignupTicket(email: string): string {
  const payload: SignupTicketPayload = { email, purpose: 'signup' };
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: '2h' });
}

/** Returns the verified email, or null if the ticket is invalid/expired/not a signup ticket. */
export function verifySignupTicket(token: string): string | null {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as Partial<SignupTicketPayload>;
    if (payload.purpose !== 'signup' || typeof payload.email !== 'string') return null;
    return payload.email;
  } catch {
    return null;
  }
}

/** Uniformly random 6-digit numeric code (leading zeros allowed). */
export function generateNumericCode(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
}

export function generateOpaqueToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function generateCsrfToken(): string {
  return crypto.randomBytes(24).toString('hex');
}
