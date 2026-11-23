import { redis } from '../../config/redis';
import { logger } from '../../config/logger';
import { FxProvider, FxRates } from './fxProvider.types';

const CACHE_KEY = 'fx:rates:inr';
const STALE_FALLBACK_KEY = 'fx:rates:inr:stale';
const CACHE_TTL_SECONDS = 60 * 60; // 1h — matches the frontend's own display-side Frankfurter cache cadence

/**
 * Free, keyless live FX rates (api.frankfurter.app), cached in Redis so the
 * PayPal charge amount and the buyer-facing displayed price are computed from
 * the same rate within the same cache window. INR is this platform's single
 * source-of-truth currency — every seller/admin price is entered in INR.
 */
/** Redis read/write that never throws: a Redis outage only costs us the cache, not FX rates. */
async function safeGet(key: string): Promise<string | null> {
  try {
    return await redis.get(key);
  } catch (err) {
    logger.error({ err, key }, 'FX cache read failed');
    return null;
  }
}

async function safeSet(key: string, value: string, ttlSeconds?: number): Promise<void> {
  try {
    if (ttlSeconds) await redis.set(key, value, 'EX', ttlSeconds);
    else await redis.set(key, value);
  } catch (err) {
    logger.error({ err, key }, 'FX cache write failed');
  }
}

export class FrankfurterFxProvider implements FxProvider {
  async getRatesFromInr(): Promise<FxRates> {
    const cached = await safeGet(CACHE_KEY);
    if (cached) {
      return JSON.parse(cached) as FxRates;
    }

    try {
      const res = await fetch('https://api.frankfurter.app/latest?base=INR');
      if (!res.ok) {
        throw new Error(`Frankfurter responded ${res.status}`);
      }
      const data = (await res.json()) as FxRates;

      await safeSet(CACHE_KEY, JSON.stringify(data), CACHE_TTL_SECONDS);
      // No expiry — only overwritten on the next successful fetch, used as a
      // last-resort fallback if Frankfurter is briefly unreachable.
      await safeSet(STALE_FALLBACK_KEY, JSON.stringify(data));

      return data;
    } catch (err) {
      logger.error({ err }, 'FX rate fetch failed, attempting stale fallback');
      const stale = await safeGet(STALE_FALLBACK_KEY);
      if (stale) {
        return JSON.parse(stale) as FxRates;
      }
      throw new Error('FX rates unavailable and no stale fallback cached');
    }
  }
}
