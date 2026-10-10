import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Role, SellerType } from '@prisma/client';
import type { NextFunction, Request, Response } from 'express';

const findFirst = vi.fn();
vi.mock('../config/prisma', () => ({ prisma: { sellerProfile: { findFirst: (...a: unknown[]) => findFirst(...a) } } }));

import { requireMarketplaceSeller } from './auth';

function run(user: Request['user']): Promise<unknown> {
  const req = { user } as Request;
  return new Promise((resolve) => {
    const next: NextFunction = (err?: unknown) => resolve(err);
    void requireMarketplaceSeller(req, {} as Response, next);
  });
}

describe('requireMarketplaceSeller', () => {
  beforeEach(() => findFirst.mockReset());

  it('rejects unauthenticated requests with 401', async () => {
    const err = (await run(undefined)) as { statusCode?: number };
    expect(err.statusCode).toBe(401);
  });

  it('rejects non-seller roles with 403', async () => {
    const err = (await run({ id: 'u1', role: Role.BUYER })) as { statusCode?: number };
    expect(err.statusCode).toBe(403);
    expect(findFirst).not.toHaveBeenCalled();
  });

  it('rejects curated sellers with 403', async () => {
    findFirst.mockResolvedValue({ sellerType: SellerType.CURATED });
    const err = (await run({ id: 'u1', role: Role.SELLER })) as { statusCode?: number };
    expect(err.statusCode).toBe(403);
  });

  it('allows marketplace sellers', async () => {
    findFirst.mockResolvedValue({ sellerType: SellerType.MARKETPLACE });
    expect(await run({ id: 'u1', role: Role.SELLER })).toBeUndefined();
  });
});
