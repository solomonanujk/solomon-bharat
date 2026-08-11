import { vi } from 'vitest';
import { CacheClient } from '../utils/cache';

/** A no-op mock cache — always misses on read, so tests exercise the real fetch path by default. */
export function buildMockCache(): CacheClient {
  return {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    del: vi.fn().mockResolvedValue(undefined),
    incr: vi.fn().mockResolvedValue(1),
  };
}
