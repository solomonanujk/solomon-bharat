import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { redis } from '../config/redis';

function createRedisLimiter(options: { windowMs: number; limit: number; prefix: string }) {
  return rateLimit({
    windowMs: options.windowMs,
    limit: options.limit,
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

// General public API limiter — generous, applied globally.
export const publicRateLimiter = createRedisLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  prefix: 'rl:public:',
});

// Tighter limiter for auth endpoints (login, signup, password reset) to slow brute force.
export const authRateLimiter = createRedisLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  prefix: 'rl:auth:',
});
