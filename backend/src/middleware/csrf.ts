import { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/errors';

export const CSRF_COOKIE_NAME = 'csrf_token';
export const CSRF_HEADER_NAME = 'x-csrf-token';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Double-submit cookie CSRF check. Only enforced when the request actually carries
 * the refresh-token cookie (the only ambient credential a browser attaches automatically);
 * pure Bearer-token clients have nothing for an attacker to ride on, so they are exempt.
 */
export function csrfProtection(req: Request, _res: Response, next: NextFunction): void {
  if (SAFE_METHODS.has(req.method)) {
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
