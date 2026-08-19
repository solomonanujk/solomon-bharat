# Solomon Bharat

B2B wholesale export marketplace connecting verified Indian manufacturers and artisan brands with international buyers. Solomon Bharat is the sole merchant of record — it buys from sellers and sells to buyers/agents; sellers and buyers/agents never transact directly. Agents are approved independent resellers who buy at their own admin-set price and resell to their own customers off-platform.

See [`AGENTS.md`](./AGENTS.md) for the full architecture reference (module boundaries, business rules, coding standards) and `prd.md` / `Solomon-Bharat-PRD-COMPLETE-v3.4.docx` for the product requirements.

## Status

**Backend: complete.** 14 modules (`auth`, `buyers`, `sellers`, `agent-applications`, `products`, `categories`, `collections`, `orders`, `payouts`, `payments`, `catalogues`, `notifications`, `cms`, `admin`) are built, unit-tested, and verified end-to-end against a live database. Four roles: `SUPER_ADMIN` / `SELLER` / `BUYER` / `AGENT`.

**Frontend: complete.** UI (theme, colors, typography, shadcn/ui components, imagery) is ported from the `solomon-bharat2` codebase's `frontend/` app — see `AGENTS.md` → Frontend / Design System and `prd.md` §12 for the exact tokens. Feature scope follows `prd.md`, which is deliberately narrower than `solomon-bharat2` in places (see `prd.md` §15.4) — reuse the *look*, not the extra features. Includes the public marketplace, Buyer Workspace, Seller Portal, Agent Portal, and Admin Portal.

## Agent Role

Agents are a fourth role alongside buyers and sellers — independent resellers (boutique owners, market traders, social-commerce sellers) who:

- Apply publicly (`/apply-agent`) and are approved by admin, same review pattern as sellers.
- Browse the catalog at a dedicated **agent price**, set by admin independently of the buyer price on the same product/MOQ tiers.
- Build a shareable **PDF catalogue** (image, name, description — no price) from selected products, and share individual products via the native share sheet or a WhatsApp/copy-link/download fallback.
- Buy from Solomon Bharat at the agent price through the same cart/checkout pipeline a buyer uses (shipped to the agent's own address), then resell to their own customers entirely off-platform.

See `prd.md` §9 (Agent Portal) and §10.4–10.6 (admin-side application review, pricing, order flagging) for the full spec.

## Monorepo Structure

```
solomon-bharat/
├── frontend/        # Next.js App Router — public marketplace, Buyer/Seller/Agent/Admin portals
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

RBAC (`SUPER_ADMIN` / `SELLER` / `BUYER` / `AGENT`) is enforced entirely at the middleware level (`requireAuth`, `requireAdmin`, `requireSeller`, `requireBuyer`, `requireAgent`, `requireBuyerOrAgent`) — never inside services or controllers.

All responses use a consistent envelope: `{ success, data, message, meta }`. Full endpoint documentation is available at `/api/docs` once the server is running.

### Testing

Tests are colocated per module (`*.service.test.ts`) and focus on service-layer business rules — pricing visibility (`seller_price` vs `admin_price` vs `agent_price`), approval workflows, RBAC boundaries, and order lifecycle transitions. 483 tests passing across the service layer.

## Frontend

Next.js (App Router) app mirroring the backend's module names, per `AGENTS.md`. UI/theme/components are ported from `solomon-bharat2/frontend`; features are scoped to `prd.md`.

```bash
cd frontend
npm install
cp .env.example .env.local   # NEXT_PUBLIC_API_URL, etc.
npm run dev                   # http://localhost:3000
```

Route groups by role: `(public)` marketplace, `(buyer)` workspace, `(seller)` portal, `(agent)` portal, `(admin)` portal — see `AGENTS.md` → Frontend / Design System and `prd.md` §13.3 for the exact folder structure.
