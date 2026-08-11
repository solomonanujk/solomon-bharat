import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),

  JWT_SECRET: z.string().min(1),
  JWT_REFRESH_SECRET: z.string().min(1),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),

  PAYPAL_CLIENT_ID: z.string().default(''),
  PAYPAL_CLIENT_SECRET: z.string().default(''),
  PAYPAL_MODE: z.enum(['sandbox', 'live']).default('sandbox'),

  CLOUDINARY_URL: z.string().default(''),

  RESEND_API_KEY: z.string().default(''),
  RESEND_FROM_EMAIL: z.string().default('Solomon Bharat <no-reply@solomonbharat.com>'),

  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_URL: z.string().default('http://localhost:3000'),

  SEED_ADMIN_EMAIL: z.string().email().default('admin@solomonbharat.com'),
  SEED_ADMIN_PASSWORD: z.string().min(8).default('change-me-now'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors);
  throw new Error('Invalid environment variables');
}

export const env = parsed.data;
export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
