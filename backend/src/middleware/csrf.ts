import { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/errors';

export const CSRF_COOKIE_NAME = 'csrf_token';
export const CSRF_HEADER_NAME = 'x-csrf-token';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Double-submit cookie CSRF check. Only enforced when the request actually carries
 * the refresh-token cookie (the only ambient credential a browser attaches automatically);
 * pure Bearer-token clients have nothing for an attacker to ride on, so they are exempt.
 *
 * /auth/* is exempt outright: signup/login/forgot-password/reset-password/verify-email are
 * driven entirely by the request body or a mailed token, never by the ambient cookie, so
 * there's nothing here for a forged cross-site request to ride on; refresh/logout only ever
 * rotate or clear the requester's own session. Gating them on the double-submit cookie instead
 * created a real lockout: any time the browser's csrf_token cookie and the frontend's stored
 * copy fall out of sync (session-expiry cleanup that never reached the backend's /auth/logout,
 * a stale cookie surviving a client-only logout, a second tab/device), the mismatch permanently
 * blocked even the *next* login attempt with this same "Invalid or missing CSRF token" error,
 * since login was being asked to satisfy a check whose token it hasn't been issued yet.
 */
export function csrfProtection(req: Request, _res: Response, next: NextFunction): void {
  if (SAFE_METHODS.has(req.method) || req.path.startsWith('/auth/')) {
    next();
    return;
  }

  const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];
  if (!cookieToken) {
    next();
    return;
  }

  const headerToken = req.headers[CSRF_HEADER_NAME];
  if (!headerToken || headerToken !== cookieToken) {
    next(AppError.forbidden('Invalid or missing CSRF token'));
    return;
  }

  next();
}
