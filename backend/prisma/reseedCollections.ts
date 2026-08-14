/**
 * One-off: wipe all existing collections (the 4 old demo/placeholder ones) and
 * replace them with 3 new collections curated from the real product catalog,
 * partitioning all 125 currently-published products with zero overlap.
 */
import { PrismaClient, CollectionStatus } from '@prisma/client';
import { slugify } from '../src/utils/helpers';

const prisma = new PrismaClient();

interface CollectionSpec {
  name: string;
  editorialIntro: string;
  isFeatured: boolean;
  categorySlugs: string[];
}

const SPECS: CollectionSpec[] = [
  {
    name: 'Boho Swings & Hanging Furniture',
    editorialIntro:
      'Handwoven macramé swings, hammocks, and hanging beds for indoor and outdoor living — sourced from our swing specialists in India.',
    isFeatured: true,
    categorySlugs: ['furniture-seating-swings-hammocks'],
  },
  {
    name: 'Sustainable Banana Fiber Edit',
    editorialIntro:
      'Eco-conscious totes, wall art, and lighting handcrafted from natural banana fiber — biodegradable, durable, and quietly beautiful.',
    isFeatured: true,
    categorySlugs: [
      'fashion-accessories-bags-totes-tote-bags',
      'home-decor-textiles-wall-hangings',
      'home-decor-lighting-decorative-lights',
      'home-decor-textiles-eco-fabric-yarn',
    ],
  },
  {
    name: 'Artisan Home & Kitchen Essentials',
    editorialIntro:
      'A handpicked edit of table runners, cookware, ceramics, jewellery, and festive gifting — the everyday craftsmanship of Indian artisans.',
    isFeatured: false,
    categorySlugs: [], // filled below with "everything else published"
  },
];

async function main(): Promise<void> {
  const deleted = await prisma.collection.deleteMany({});
  console.log(`Deleted ${deleted.count} existing collections (memberships cascade-deleted with them).`);

  const allPublished = await prisma.product.findMany({
    where: { isPublished: true },
    select: { id: true, categoryId: true, category: { select: { slug: true } }, images: { orderBy: { sortOrder: 'asc' }, take: 1 } },
  });
  console.log(`Total published products to partition: ${allPublished.length}`);

  const assignedProductIds = new Set<string>();
  let sortOrderCounter = 0;

  for (const spec of SPECS) {
    let members: typeof allPublished;
    if (spec.categorySlugs.length > 0) {
      members = allPublished.filter((p) => spec.categorySlugs.includes(p.category.slug));
    } else {
      // Last collection: everything not already claimed by an earlier spec.
      members = allPublished.filter((p) => !assignedProductIds.has(p.id));
    }
    members.forEach((p) => assignedProductIds.add(p.id));

    const heroImage = members[0]?.images[0]?.url ?? null;
    const slug = slugify(spec.name);

    const collection = await prisma.collection.create({
      data: {
        name: spec.name,
        slug,
        editorialIntro: spec.editorialIntro,
        isFeatured: spec.isFeatured,
        status: CollectionStatus.PUBLISHED,
        heroImage,
      },
    });

    await prisma.productCollection.createMany({
      data: members.map((p, i) => ({ productId: p.id, collectionId: collection.id, sortOrder: i })),
    });

    console.log(`Created "${spec.name}" — ${members.length} products, heroImage: ${heroImage}`);
    sortOrderCounter++;
  }

  const unassigned = allPublished.filter((p) => !assignedProductIds.has(p.id));
  if (unassigned.length > 0) {
    console.warn(`WARNING: ${unassigned.length} published products were not assigned to any collection:`);
    for (const p of unassigned) console.warn(`  - ${p.id} (category ${p.category.slug})`);
  } else {
    console.log('Every published product was assigned to exactly one collection.');
  }
  console.log(`Collections created: ${sortOrderCounter}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
