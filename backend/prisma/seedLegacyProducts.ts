/**
 * One-off migration: import real seller/product data exported from the OLD
 * solomon-bharat2 production database into this backend's schema.
 *
 * Source: prisma/legacyImport/legacy-products.json — a read-only export of
 * that old prod DB's Product/ProductPhoto/BrandProfile/User tables (gitignored,
 * contains real seller PII — never commit it). Regenerate it from the old DB
 * if you need to re-run this against fresh source data.
 *
 * What this does NOT do: touch the old database in any way (read-only source),
 * or touch anything the main prisma/seed.ts already created (categories,
 * demo sellers/products/collections/buyers) — this only adds to it.
 *
 * Decisions baked in here (confirmed with the business owner before writing this):
 * - Every imported product lands as approvalStatus=PENDING with no adminPrice set —
 *   sellerPrice is carried over from the old wholesalePriceInr, and a real admin
 *   approves + sets the buyer-facing price through the normal Admin > Products
 *   review flow. No margin is invented here.
 * - Only the old DB's 11 real brands become SellerProfiles (the "dfgh" test
 *   account, which happens to have zero product listings anyway, is skipped).
 * - Old-status INACTIVE listings, exact duplicate listings (same name+brand+price),
 *   and listings with zero photos are excluded — see EXCLUDE_REASONS below for
 *   the full list of what got dropped and why.
 * - The category tree gets 6 new Level-3 leaves (under existing Level-1/2 nodes)
 *   to accommodate real product types the illustrative example tree didn't cover.
 */
import { PrismaClient, Role, ProductApprovalStatus } from '@prisma/client';
import { readFileSync } from 'fs';
import { join } from 'path';
import { hashPassword } from '../src/utils/bcrypt';
import { slugify } from '../src/utils/helpers';

const prisma = new PrismaClient();

interface LegacyProduct {
  id: string;
  name: string;
  description: string;
  wholesalePriceInr: string;
  moq: number;
  stepQty: number;
  weightGrams: number | null;
  material: string | null;
  categories: string[];
  availability: 'ACTIVE' | 'INACTIVE' | 'COMING_SOON';
  leadTime: 'ONE_TO_THREE_DAYS' | 'ONE_TO_TWO_WEEKS' | 'TWO_TO_FOUR_WEEKS';
  isHandmade: boolean;
  isGITagged: boolean;
  lengthCm: number | null;
  breadthCm: number | null;
  heightCm: number | null;
  createdAt: string;
  brandName: string;
  city: string;
  state: string;
  phone: string;
  email: string;
  userName: string;
  photos: string[];
  variants: { type: string; value: string }[];
}

// ─── New category leaves this real catalog needs beyond the illustrative seed tree ─
// Format: [level1 name, level2 name, level3 name]. Level1/Level2 must already
// exist (created by prisma/seed.ts) — only the Level3 leaf is new, EXCEPT
// Fashion Accessories > Footwear, which is a genuinely new Level2 too.
const NEW_LEAVES: Array<[string, string, string]> = [
  ['Home Décor', 'Textiles', 'Bed Linen'],
  ['Home Décor', 'Textiles', 'Towels'],
  ['Home Décor', 'Textiles', 'Eco Fabric & Yarn'],
  ['Home Décor', 'Lighting', 'Decorative Lights'],
  ['Fashion Accessories', 'Footwear', 'Sandals & Footwear'],
  ['Furniture', 'Seating', 'Swings & Hammocks'],
];

const LEAD_TIME_LABEL: Record<LegacyProduct['leadTime'], string> = {
  ONE_TO_THREE_DAYS: '1-3 days',
  ONE_TO_TWO_WEEKS: '1-2 weeks',
  TWO_TO_FOUR_WEEKS: '2-4 weeks',
};

// Real seller businesses to onboard as SellerProfiles. "dfgh" (Gurugram, phone
// "3456789") is excluded as test data — it also has zero product listings.
const REAL_BRAND_NAMES = new Set([
  'Dream Cocoon by toliawala',
  'Ecoban Banana fiber',
  'GAYAMI',
  'Hatkala',
  'LASHKARI CREATIONS',
  'NK Bed Linen And Home Decor',
  'ProteinEggs',
  'R.S Handicrafts World',
  'SWING SAGA',
  'Shanti textile',
  'Toprico',
]);

/** Maps a legacy product to the slug of the Level-3 category it belongs in. */
function classify(p: LegacyProduct): string {
  const name = p.name.toLowerCase();
  const brand = p.brandName.trim();

  if (brand === 'SWING SAGA') {
    return 'furniture-seating-swings-hammocks';
  }

  if (brand === 'Ecoban Banana fiber') {
    if (/tote|\bbag\b/.test(name)) return 'fashion-accessories-bags-totes-tote-bags';
    if (/pendant|hanging lamp|\blamp\b/.test(name)) return 'home-decor-lighting-decorative-lights';
    if (/wall light/.test(name)) return 'home-decor-lighting-decorative-lights';
    if (/wall (decor|frame|hanging)|lord |maa durga|radha krishna|shubh labh|national emblem/.test(name)) {
      return 'home-decor-textiles-wall-hangings';
    }
    return 'home-decor-textiles-eco-fabric-yarn';
  }

  if (brand === 'Hatkala') {
    if (/footwear/.test(name)) return 'fashion-accessories-footwear-sandals-footwear';
    return 'fashion-accessories-bags-totes-tote-bags'; // "Kutchi leather hut bags"
  }

  if (brand === 'NK Bed Linen And Home Decor') {
    if (/bowl/.test(name)) return 'kitchenware-serveware-serving-bowls'; // "Elephant Fruit Bowl"
    return 'home-decor-textiles-bed-linen'; // "Bed Cover (Set of 6)"
  }

  if (brand === 'R.S Handicrafts World') return 'home-decor-textiles-towels';
  if (brand === 'Dream Cocoon by toliawala') return 'home-decor-textiles-bed-linen';
  if (brand === 'Shanti textile') return 'fashion-accessories-bags-totes-clutches';

  throw new Error(`No classification rule for brand "${brand}" / product "${p.name}"`);
}

function formatWeight(grams: number | null): string | null {
  if (!grams) return null;
  return grams >= 1000 ? `${(grams / 1000).toFixed(1)}kg` : `${grams}g`;
}

function formatDimensions(p: LegacyProduct): string | null {
  if (p.lengthCm == null || p.breadthCm == null || p.heightCm == null) return null;
  return `${p.lengthCm}cm x ${p.breadthCm}cm x ${p.heightCm}cm`;
}

function formatCertifications(p: LegacyProduct): string | null {
  const parts: string[] = [];
  if (p.isHandmade) parts.push('Handmade');
  if (p.isGITagged) parts.push('GI Tagged');
  return parts.length ? parts.join(', ') : null;
}

// A handful of old VariantAttribute rows carry internal system metadata rather
// than a real buyer-facing variant (seen in the export: "currencyCountry").
const NON_VARIANT_ATTRIBUTE_TYPES = new Set(['currencyCountry']);

function realVariants(p: LegacyProduct): { type: string; value: string }[] {
  return p.variants.filter((v) => !NON_VARIANT_ATTRIBUTE_TYPES.has(v.type));
}

function formatMaterials(p: LegacyProduct): string {
  if (p.material) return p.material;
  if (p.brandName.trim() === 'Ecoban Banana fiber') return 'Banana Fiber';
  return 'Handcrafted — see description for material details';
}

/** Drops old INACTIVE listings, exact duplicates (same name+brand+price — keeps
 *  the earliest), and listings with zero photos (nothing to show a buyer). */
function filterAndDedupe(all: LegacyProduct[]): { kept: LegacyProduct[]; excluded: Array<{ product: LegacyProduct; reason: string }> } {
  const kept: LegacyProduct[] = [];
  const excluded: Array<{ product: LegacyProduct; reason: string }> = [];
  const seenKeys = new Set<string>();

  const sorted = [...all].sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  for (const p of sorted) {
    if (!REAL_BRAND_NAMES.has(p.brandName.trim())) {
      excluded.push({ product: p, reason: 'test/unverified brand' });
      continue;
    }
    if (p.availability === 'INACTIVE') {
      excluded.push({ product: p, reason: 'old listing marked INACTIVE' });
      continue;
    }
    if (p.photos.length === 0) {
      excluded.push({ product: p, reason: 'zero photos' });
      continue;
    }
    const dedupeKey = `${p.brandName.trim()}::${p.name.trim()}::${p.wholesalePriceInr}`;
    if (seenKeys.has(dedupeKey)) {
      excluded.push({ product: p, reason: 'exact duplicate of an earlier listing' });
      continue;
    }
    seenKeys.add(dedupeKey);
    kept.push(p);
  }

  return { kept, excluded };
}

async function seedNewCategoryLeaves(): Promise<Map<string, string>> {
  const slugToId = new Map<string, string>();

  for (const [l1Name, l2Name, l3Name] of NEW_LEAVES) {
    const l1 = await prisma.category.findFirst({ where: { name: l1Name, level: 1 } });
    if (!l1) throw new Error(`Expected Level-1 category "${l1Name}" to already exist (run the main seed first)`);

    const l2Slug = slugify(`${l1Name}-${l2Name}`);
    let l2 = await prisma.category.findUnique({ where: { slug: l2Slug } });
    if (!l2) {
      const siblingCount = await prisma.category.count({ where: { parentId: l1.id } });
      l2 = await prisma.category.create({
        data: { name: l2Name, slug: l2Slug, level: 2, parentId: l1.id, sortOrder: siblingCount },
      });
      console.log(`Created new Level-2 category: ${l1Name} > ${l2Name}`);
    }

    const l3Slug = slugify(`${l1Name}-${l2Name}-${l3Name}`);
    let l3 = await prisma.category.findUnique({ where: { slug: l3Slug } });
    if (!l3) {
      const siblingCount = await prisma.category.count({ where: { parentId: l2.id } });
      l3 = await prisma.category.create({
        data: { name: l3Name, slug: l3Slug, level: 3, parentId: l2.id, sortOrder: siblingCount },
      });
      console.log(`Created new Level-3 category: ${l1Name} > ${l2Name} > ${l3Name}`);
    }
    slugToId.set(l3Slug, l3.id);
  }

  return slugToId;
}

/** categoryId lookup for the EXISTING leaves this import also reuses (not newly created). */
async function loadExistingLeafIds(): Promise<Map<string, string>> {
  const slugs = [
    'fashion-accessories-bags-totes-tote-bags',
    'fashion-accessories-bags-totes-clutches',
    'home-decor-textiles-wall-hangings',
    'kitchenware-serveware-serving-bowls',
  ];
  const rows = await prisma.category.findMany({ where: { slug: { in: slugs } } });
  if (rows.length !== slugs.length) {
    const found = new Set(rows.map((r) => r.slug));
    const missing = slugs.filter((s) => !found.has(s));
    throw new Error(`Expected existing categories not found: ${missing.join(', ')} — run the main seed first`);
  }
  return new Map(rows.map((r) => [r.slug, r.id]));
}

async function seedLegacySellers(allProducts: LegacyProduct[]): Promise<Map<string, string>> {
  const password = process.env.SEED_SELLER_PASSWORD ?? 'change-me-now';
  const brandToSellerId = new Map<string, string>();

  // Sourced from the FULL export (not just kept/importable products) — a brand
  // whose only listings got excluded (inactive/duplicate/no photos) still gets
  // a seller account, since the business itself is real.
  const byBrand = new Map<string, LegacyProduct>();
  for (const p of allProducts) {
    if (!byBrand.has(p.brandName.trim())) byBrand.set(p.brandName.trim(), p);
  }

  for (const brandName of REAL_BRAND_NAMES) {
    const sample = byBrand.get(brandName);
    if (!sample) {
      // Real brand with zero product rows at all in this export (e.g. GAYAMI,
      // LASHKARI CREATIONS, ProteinEggs, Toprico) — no contact info to onboard
      // from here; create their seller account separately once you have it.
      console.warn(`No product rows found for brand "${brandName}" — skipping seller creation (no contact info in this export)`);
      continue;
    }

    let user = await prisma.user.findUnique({ where: { email: sample.email } });
    if (!user) {
      const passwordHash = await hashPassword(password);
      user = await prisma.user.create({
        data: { email: sample.email, passwordHash, role: Role.SELLER, emailVerifiedAt: new Date() },
      });
      console.log(`Created SELLER user: ${sample.email} (${brandName})`);
    }

    const profile = await prisma.sellerProfile.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        businessName: brandName,
        contactName: sample.userName || brandName,
        phone: sample.phone,
        businessAddress: [sample.city, sample.state, 'India'].filter(Boolean).join(', '),
      },
    });
    brandToSellerId.set(brandName, profile.id);
  }

  console.log(`Legacy sellers seeded: ${brandToSellerId.size}`);
  return brandToSellerId;
}

async function seedLegacyProducts(
  products: LegacyProduct[],
  brandToSellerId: Map<string, string>,
  categoryIdBySlug: Map<string, string>,
): Promise<void> {
  let created = 0;
  let skippedExisting = 0;

  for (const p of products) {
    const sellerId = brandToSellerId.get(p.brandName.trim());
    if (!sellerId) {
      console.warn(`Skipping "${p.name}" — no seller profile for brand "${p.brandName}"`);
      continue;
    }

    const categorySlug = classify(p);
    const categoryId = categoryIdBySlug.get(categorySlug);
    if (!categoryId) {
      console.warn(`Skipping "${p.name}" — category slug "${categorySlug}" not resolved`);
      continue;
    }

    const baseSlug = slugify(p.name);
    const existing = await prisma.product.findUnique({ where: { slug: baseSlug } });
    if (existing) {
      skippedExisting++;
      continue;
    }

    await prisma.product.create({
      data: {
        sellerId,
        categoryId,
        name: p.name.trim(),
        slug: baseSlug,
        description: p.description,
        materials: formatMaterials(p),
        dimensions: formatDimensions(p),
        weight: formatWeight(p.weightGrams),
        moq: p.moq,
        // Old data has no product-level stock (only optional per-variant stock,
        // and every imported product here has none) — placeholder the seller
        // should update from their own portal once handed their account.
        declaredStock: 100,
        sellerPrice: Number(p.wholesalePriceInr),
        adminPrice: null,
        leadTime: LEAD_TIME_LABEL[p.leadTime],
        certifications: formatCertifications(p),
        approvalStatus: ProductApprovalStatus.PENDING,
        isPublished: false,
        isFeatured: false,
        images: { create: p.photos.map((url, i) => ({ url, sortOrder: i })) },
        variants: (() => {
          const variants = realVariants(p);
          return variants.length ? { create: variants } : undefined;
        })(),
      },
    });
    created++;
  }

  console.log(`Legacy products created: ${created} (skipped ${skippedExisting} already-imported)`);
}

async function main(): Promise<void> {
  const dataPath = join(__dirname, 'legacyImport', 'legacy-products.json');
  const all: LegacyProduct[] = JSON.parse(readFileSync(dataPath, 'utf8'));

  const { kept, excluded } = filterAndDedupe(all);

  console.log(`Legacy export: ${all.length} products total`);
  console.log(`Importing: ${kept.length}`);
  console.log(`Excluded: ${excluded.length}`);
  const reasonCounts = new Map<string, number>();
  for (const { reason } of excluded) reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);
  for (const [reason, count] of reasonCounts) console.log(`  - ${count} × ${reason}`);

  const newLeafIds = await seedNewCategoryLeaves();
  const existingLeafIds = await loadExistingLeafIds();
  const categoryIdBySlug = new Map([...newLeafIds, ...existingLeafIds]);

  const brandToSellerId = await seedLegacySellers(all);
  await seedLegacyProducts(kept, brandToSellerId, categoryIdBySlug);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
