import { NextFunction, Request, Response } from 'express';
import { Role, SellerType } from '@prisma/client';
import { verifyAccessToken } from '../utils/jwt';
import { AppError } from '../utils/errors';
import { prisma } from '../config/prisma';

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
export const requireAgent = requireRole(Role.AGENT);
export const requireBuyerOrAgent = requireRole(Role.BUYER, Role.AGENT);

/**
 * Seller who onboarded as a marketplace brand (`SellerType.MARKETPLACE`). The JWT only
 * carries the role, so the seller type is read from the seller profile. Chain after
 * `requireAuth`; it also enforces the SELLER role itself.
 */
export async function requireMarketplaceSeller(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      next(AppError.unauthorized('Authentication token required'));
      return;
    }
    if (req.user.role !== Role.SELLER) {
      next(AppError.forbidden('You do not have permission to perform this action'));
      return;
    }
    const profile = await prisma.sellerProfile.findFirst({
      where: { userId: req.user.id, deletedAt: null },
      select: { sellerType: true },
    });
    if (!profile || profile.sellerType !== SellerType.MARKETPLACE) {
      next(AppError.forbidden('This action is only available to marketplace brand accounts'));
      return;
    }
    next();
  } catch (err) {
    next(err);
  }
}

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
