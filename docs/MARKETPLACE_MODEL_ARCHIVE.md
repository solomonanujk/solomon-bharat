# Marketplace model (archived 17 Oct 2026)

The owner decided on 17 Oct 2026 to run **only the Curated model plus the Agent programme** for at least a year. The marketplace (brand) model was removed from the app in PRD v4.0. The full code is preserved on git branch **`archive/marketplace-model`** (do not commit to it).

## How it worked

| Topic | Rule |
|---|---|
| Seller type | `SellerType.MARKETPLACE`, assigned by the admin at approval (or via the admin Curated ⇄ Marketplace switch, blocked while orders were open). |
| Merchant of record | The brand. Solomon ran the platform, collected payment and kept commission. |
| Pricing | The brand set the buyer price itself (each tier's `sellerPrice` = gross = `adminPrice`), up to 5 tiers, first tier at the MOQ, never rising with quantity. No admin approval: products went live on publish; brands could publish/unpublish themselves. Agents could not see or buy brand products. |
| Commission | 25% on a buyer's first paid order with the brand, 15% on that buyer's later orders (platform defaults, per-brand overrides). 0% for the brand's own buyers (joined via its invite link). Locked at payment (`orderItem.commissionRate/commissionAmount`; `lineSellerTotal` became net). |
| Minimum order value | Each brand had to set a shop MOV (pop-up on sign-in) before listing; enforced per brand at checkout (422 `MIN_ORDER_VALUE_NOT_MET`); samples exempt. |
| Checkout | Cart grouped by brand; one sibling order per brand (`order.sellerProfileId` = brand's seller profile) plus one curated order, sharing a `checkoutId`. |
| Fulfilment | Brand had to accept within 24h of payment or a 10-minute timer auto-cancelled the order (refund). Brand confirmed, shipped with tracking + dispatch photos, delivered. Export documents named the brand as exporter (DAP). |
| Payouts | One payout per item on dispatch: amount = net, with gross/rate/commission recorded. Own-buyer orders paid out on payment. |
| Storefronts | `/brands`, `/brands/[slug]` (story, logo, banner, return policy, follow button), "Buy more from this brand" on the PDP, brand tag on product cards, brand filter in the catalogue, Saved brands tab in the wishlist. |
| Application | `/apply` had a marketplace path (brand name, logo, story, website, MOV, commission terms version `marketplace-2026-10`). |
| Admin | Brands page (verify, suspend, commission overrides), Brand GMV / commission KPIs and revenue-by-brand report, seller-type switch. |

## Key files (on the archive branch)

- Backend: `backend/src/modules/brands/*`, `orders/commission.ts`, brand parts of `orders.service.ts` (`groupByFulfiller`, `findMinOrderViolations`, `lockCommission`, `expireUnacceptedBrandOrders`, `brand*` transitions), `orders.routes.ts` (`/orders/brand/*`), `payouts.service.ts` (`createForDeliveredBrandOrder`, `getBrandSalesStats`), `sellers.service.ts` (`switchSellerType`, brand slug creation), `products.service.ts` (brand pricing/publish paths, `/products/facets/brands`), `middleware/auth.ts` (`requireMarketplaceSeller`), `utils/brandSummary.ts`, `server.ts` (expiry timer).
- Frontend: `app/(public)/brands/*`, `app/(seller)/portal/brand`, `portal/invite`, `portal/orders/[id]`, `app/invite/[code]`, `app/(admin)/admin/brands`, `components/brands/*`, `components/apply/MarketplaceSteps.tsx`, `components/seller-portal/Brand*.tsx`, `lib/sellerCommission.ts`, `lib/cartGroups.ts`, `hooks/queries/useBrand*.ts`, `types/brand-*.ts`.
- Schema (still present on `main`): `Brand`, `BrandFollow`, `BrandOwnBuyer`, `BrandEmailInvite`, `SellerType`, `BrandStatus`, `order.sellerProfileId`, `order.brandOwnBuyer`, commission/gross columns. Migration `20261017120000_remove_marketplace_model` set all sellers to CURATED, cleared `products.brandId` and suspended brands, without dropping anything.

## How to restore

1. `git fetch origin archive/marketplace-model` and branch from it, or cherry-pick/merge its marketplace commits onto current `main` (expect conflicts in the files above).
2. Re-check the migration: brands were set `SUSPENDED` and products lost their `brandId`. Decide per seller whether to re-activate the brand row, set `seller_profiles.sellerType = 'MARKETPLACE'` and re-link products (`UPDATE products SET "brandId" = ...`), and re-price (marketplace prices are gross).
3. Re-add redirects removed from `frontend/next.config.ts` (`/brands*`, `/invite/*`, `/portal/brand`, `/portal/invite`, `/admin/brands`).
4. Restore the legal text (Terms, Seller Agreement, Privacy) and help/marketing copy, and bump `SELLER_AGREEMENT_VERSION`.
5. Update `prd.md` (§17 / §18) and `docs/BUSINESS_DECISIONS.md` with the new owner decision.
