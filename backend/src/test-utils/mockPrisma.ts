import { vi } from 'vitest';

/** A Prisma model delegate with every commonly-used method stubbed as a vi.fn(). */
export function mockModel() {
  return {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
    groupBy: vi.fn(),
    upsert: vi.fn(),
    aggregate: vi.fn(),
  };
}

export type MockPrismaModel = ReturnType<typeof mockModel>;
export type MockPrismaClient = Record<string, MockPrismaModel> & { $transaction: ReturnType<typeof vi.fn> };

/** Assembles a mock PrismaClient from named model stubs, plus a pass-through $transaction. */
export function buildMockPrismaClient(models: Record<string, MockPrismaModel>): MockPrismaClient {
  const $transaction = vi.fn().mockImplementation((arg: unknown) => {
    if (Array.isArray(arg)) return Promise.all(arg);
    if (typeof arg === 'function') return (arg as (tx: unknown) => unknown)(models);
    return Promise.resolve(arg);
  });
  return Object.assign({}, models, { $transaction });
}

/**
 * A catch-all mock PrismaClient for controller tests: `createApp()` transitively imports every
 * module's real service/repository, which would otherwise instantiate a real `PrismaClient` at
 * module-load time. Any `prisma.<model>.<method>()` access here returns a fresh vi.fn() resolving
 * to undefined — controller tests mock the service layer directly, so these calls should never
 * actually run, but the Proxy keeps an unexpected real call from throwing "not a function" instead
 * of just resolving to undefined.
 */
export function buildCatchAllMockPrisma(): unknown {
  const modelCache = new Map<string, ReturnType<typeof mockModel>>();
  return new Proxy(
    {},
    {
      get(_target, prop: string) {
        if (prop === '$transaction') {
          return vi.fn().mockImplementation((arg: unknown) => {
            if (Array.isArray(arg)) return Promise.all(arg);
            if (typeof arg === 'function') return (arg as (tx: unknown) => unknown)({});
            return Promise.resolve(arg);
          });
        }
        if (prop === '$disconnect' || prop === '$connect') {
          return vi.fn().mockResolvedValue(undefined);
        }
        if (!modelCache.has(prop)) {
          modelCache.set(prop, mockModel());
        }
        return modelCache.get(prop);
      },
    },
  );
}
