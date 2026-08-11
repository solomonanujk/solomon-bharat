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

export function generateOpaqueToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function generateCsrfToken(): string {
  return crypto.randomBytes(24).toString('hex');
}
