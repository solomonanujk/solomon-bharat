import { Response } from 'express';
import { isProduction } from '../config/env';
import { CSRF_COOKIE_NAME } from '../middleware/csrf';

export const REFRESH_COOKIE_NAME = 'refresh_token';
const REFRESH_COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// Frontend (Vercel) and backend (Render) live on different registrable domains in
// production, so the refresh/CSRF cookies are cross-site from the browser's point of
// view. SameSite=Lax is never sent on cross-site fetch/XHR (only top-level navigation),
// which would silently break the refresh-on-401 flow — so production needs
// SameSite=None, which in turn requires Secure (already true whenever isProduction).
// Dev keeps Lax since localhost:3000/localhost:4000 are same-site for cookie purposes.
const COOKIE_SAME_SITE = isProduction ? 'none' : 'lax';

export function setAuthCookies(res: Response, refreshToken: string, csrfToken: string): void {
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: COOKIE_SAME_SITE,
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
    sameSite: COOKIE_SAME_SITE,
    maxAge: REFRESH_COOKIE_MAX_AGE_MS,
  });
}

export function clearAuthCookies(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, { path: '/' });
  res.clearCookie(CSRF_COOKIE_NAME);
}
