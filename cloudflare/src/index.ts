import { Container, getContainer } from '@cloudflare/containers';

/** Every setting the API reads (backend/src/config/env.ts). Values come from wrangler vars and secrets. */
const ENV_KEYS = [
  'NODE_ENV', 'APP_URL', 'DATABASE_URL', 'REDIS_URL',
  'JWT_SECRET', 'JWT_REFRESH_SECRET', 'JWT_EXPIRES_IN', 'JWT_REFRESH_EXPIRES_IN',
  'PAYMENT_MODE', 'PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET', 'PAYPAL_MODE', 'PAYPAL_WEBHOOK_ID',
  'CLOUDINARY_URL', 'RESEND_API_KEY', 'RESEND_FROM_EMAIL',
  'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_WHATSAPP_FROM',
  'WHATSAPP_WEBHOOK_BASE_URL', 'WHATSAPP_AI_ENABLED', 'WHATSAPP_AI_DAILY_CAP', 'WHATSAPP_AI_MODEL',
  'WHATSAPP_PROVIDER', 'META_WHATSAPP_ACCESS_TOKEN', 'META_WHATSAPP_PHONE_NUMBER_ID', 'META_WHATSAPP_APP_SECRET', 'META_WHATSAPP_VERIFY_TOKEN', 'META_GRAPH_VERSION',
  'WHATSAPP_TEMPLATE_AUTH', 'WHATSAPP_TEMPLATE_PRODUCT_APPROVED', 'WHATSAPP_TEMPLATE_PRODUCT_REJECTED', 'WHATSAPP_TEMPLATE_LANGUAGE',
  'WHATSAPP_TEMPLATE_PRICING_APPROVED', 'WHATSAPP_TEMPLATE_PRICING_REJECTED', 'WHATSAPP_TEMPLATE_ORDER_STATUS',
  'WHATSAPP_TEMPLATE_PAYOUT_PAID', 'WHATSAPP_TEMPLATE_SELLER_APPROVED', 'WHATSAPP_TEMPLATE_AGENT_APPROVED', 'WHATSAPP_TEMPLATE_NEW_MESSAGE',
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
