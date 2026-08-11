import { NextFunction, Request, Response } from 'express';
import { Role } from '@prisma/client';
import { verifyAccessToken } from '../utils/jwt';
import { AppError } from '../utils/errors';

function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length).trim();
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = extractBearerToken(req);
  if (!token) {
    next(AppError.unauthorized('Authentication token required'));
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch {
    next(AppError.unauthorized('Invalid or expired token'));
  }
}

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(AppError.unauthorized('Authentication token required'));
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(AppError.forbidden('You do not have permission to perform this action'));
      return;
    }
    next();
  };
}

export const requireAdmin = requireRole(Role.SUPER_ADMIN);
export const requireSeller = requireRole(Role.SELLER);
export const requireBuyer = requireRole(Role.BUYER);

export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = extractBearerToken(req);
  if (!token) {
    next();
    return;
  }
  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, role: payload.role };
  } catch {
    // ignore invalid token for optional auth
  }
  next();
}
