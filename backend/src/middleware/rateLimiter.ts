import rateLimit, { MemoryStore, type Options, type Store, type IncrementResponse } from 'express-rate-limit';
import { redis } from '../config/redis';
import { env } from '../config/env';
import { logger } from '../config/logger';

// Fixed-window counter: one atomic round trip per request. The first hit in a window sets
// the key with its expiry; later hits increment it. Returns { hits, msUntilReset }.
const INCREMENT_SCRIPT = `
local ttl = redis.call("PTTL", KEYS[1])
if ttl <= 0 then
  redis.call("SET", KEYS[1], 1, "PX", ARGV[1])
  return { 1, tonumber(ARGV[1]) }
end
return { redis.call("INCR", KEYS[1]), ttl }
`;

// How long to stop calling Redis after it fails (e.g. Upstash request quota exhausted,
// network outage) before trying it again. Limits are kept in memory in the meantime.
const REDIS_COOLDOWN_MS = 60 * 1000;

/**
 * Redis-backed store that never takes the server down: on any Redis error it logs and
 * falls back to a per-instance in-memory store for a cooldown period. Unlike
 * rate-limit-redis, it sends no commands at construction, so a Redis that rejects
 * every command at boot can't cause an unhandled rejection.
 */
class ResilientRedisStore implements Store {
  prefix: string;
  private windowMs = 60 * 1000;
  private readonly memory = new MemoryStore();
  private redisDisabledUntil = 0;

  constructor(prefix: string) {
    this.prefix = prefix;
  }

  init(options: Options): void {
    this.windowMs = options.windowMs;
    this.memory.init(options);
  }

  private redisUsable(): boolean {
    return Date.now() >= this.redisDisabledUntil;
  }

  private disableRedis(err: unknown, op: string): void {
    if (this.redisUsable()) {
      logger.error({ err, op, prefix: this.prefix }, 'Rate limiter Redis failed; using in-memory limits temporarily');
    }
    this.redisDisabledUntil = Date.now() + REDIS_COOLDOWN_MS;
  }

  async increment(key: string): Promise<IncrementResponse> {
    if (this.redisUsable()) {
      try {
        const result = (await redis.eval(INCREMENT_SCRIPT, 1, this.prefix + key, String(this.windowMs))) as [
          number,
          number,
        ];
        const totalHits = Number(result[0]);
        const msUntilReset = Number(result[1]);
        return { totalHits, resetTime: new Date(Date.now() + msUntilReset) };
      } catch (err) {
        this.disableRedis(err, 'increment');
      }
    }
    return this.memory.increment(key);
  }

  async decrement(key: string): Promise<void> {
    if (this.redisUsable()) {
      try {
        await redis.decr(this.prefix + key);
        return;
      } catch (err) {
        this.disableRedis(err, 'decrement');
      }
    }
    await this.memory.decrement(key);
  }

  async resetKey(key: string): Promise<void> {
    await this.memory.resetKey(key);
    if (this.redisUsable()) {
      try {
        await redis.del(this.prefix + key);
      } catch (err) {
        this.disableRedis(err, 'resetKey');
      }
    }
  }
}

function createRedisLimiter(options: { windowMs: number; limit: number; prefix: string; skipInDevelopment?: boolean }) {
  return rateLimit({
    windowMs: options.windowMs,
    limit: options.limit,
    skip: () => Boolean(options.skipInDevelopment) && env.NODE_ENV === 'development',
    standardHeaders: true,
    legacyHeaders: false,
    // Belt and braces: if the store still throws, let the request through rather than 500.
    passOnStoreError: true,
    store: new ResilientRedisStore(options.prefix),
    message: {
      success: false,
      data: null,
      message: 'Too many requests, please try again later',
    },
  });
}

// Login, password-reset and signup email codes (send/verify), per visitor IP, to slow
// password and code guessing. Other public forms (the final sign-up submit, seller/agent
// applications) and the rest of the API are not rate limited.
export const authRateLimiter = createRedisLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  prefix: 'rl:auth:',
});
