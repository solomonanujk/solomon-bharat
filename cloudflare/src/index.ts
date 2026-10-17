import { Container, getContainer } from '@cloudflare/containers';

/** Every setting the API reads (backend/src/config/env.ts). Values come from wrangler vars and secrets. */
const ENV_KEYS = [
  'NODE_ENV', 'APP_URL', 'DATABASE_URL', 'REDIS_URL',
  'JWT_SECRET', 'JWT_REFRESH_SECRET', 'JWT_EXPIRES_IN', 'JWT_REFRESH_EXPIRES_IN',
  'PAYMENT_MODE', 'PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET', 'PAYPAL_MODE', 'PAYPAL_WEBHOOK_ID',
  'CLOUDINARY_URL', 'RESEND_API_KEY', 'RESEND_FROM_EMAIL',
  'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_WHATSAPP_FROM',
  'GEMINI_API_KEY', 'GEMINI_MODEL', 'OPENROUTER_API_KEY', 'OPENROUTER_MODELS', 'ANTHROPIC_API_KEY',
  'SEED_ADMIN_EMAIL', 'SEED_ADMIN_PASSWORD',
] as const;

/** The Express API, unchanged, running in a container. */
export class Backend extends Container<Env> {
  defaultPort = 4000;
  // Stay warm for an hour after the last request (background jobs such as reading uploads keep running).
  sleepAfter = '1h';
  enableInternet = true;

  constructor(ctx: DurableObjectState<Env>, env: Env) {
    super(ctx, env);
    const vars: Record<string, string> = { PORT: '4000', NODE_OPTIONS: '--dns-result-order=ipv4first' };
    for (const key of ENV_KEYS) {
      // Secrets are not in the generated Env type, so read every key the same way.
      const value = (env as unknown as Record<string, unknown>)[key];
      if (typeof value === 'string' && value) vars[key] = value;
    }
    this.envVars = vars;
  }
}

export default {
  // One instance holds the in-process job queue and caches, so every request goes to the same one.
  async fetch(request: Request, env: Env): Promise<Response> {
    return getContainer(env.BACKEND, 'api').fetch(request);
  },
};
