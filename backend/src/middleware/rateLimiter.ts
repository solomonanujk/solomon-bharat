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

// Login, password-reset and signup email codes (send/verify), per visitor IP, to slow
// password and code guessing. Other public forms (the final sign-up submit, seller/agent
// applications) and the rest of the API are not rate limited.
export const authRateLimiter = createRedisLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  prefix: 'rl:auth:',
});
