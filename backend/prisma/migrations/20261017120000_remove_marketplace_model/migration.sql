-- Owner decision 17 Oct 2026: the marketplace (brand) model is removed for at least a year.
-- Data-only and non-destructive: no table, column or enum value is dropped, so history and the
-- archive/marketplace-model branch stay compatible.

-- 1. Every seller becomes a curated seller.
UPDATE "seller_profiles" SET "sellerType" = 'CURATED' WHERE "sellerType" = 'MARKETPLACE';

-- 2. Products leave their brand. They stay live with their current adminPrice (admin can re-price).
UPDATE "products" SET "brandId" = NULL WHERE "brandId" IS NOT NULL;

-- 3. Open marketplace applications are reviewed as curated applications.
UPDATE "seller_applications" SET "sellerType" = 'CURATED'
WHERE "sellerType" = 'MARKETPLACE' AND "status" IN ('PENDING', 'MORE_INFO_REQUESTED');

-- 4. Brand storefronts are switched off (rows kept for history).
UPDATE "brands" SET "status" = 'SUSPENDED' WHERE "status" = 'ACTIVE';

-- Historical orders keep "sellerProfileId", commission and payout breakdown columns untouched;
-- the app now manages them through the normal admin order pipeline.
