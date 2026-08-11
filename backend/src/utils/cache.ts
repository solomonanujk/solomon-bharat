import { redis } from '../config/redis';
import { logger } from '../config/logger';

export interface CacheClient {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, ttlSeconds: number): Promise<void>;
  del(...keys: string[]): Promise<void>;
  incr(key: string): Promise<number>;
}

class RedisCacheClient implements CacheClient {
  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await redis.get(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch (err) {
      logger.error({ err, key }, 'Cache read failed, falling back to source');
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    try {
      await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (err) {
      logger.error({ err, key }, 'Cache write failed');
    }
  }

  async del(...keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    try {
      await redis.del(...keys);
    } catch (err) {
      logger.error({ err, keys }, 'Cache invalidation failed');
    }
  }

  /** Used as a namespace version counter so parameterized list caches can be invalidated in O(1). */
  async incr(key: string): Promise<number> {
    try {
      return await redis.incr(key);
    } catch (err) {
      logger.error({ err, key }, 'Cache version increment failed');
      return 0;
    }
  }
}

export const cache: CacheClient = new RedisCacheClient();

/** Deterministic cache key for a parameterized list query, scoped to the namespace's current version. */
export async function versionedListKey(
  cacheClient: CacheClient,
  namespace: string,
  params: Record<string, unknown>,
): Promise<string> {
  const version = (await cacheClient.get<number>(`${namespace}:version`)) ?? 0;
  const paramsKey = JSON.stringify(params, Object.keys(params).sort());
  return `${namespace}:v${version}:${paramsKey}`;
}

export async function bumpVersion(cacheClient: CacheClient, namespace: string): Promise<void> {
  await cacheClient.incr(`${namespace}:version`);
}
