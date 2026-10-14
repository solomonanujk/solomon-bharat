# Solomon Bharat — Product Requirements Document

Last updated: 2026-10-14

> **Rule:** every change that adds, removes or changes a feature must update this file in the same pull request (feature table + changelog at the bottom).
> Detailed owner decisions live in [BUSINESS_DECISIONS.md](./BUSINESS_DECISIONS.md). If the two disagree, BUSINESS_DECISIONS.md wins and this file must be corrected.

## 1. Product

Solomon Bharat (Solomon Bharat Private Limited, Jaipur) is a B2B wholesale marketplace. International retailers, boutiques and resellers use it to buy handmade Indian craft products. The first target market is the **UK**. Benchmarks are Faire and Ankorstore.

The site runs two seller models side by side:
- **Curated by Solomon:** Solomon is the merchant of record. The admin sets buyer and agent prices, and products ship through the Jaipur warehouse.
- **Marketplace brand:** the brand sells under its own name, sets its own prices and ships direct. Solomon takes commission.

## 2. Roles

| Role | Who | Main jobs |
|---|---|---|
| Super admin | Solomon team | Approve sellers and assign a type; approve curated products and set buyer/agent prices; confirm bank transfers; run orders, refunds and payouts; read the audit log |
| Seller — Curated | Artisans and manufacturers | List products for review; see only the items ordered from them (no buyer details); get paid on dispatch |
| Seller — Marketplace brand | Brands with GST | List products that go live instantly; set prices, a shop minimum and MOQ; accept orders within 24h; ship with photos; invite their own buyers at 0% commission |
| Buyer | Overseas retailers | Browse, see prices after sign-up, pay in local currency, order, cancel before confirmation, raise custom requests and damage claims |
| Agent | Resellers | Buy curated products at the agent price; ship to an end customer; make white-label catalogue PDFs |

## 3. Features and status

Status: ✅ live · 🟡 partial / needs config · ⛔ not built

### Accounts and onboarding
| Feature | Status | Notes |
|---|---|---|
| Buyer sign-up / login / email verify / reset password | ✅ | |
| Seller application + versioned Seller Agreement acceptance | ✅ | Applicant does not pick a type |
| Admin assigns Curated or Marketplace at approval | ✅ | |
| Agent application and approval | ✅ | Catalogue needs agent contact details |
| Brand invite link `/invite/<code>` and add-customer-by-email | ✅ | Buyer is flagged as the brand's own (0% commission, instant payout) |
| Seller team members (multiple logins) | ⛔ | Waiting on owner |
| Buyer business verification | ⛔ | Deferred |

### Catalogue and products
| Feature | Status | Notes |
|---|---|---|
| Craft category tree (seeded at server start) | ✅ | |
| Mandatory craft fields: technique, region, made-to-order/ready stock, lead time, care, min 2 photos | ✅ | |
| Variants and price tiers (each with its own price/MOQ) | ✅ | |
| Curated products need admin approval; every edit goes back for review | ✅ | |
| **Admin price editor** (Buyer Price + Agent Price) on every curated product, including products with no tiers | ✅ | "Approve & publish with these prices" in review; "Save prices" after approval |
| Marketplace products go live without approval | ✅ | |
| Brand shop minimum order value required before adding/publishing products | ✅ | Dashboard banner if missing |
| Prices hidden from guests (incl. sample price) | ✅ | |
| Samples (offer flag, max qty, price) → "Order a sample" lands in the RFQ inbox | ✅ | |
| "Draft with AI" product descriptions | 🟡 | Needs `ANTHROPIC_API_KEY` |
| Vacation mode; product on/off without approval | ✅ | |
| One-time Shopify/WooCommerce import | ✅ | |

### Buying and payments
| Feature | Status | Notes |
|---|---|---|
| Auto currency detection, switcher, daily FX rates | ✅ | |
| Cart, mixed curated + brand checkout (one order per seller) | ✅ | |
| Brand minimum order enforced at checkout | ✅ | |
| Manual bank transfer; admin confirms with UTR | ✅ | `PAYMENT_MODE=manual` |
| Online payment gateway | ⛔ | Waiting on provider |
| Site-wide custom requirement (RFQ) form; buyer sees own requests | ✅ | Always goes to the Solomon team |
| Buyer ↔ Solomon messaging (curated only) | ✅ | |

### Orders and fulfilment
| Feature | Status | Notes |
|---|---|---|
| Curated lifecycle: Paid → Confirmed → Procuring → At warehouse → QC (photos) → Dispatched → Delivered | ✅ | |
| Marketplace lifecycle: Paid → Awaiting acceptance (24h auto-cancel) → Accepted → Dispatched (photos + tracking) → Delivered | ✅ | |
| Buyer cancellation before confirmation/acceptance; admin records refund | ✅ | |
| Damage claims within 7 days with photos | ✅ | |
| Commercial invoice and packing list PDFs | ✅ | |
| Shipping rates (partner API) and brand shipping choice | ⛔ | Waiting on owner |

### Money
| Feature | Status | Notes |
|---|---|---|
| Commission 25% first / 15% repeat / 0% own buyer, on goods only | ✅ | |
| Payouts on dispatch; instant for own-buyer orders | ✅ | |
| GST TCS / TDS (194-O) | ⛔ | Waiting on owner |

### Admin, compliance and platform
| Feature | Status | Notes |
|---|---|---|
| Admin dashboard to-do counters | ✅ | |
| Full audit log | ✅ | |
| Private internal seller rating (1–5) | ✅ | |
| Email notifications | ✅ | |
| WhatsApp notifications | 🟡 | Needs Twilio config |
| Terms, Privacy, Cookie Policy, Seller Agreement, GDPR cookie banner | ✅ | |
| Help / FAQ / export guide content | ✅ | |
| UK-first homepage | ✅ | |
| Mobile responsive | 🟡 | Brand Sales table (`/portal/orders`) is wider than a phone screen |
| Demo data removed; one admin account only | ✅ | |

## 4. Hosting
- Backend: Render, deployed from `main`. Postgres on Neon, plus Redis.
- Frontend: Vercel at solomonbharat.com, deployed from `main`.

## 5. Changelog
| Date | Change |
|---|---|
| 2026-10-14 | PRD created. Admin price editor works on every product (base tier); brand shop minimum required; sample price hidden from guests (PR #19) |
| 2026-10 (earlier) | Legal pages and cookie banner; order lifecycle and manual payments; brand invites; RFQ; craft categories; audit log; craft fields; samples; vacation mode and rating; export documents; WhatsApp; AI drafts; help content; UK homepage; demo-data purge (PRs #14–#18) |
