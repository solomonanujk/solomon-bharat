# Moving the backend from Render to Cloudflare

The backend (Express + Prisma) runs unchanged in a **Cloudflare Container**, behind a small Worker.
Database (Neon Postgres), Redis, Cloudinary, Resend and PayPal stay where they are.

Files: `backend/Dockerfile` (the image), `cloudflare/wrangler.jsonc` and `cloudflare/src/index.ts` (the Worker).

## What you need
- A Cloudflare account on the **Workers Paid plan** ($5/month). Containers are not on the free plan.
- The values of the environment variables currently set on Render (DATABASE_URL, REDIS_URL, JWT secrets, etc.).
  If you cannot open Render, get them from wherever you first created them (Neon, Upstash/Redis, Cloudinary, Resend, PayPal).
  New JWT secrets are fine: everyone just has to sign in again.

## One-time setup (from any computer with Node 20+ and Docker)
```bash
git clone https://github.com/solomonanujk/solomon-bharat && cd solomon-bharat/cloudflare
npm install
npx wrangler login            # opens the browser, sign in to Cloudflare

# add each secret (paste the value when asked)
npx wrangler secret put DATABASE_URL
npx wrangler secret put REDIS_URL
npx wrangler secret put JWT_SECRET
npx wrangler secret put JWT_REFRESH_SECRET
npx wrangler secret put APP_URL                # https://www.solomonbharat.com
npx wrangler secret put CLOUDINARY_URL
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put RESEND_FROM_EMAIL
npx wrangler secret put PAYPAL_CLIENT_ID
npx wrangler secret put PAYPAL_CLIENT_SECRET
# optional: GEMINI_API_KEY, OPENROUTER_API_KEY, ANTHROPIC_API_KEY, PAYPAL_WEBHOOK_ID, TWILIO_*, SEED_ADMIN_*

npx wrangler deploy           # builds backend/Dockerfile and deploys
```
Deploy prints a URL like `https://solomon-bharat-backend.<your-subdomain>.workers.dev`.
Check `https://…workers.dev/api/v1/health` returns OK (the first request can take ~20-60 s while the container starts).

## Point the website at it
1. Vercel → Project → Settings → Environment Variables: set `NEXT_PUBLIC_API_URL` to the new URL (no trailing `/api/v1` if the current value has none, keep the same shape as today), then redeploy.
2. Optional: give it your own domain, e.g. `api.solomonbharat.com` (Cloudflare → Workers → solomon-bharat-backend → Settings → Domains), and use that in Vercel instead.
3. PayPal webhooks: update the webhook URL in the PayPal dashboard to the new backend address.
4. When everything works for a few days, suspend the Render service.

## Updating later
Every time `main` changes: `cd cloudflare && npx wrangler deploy`.
(Or connect the repo in Cloudflare → Workers → Settings → Builds with root directory `cloudflare` and deploy command `npx wrangler deploy`.)

## Notes
- One container instance serves all requests, so the in-process upload queue and caches work as on Render.
- It stays awake for 1 hour after the last request (`sleepAfter` in `cloudflare/src/index.ts`), then sleeps; the next visitor wakes it.
- Logs: `cd cloudflare && npx wrangler tail`.
- Database migrations run automatically every time the container starts.
