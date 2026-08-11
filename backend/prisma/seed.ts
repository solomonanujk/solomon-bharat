import { PrismaClient, Role, ProductApprovalStatus, CollectionStatus } from '@prisma/client';
import { hashPassword } from '../src/utils/bcrypt';
import { slugify } from '../src/utils/helpers';

const prisma = new PrismaClient();

const SELLERS = [
  {
    email: 'seller1@solomonbharat.com',
    businessName: 'Rajesh Handicrafts Export',
    contactName: 'Rajesh Kumar',
    phone: '+91 98100 11223',
    businessAddress: 'Sector 63, Noida, Uttar Pradesh, India',
  },
  {
    email: 'seller2@solomonbharat.com',
    businessName: 'Indus Valley Home Décor',
    contactName: 'Priya Sharma',
    phone: '+91 98200 33445',
    businessAddress: 'Jodhpur Industrial Area, Rajasthan, India',
  },
  {
    email: 'seller3@solomonbharat.com',
    businessName: 'Copper & Clay Artisans',
    contactName: 'Vikram Singh',
    phone: '+91 98300 55667',
    businessAddress: 'Moradabad, Uttar Pradesh, India',
  },
];

const BUYERS = [
  {
    email: 'buyer1@solomonbharat.com',
    companyName: 'Northwind Trading Co.',
    contactName: 'Alex Morgan',
    phone: '+1 415 555 0134',
    country: 'United States',
    address: {
      label: 'Warehouse',
      line1: '450 Market Street',
      line2: 'Suite 200',
      city: 'San Francisco',
      state: 'CA',
      postalCode: '94105',
      country: 'United States',
    },
  },
];

const PRODUCTS: Array<{
  name: string;
  category: string;
  materials: string;
  dimensions: string;
  weight: string;
  moq: number;
  declaredStock: number;
  sellerPrice: number;
  leadTime: string;
  certifications?: string;
  variants?: Array<{ type: string; value: string }>;
  isFeatured?: boolean;
}> = [
  { name: 'Handwoven Cotton Table Runner', category: 'Table Runners', materials: '100% Cotton', dimensions: '180cm x 35cm', weight: '0.3kg', moq: 50, declaredStock: 500, sellerPrice: 4.5, leadTime: '15-20 days', certifications: 'GOTS Certified', variants: [{ type: 'Color', value: 'Indigo' }, { type: 'Color', value: 'Mustard' }], isFeatured: true },
  { name: 'Block Print Cushion Cover Set', category: 'Cushion Covers', materials: 'Cotton Canvas', dimensions: '45cm x 45cm', weight: '0.2kg', moq: 100, declaredStock: 800, sellerPrice: 3.2, leadTime: '10-15 days', variants: [{ type: 'Set Size', value: 'Set of 2' }, { type: 'Set Size', value: 'Set of 4' }] },
  { name: 'Macrame Wall Hanging', category: 'Wall Hangings', materials: 'Cotton Rope', dimensions: '60cm x 90cm', weight: '0.5kg', moq: 30, declaredStock: 200, sellerPrice: 8.0, leadTime: '20-25 days' },
  { name: 'Kantha Embroidered Bed Throw', category: 'Bed Throws', materials: 'Recycled Cotton Sarees', dimensions: '230cm x 260cm', weight: '1.2kg', moq: 25, declaredStock: 150, sellerPrice: 18.0, leadTime: '25-30 days', isFeatured: true },
  { name: 'Blue Pottery Ceramic Vase', category: 'Vases', materials: 'Ceramic, Glaze', dimensions: '25cm H x 12cm Dia', weight: '0.8kg', moq: 40, declaredStock: 300, sellerPrice: 6.5, leadTime: '20 days' },
  { name: 'Terracotta Serving Bowl Set', category: 'Bowls', materials: 'Terracotta Clay', dimensions: '15cm Dia', weight: '0.6kg', moq: 60, declaredStock: 400, sellerPrice: 5.0, leadTime: '15 days', variants: [{ type: 'Set Size', value: 'Set of 4' }] },
  { name: 'Ceramic Hanging Planter', category: 'Planters', materials: 'Stoneware Ceramic', dimensions: '18cm Dia', weight: '0.7kg', moq: 50, declaredStock: 250, sellerPrice: 4.2, leadTime: '18 days' },
  { name: 'Hand-Painted Decorative Plate', category: 'Decorative Plates', materials: 'Bone China', dimensions: '30cm Dia', weight: '0.9kg', moq: 40, declaredStock: 200, sellerPrice: 9.5, leadTime: '22 days', isFeatured: true },
  { name: 'Brass Pendant Light', category: 'Pendant Lights', materials: 'Brass, Iron', dimensions: '35cm H x 25cm Dia', weight: '1.5kg', moq: 20, declaredStock: 100, sellerPrice: 22.0, leadTime: '30 days' },
  { name: 'Marble Base Table Lamp', category: 'Table Lamps', materials: 'Marble, Brass, Cotton Shade', dimensions: '45cm H', weight: '2.0kg', moq: 15, declaredStock: 80, sellerPrice: 28.0, leadTime: '30-35 days' },
  { name: 'Brass Candle Holder Trio', category: 'Candle Holders', materials: 'Brass', dimensions: '10-20cm H (set of 3)', weight: '0.9kg', moq: 50, declaredStock: 300, sellerPrice: 7.0, leadTime: '15 days' },
  { name: 'Cast Iron Kadhai', category: 'Kadhai', materials: 'Cast Iron', dimensions: '28cm Dia', weight: '2.5kg', moq: 30, declaredStock: 150, sellerPrice: 12.0, leadTime: '20 days', certifications: 'FDA Approved', isFeatured: true },
  { name: 'Non-Stick Iron Tawa', category: 'Tawa', materials: 'Iron, Non-stick Coating', dimensions: '26cm Dia', weight: '1.1kg', moq: 40, declaredStock: 200, sellerPrice: 8.5, leadTime: '18 days' },
  { name: 'Copper Handi Cookware', category: 'Handi', materials: 'Copper, Brass', dimensions: '20cm Dia', weight: '1.3kg', moq: 25, declaredStock: 120, sellerPrice: 15.0, leadTime: '25 days' },
  { name: 'Stainless Steel Sauce Pan Set', category: 'Sauce Pans', materials: 'Stainless Steel', dimensions: '16-20cm (set of 3)', weight: '1.8kg', moq: 30, declaredStock: 180, sellerPrice: 19.0, leadTime: '20 days', certifications: 'ISI Marked', variants: [{ type: 'Set Size', value: 'Set of 3' }] },
  { name: 'Silver Filigree Necklace', category: 'Necklaces', materials: '925 Silver', dimensions: '45cm Chain', weight: '0.05kg', moq: 20, declaredStock: 100, sellerPrice: 32.0, leadTime: '25 days', certifications: 'Hallmarked', isFeatured: true },
  { name: 'Kundan Drop Earrings', category: 'Earrings', materials: 'Kundan, Alloy', dimensions: '5cm Drop', weight: '0.02kg', moq: 50, declaredStock: 400, sellerPrice: 6.0, leadTime: '15 days' },
  { name: 'Lac Bangles Set of 6', category: 'Bangles', materials: 'Lac, Glass Beads', dimensions: '2.6in Dia', weight: '0.15kg', moq: 60, declaredStock: 500, sellerPrice: 9.0, leadTime: '18 days', variants: [{ type: 'Color', value: 'Red' }, { type: 'Color', value: 'Green' }, { type: 'Color', value: 'Multicolor' }] },
  { name: 'Hand-Embroidered Potli Bag', category: 'Potli Bags', materials: 'Silk, Zari Thread', dimensions: '15cm x 20cm', weight: '0.1kg', moq: 80, declaredStock: 600, sellerPrice: 4.8, leadTime: '20 days' },
  { name: 'Jute Diwali Gift Hamper Box', category: 'Diwali Sets', materials: 'Jute, Cardboard', dimensions: '30cm x 20cm x 10cm', weight: '0.5kg', moq: 40, declaredStock: 250, sellerPrice: 11.0, leadTime: '20-25 days' },
];

const COLLECTIONS: Array<{
  name: string;
  editorialIntro: string;
  isFeatured: boolean;
  productNames: string[];
}> = [
  {
    name: 'New Arrivals',
    editorialIntro: 'Freshly onboarded pieces from our artisan network, ready for export.',
    isFeatured: true,
    productNames: [
      'Handwoven Cotton Table Runner',
      'Kantha Embroidered Bed Throw',
      'Hand-Painted Decorative Plate',
      'Cast Iron Kadhai',
      'Silver Filigree Necklace',
      'Jute Diwali Gift Hamper Box',
    ],
  },
  {
    name: 'Artisan Home & Décor',
    editorialIntro: 'Handcrafted textiles, ceramics, and lighting for the modern home.',
    isFeatured: true,
    productNames: [
      'Handwoven Cotton Table Runner',
      'Block Print Cushion Cover Set',
      'Macrame Wall Hanging',
      'Kantha Embroidered Bed Throw',
      'Blue Pottery Ceramic Vase',
      'Terracotta Serving Bowl Set',
      'Ceramic Hanging Planter',
      'Hand-Painted Decorative Plate',
      'Brass Pendant Light',
      'Marble Base Table Lamp',
      'Brass Candle Holder Trio',
    ],
  },
  {
    name: 'Kitchen Essentials',
    editorialIntro: 'Traditional cookware built for daily use, sourced from Moradabad artisans.',
    isFeatured: false,
    productNames: ['Cast Iron Kadhai', 'Non-Stick Iron Tawa', 'Copper Handi Cookware', 'Stainless Steel Sauce Pan Set'],
  },
  {
    name: 'Festive & Gifting Edit',
    editorialIntro: 'Jewellery, potli bags, and hampers curated for the festive season.',
    isFeatured: false,
    productNames: [
      'Silver Filigree Necklace',
      'Kundan Drop Earrings',
      'Lac Bangles Set of 6',
      'Hand-Embroidered Potli Bag',
      'Jute Diwali Gift Hamper Box',
    ],
  },
];

const CATEGORY_TREE: Record<string, Record<string, string[]>> = {
  'Home Décor': {
    Textiles: ['Table Runners', 'Cushion Covers', 'Wall Hangings', 'Bed Throws'],
    Ceramics: ['Vases', 'Bowls', 'Planters', 'Decorative Plates'],
    Lighting: ['Pendant Lights', 'Table Lamps', 'Candle Holders'],
  },
  Kitchenware: {
    Cookware: ['Kadhai', 'Tawa', 'Handi', 'Sauce Pans'],
    Serveware: ['Serving Bowls', 'Platters', 'Trays', 'Condiment Sets'],
  },
  'Fashion Accessories': {
    Jewellery: ['Necklaces', 'Earrings', 'Bangles', 'Rings'],
    'Bags & Totes': ['Tote Bags', 'Clutches', 'Potli Bags'],
  },
  Gifting: {
    'Festive Hampers': ['Diwali Sets', 'Wedding Favours', 'Corporate Gifts'],
  },
  Furniture: {
    Seating: ['Chairs', 'Stools', 'Floor Cushions', 'Ottomans'],
    Storage: ['Shelves', 'Cabinets', 'Baskets', 'Boxes'],
  },
};

async function seedAdmin(): Promise<void> {
  const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@solomonbharat.com';
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'change-me-now';

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`SUPER_ADMIN already exists: ${email}`);
    return;
  }

  const passwordHash = await hashPassword(password);
  await prisma.user.create({
    data: {
      email,
      passwordHash,
      role: Role.SUPER_ADMIN,
      emailVerifiedAt: new Date(),
    },
  });
  console.log(`Created SUPER_ADMIN: ${email}`);
}

async function seedCategories(): Promise<void> {
  let sortL1 = 0;
  for (const [l1Name, l2Map] of Object.entries(CATEGORY_TREE)) {
    const l1 = await prisma.category.upsert({
      where: { slug: slugify(l1Name) },
      update: {},
      create: {
        name: l1Name,
        slug: slugify(l1Name),
        level: 1,
        sortOrder: sortL1++,
      },
    });

    let sortL2 = 0;
    for (const [l2Name, l3Names] of Object.entries(l2Map)) {
      const l2Slug = slugify(`${l1Name}-${l2Name}`);
      const l2 = await prisma.category.upsert({
        where: { slug: l2Slug },
        update: {},
        create: {
          name: l2Name,
          slug: l2Slug,
          level: 2,
          parentId: l1.id,
          sortOrder: sortL2++,
        },
      });

      let sortL3 = 0;
      for (const l3Name of l3Names) {
        const l3Slug = slugify(`${l1Name}-${l2Name}-${l3Name}`);
        await prisma.category.upsert({
          where: { slug: l3Slug },
          update: {},
          create: {
            name: l3Name,
            slug: l3Slug,
            level: 3,
            parentId: l2.id,
            sortOrder: sortL3++,
          },
        });
      }
    }
  }
  console.log('Category tree seeded');
}

async function seedSellers(): Promise<string[]> {
  const password = process.env.SEED_SELLER_PASSWORD ?? 'change-me-now';
  const sellerProfileIds: string[] = [];

  for (const seller of SELLERS) {
    let user = await prisma.user.findUnique({ where: { email: seller.email } });
    if (!user) {
      const passwordHash = await hashPassword(password);
      user = await prisma.user.create({
        data: {
          email: seller.email,
          passwordHash,
          role: Role.SELLER,
          emailVerifiedAt: new Date(),
        },
      });
      console.log(`Created SELLER user: ${seller.email}`);
    }

    const profile = await prisma.sellerProfile.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        businessName: seller.businessName,
        contactName: seller.contactName,
        phone: seller.phone,
        businessAddress: seller.businessAddress,
      },
    });
    sellerProfileIds.push(profile.id);
  }

  console.log('Sellers seeded');
  return sellerProfileIds;
}

async function seedProducts(sellerProfileIds: string[]): Promise<void> {
  for (const [index, item] of PRODUCTS.entries()) {
    const category = await prisma.category.findFirst({
      where: { name: item.category, level: 3 },
    });
    if (!category) {
      console.warn(`Skipping "${item.name}" — category "${item.category}" not found`);
      continue;
    }

    const sellerId = sellerProfileIds[index % sellerProfileIds.length];
    const slug = slugify(item.name);
    const adminPrice = Math.round(item.sellerPrice * 1.35 * 100) / 100;

    const existing = await prisma.product.findUnique({ where: { slug } });
    if (existing) {
      console.log(`Product already exists: ${item.name}`);
      continue;
    }

    await prisma.product.create({
      data: {
        sellerId,
        categoryId: category.id,
        name: item.name,
        slug,
        description: `${item.name} — handcrafted by artisans, made from ${item.materials.toLowerCase()}. Export-ready with MOQ of ${item.moq} units.`,
        materials: item.materials,
        dimensions: item.dimensions,
        weight: item.weight,
        moq: item.moq,
        declaredStock: item.declaredStock,
        sellerPrice: item.sellerPrice,
        adminPrice,
        leadTime: item.leadTime,
        certifications: item.certifications,
        approvalStatus: ProductApprovalStatus.APPROVED,
        isPublished: true,
        isFeatured: item.isFeatured ?? false,
        publishedAt: new Date(),
        images: {
          create: [
            { url: `https://picsum.photos/seed/${slug}-1/800/600`, sortOrder: 0 },
            { url: `https://picsum.photos/seed/${slug}-2/800/600`, sortOrder: 1 },
          ],
        },
        variants: item.variants
          ? { create: item.variants }
          : undefined,
      },
    });
    console.log(`Created product: ${item.name}`);
  }
}

async function seedBuyers(): Promise<void> {
  const password = process.env.SEED_BUYER_PASSWORD ?? 'change-me-now';

  for (const buyer of BUYERS) {
    let user = await prisma.user.findUnique({ where: { email: buyer.email } });
    if (!user) {
      const passwordHash = await hashPassword(password);
      user = await prisma.user.create({
        data: {
          email: buyer.email,
          passwordHash,
          role: Role.BUYER,
          emailVerifiedAt: new Date(),
        },
      });
      console.log(`Created BUYER user: ${buyer.email}`);
    }

    const profile = await prisma.buyerProfile.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        companyName: buyer.companyName,
        contactName: buyer.contactName,
        phone: buyer.phone,
        country: buyer.country,
      },
    });

    const existingAddress = await prisma.address.findFirst({ where: { buyerId: profile.id } });
    if (!existingAddress) {
      await prisma.address.create({
        data: { buyerId: profile.id, isDefault: true, ...buyer.address },
      });
    }
  }
  console.log('Buyers seeded');
}

async function seedCollections(): Promise<void> {
  let sortOrder = 0;
  for (const item of COLLECTIONS) {
    const slug = slugify(item.name);
    const collection = await prisma.collection.upsert({
      where: { slug },
      update: {},
      create: {
        name: item.name,
        slug,
        editorialIntro: item.editorialIntro,
        isFeatured: item.isFeatured,
        status: CollectionStatus.PUBLISHED,
        heroImage: `https://picsum.photos/seed/${slug}-hero/1200/600`,
      },
    });

    let productSortOrder = 0;
    for (const productName of item.productNames) {
      const product = await prisma.product.findUnique({ where: { slug: slugify(productName) } });
      if (!product) {
        console.warn(`Skipping "${productName}" in collection "${item.name}" — product not found`);
        continue;
      }
      await prisma.productCollection.upsert({
        where: { productId_collectionId: { productId: product.id, collectionId: collection.id } },
        update: {},
        create: { productId: product.id, collectionId: collection.id, sortOrder: productSortOrder++ },
      });
    }

    sortOrder++;
  }
  console.log(`Collections seeded (${sortOrder})`);
}

async function main(): Promise<void> {
  await seedAdmin();
  await seedCategories();
  const sellerProfileIds = await seedSellers();
  await seedProducts(sellerProfileIds);
  await seedCollections();
  await seedBuyers();
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
