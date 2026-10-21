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
  /** Webhook id from the PayPal developer dashboard; required to verify webhook signatures. */
  PAYPAL_WEBHOOK_ID: z.string().default(''),
  /** 'manual' = bank transfer confirmed by an admin; 'auto' = gateway when configured. */
  PAYMENT_MODE: z.enum(['auto', 'manual']).default('auto'),
  /** WhatsApp notifications via Twilio; leave empty to only log them. */
  /** Enables AI help for product descriptions; empty disables it. */
  ANTHROPIC_API_KEY: z.string().default(''),
  TWILIO_ACCOUNT_SID: z.string().default(''),
  TWILIO_AUTH_TOKEN: z.string().default(''),
  TWILIO_WHATSAPP_FROM: z.string().default(''),
  /** 'auto' uses Meta when its settings are complete, else Twilio, else only logs. */
  WHATSAPP_PROVIDER: z.enum(['auto', 'twilio', 'meta']).default('auto'),
  /**
   * Approved templates for messages we start (the link code) or send after the 24-hour window
   * (review results, order status, payouts, welcome and reply notices). Meta: the template name. Twilio: the Content SID (HX...).
   * Empty means plain text is sent instead. See docs/WHATSAPP_LISTING.md.
   */
  WHATSAPP_TEMPLATE_AUTH: z.string().default(''),
  WHATSAPP_TEMPLATE_PRODUCT_APPROVED: z.string().default(''),
  WHATSAPP_TEMPLATE_PRODUCT_REJECTED: z.string().default(''),
  WHATSAPP_TEMPLATE_PRICING_APPROVED: z.string().default(''),
  WHATSAPP_TEMPLATE_PRICING_REJECTED: z.string().default(''),
  WHATSAPP_TEMPLATE_ORDER_STATUS: z.string().default(''),
  WHATSAPP_TEMPLATE_PAYOUT_PAID: z.string().default(''),
  WHATSAPP_TEMPLATE_SELLER_APPROVED: z.string().default(''),
  WHATSAPP_TEMPLATE_AGENT_APPROVED: z.string().default(''),
  WHATSAPP_TEMPLATE_NEW_MESSAGE: z.string().default(''),
  /** Meta language code of those templates (Twilio ignores it). */
  WHATSAPP_TEMPLATE_LANGUAGE: z.string().default('en'),
  /** WhatsApp Cloud API (Meta) settings; see docs/WHATSAPP_LISTING.md. */
  META_WHATSAPP_ACCESS_TOKEN: z.string().default(''),
  META_WHATSAPP_PHONE_NUMBER_ID: z.string().default(''),
  /** App secret from the Meta app (Settings, Basic): signs every webhook call. */
  META_WHATSAPP_APP_SECRET: z.string().default(''),
  /** A string you choose; Meta sends it back once when you register the webhook. */
  META_WHATSAPP_VERIFY_TOKEN: z.string().default(''),
  META_GRAPH_VERSION: z.string().default('v23.0'),
  /** Public base URL of this API (no trailing slash); Twilio signs webhooks over the full URL. */
  WHATSAPP_WEBHOOK_BASE_URL: z.string().default(''),
  /** Set to 'false' to switch off the AI that reads WhatsApp listings (commands keep working). */
  WHATSAPP_AI_ENABLED: z.string().default('true'),
  /** Most AI calls one seller may trigger per day over WhatsApp; the budget guard. */
  WHATSAPP_AI_DAILY_CAP: z.coerce.number().int().min(0).default(20),
  /** Gemini model that reads WhatsApp listings; keep it a cheap 'lite' model. */
  WHATSAPP_AI_MODEL: z.string().default('gemini-2.5-flash-lite'),
  /** Tried when the main model is busy or over its quota (each model has its own quota); empty disables. */
  WHATSAPP_AI_FALLBACK_MODEL: z.string().default('gemini-3.5-flash-lite'),

  CLOUDINARY_URL: z.string().default(''),

  RESEND_API_KEY: z.string().default(''),
  RESEND_FROM_EMAIL: z.string().default('Solomon Bharat <no-reply@solomonbharat.com>'),

  GEMINI_API_KEY: z.string().default(''),
  /** Solomon AI: OpenRouter key (free models); tried before Gemini/Claude when set. */
  OPENROUTER_API_KEY: z.string().default(''),
  /** Optional comma-separated OpenRouter model ids, tried in order (max 3). */
  OPENROUTER_MODELS: z.string().default(''),
  /** Gemini model for Solomon AI when GEMINI_API_KEY is set. */
  GEMINI_MODEL: z.string().default(''),

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
