# Solomon Bharat

B2B wholesale export marketplace connecting verified Indian manufacturers and artisan brands with international buyers. Solomon Bharat is the sole merchant of record — it buys from sellers and sells to buyers; sellers and buyers never transact directly.

See [`AGENTS.md`](./AGENTS.md) for the full architecture reference (module boundaries, business rules, coding standards) and `Solomon-Bharat-PRD-COMPLETE-v3.4.docx` for the product requirements.

## Status

**Backend: complete.** All 12 modules (`auth`, `buyers`, `sellers`, `products`, `categories`, `collections`, `orders`, `payouts`, `payments`, `notifications`, `cms`, `admin`) are built, unit-tested, and verified end-to-end against a live database.

**Frontend: not started.**

## Monorepo Structure

```
solomon-bharat/
├── frontend/        # Next.js App Router (not yet started)
├── backend/          # Node.js + Express + Prisma (complete)
├── AGENTS.md          # Architecture & business-rule reference for AI coding agents
├── docker-compose.yml # Optional local Postgres + Redis
└── .gitignore
```

## Backend

**Stack:** Node.js, Express, TypeScript (strict), Prisma + PostgreSQL, Redis, JWT auth, Zod validation, Vitest, Swagger/OpenAPI.

### Setup

```bash
cd backend
npm install
cp .env.example .env   # then fill in real values — see below
npx prisma migrate deploy
npm run prisma:seed    # creates the SUPER_ADMIN account + an illustrative category tree
npm run dev             # http://localhost:4000, docs at /api/docs
```

### Required environment variables (`backend/.env`)

| Variable | Notes |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string (rate limiting) |
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | Distinct secrets for access/refresh tokens |
| `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET` | Optional — omit to use the built-in mock payment provider for local dev |
| `CLOUDINARY_URL` | Optional — omit to store uploaded images on local disk (`backend/uploads`, served at `/uploads`) |
| `RESEND_API_KEY` | Optional — omit to log outgoing emails to the console instead of sending them |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | Credentials for the SUPER_ADMIN account created by `npm run prisma:seed` |

Third-party integrations (PayPal, Cloudinary, Resend) are all built behind swappable provider interfaces (`backend/src/providers/`) with working mock/local fallbacks — the app runs fully end-to-end without any of those credentials configured.

### Useful scripts

```bash
npm run dev              # start with hot reload
npm run build && npm start   # production build
npm test                  # run the test suite
npm run test:coverage      # run with coverage report
npm run lint                # ESLint
npm run prisma:studio       # browse the database
npm run prisma:migrate      # create a new migration (interactive)
```

### Architecture

Every module follows the same layered pattern:

```
routes → controller → service → repository → Prisma → PostgreSQL
```

- **Controller** — parses the request, calls the service, sends the response. No business logic.
- **Service** — all business rules, cross-module orchestration, error throwing.
- **Repository** — all Prisma queries. No business logic.

RBAC (`SUPER_ADMIN` / `SELLER` / `BUYER`) is enforced entirely at the middleware level (`requireAuth`, `requireAdmin`, `requireSeller`, `requireBuyer`) — never inside services or controllers.

All responses use a consistent envelope: `{ success, data, message, meta }`. Full endpoint documentation is available at `/api/docs` once the server is running.

### Testing

Tests are colocated per module (`*.service.test.ts`) and focus on service-layer business rules — pricing visibility (`seller_price` vs `admin_price`), approval workflows, RBAC boundaries, and order lifecycle transitions. Current coverage sits at ~92% statements across the service layer, with every module above the 70% target set in `AGENTS.md`.

## Frontend

Not yet started. Will be a Next.js (App Router) app mirroring the backend's module names exactly, per `AGENTS.md`.
