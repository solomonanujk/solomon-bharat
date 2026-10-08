import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { redis } from '../config/redis';
import { env } from '../config/env';

function createRedisLimiter(options: { windowMs: number; limit: number; prefix: string; skipInDevelopment?: boolean }) {
  return rateLimit({
    windowMs: options.windowMs,
    limit: options.limit,
    skip: () => Boolean(options.skipInDevelopment) && env.NODE_ENV === 'development',
    standardHeaders: true,
    legacyHeaders: false,
    store: new RedisStore({
      sendCommand: (...args: string[]) =>
        redis.call(args[0], ...args.slice(1)) as Promise<never>,
      prefix: options.prefix,
    }),
    message: {
      success: false,
      data: null,
      message: 'Too many requests, please try again later',
    },
  });
}

// General public API limiter — generous, applied globally. Skipped in local
// development: every request there comes from the same ::1 address, and a
// single browser session (React Query refetches, HMR reloads) burns through
// 300 requests in well under 15 minutes. The auth limiter below stays on.
export const publicRateLimiter = createRedisLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  prefix: 'rl:public:',
  skipInDevelopment: true,
});

// Tighter limiter for auth endpoints (login, signup, password reset) to slow brute force.
export const authRateLimiter = createRedisLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  prefix: 'rl:auth:',
});
