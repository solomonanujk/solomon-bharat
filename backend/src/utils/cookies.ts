import { Response } from 'express';
import { isProduction } from '../config/env';
import { CSRF_COOKIE_NAME } from '../middleware/csrf';

export const REFRESH_COOKIE_NAME = 'refresh_token';
const REFRESH_COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export function setAuthCookies(res: Response, refreshToken: string, csrfToken: string): void {
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: REFRESH_COOKIE_MAX_AGE_MS,
    // Must be sent on every path, not just /api/v1/auth — the frontend's Next.js middleware
    // reads this cookie off page-navigation requests (e.g. /admin/dashboard) to enforce
    // server-side route protection, and a browser never attaches a path-scoped cookie outside
    // that path.
    path: '/',
  });
  res.cookie(CSRF_COOKIE_NAME, csrfToken, {
    httpOnly: false,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: REFRESH_COOKIE_MAX_AGE_MS,
  });
}

export function clearAuthCookies(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, { path: '/' });
  res.clearCookie(CSRF_COOKIE_NAME);
}
