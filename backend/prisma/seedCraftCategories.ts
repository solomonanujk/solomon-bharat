/**
 * Adds the Indian craft category tree to an existing database without touching anything else.
 * Safe to re-run: every category is upserted by slug, and existing ones are left as they are.
 *   npm run seed:categories
 */
import { PrismaClient } from '@prisma/client';
import { slugify } from '../src/utils/helpers';
import { CRAFT_CATEGORY_TREE } from './craftCategories';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  let created = 0;
  const upsert = async (slug: string, data: { name: string; level: number; parentId?: string; sortOrder: number }) => {
    const existing = await prisma.category.findUnique({ where: { slug } });
    if (existing) return existing;
    created += 1;
    return prisma.category.create({ data: { ...data, slug } });
  };

  let sortL1 = 0;
  for (const [l1Name, l2Map] of Object.entries(CRAFT_CATEGORY_TREE)) {
    const l1 = await upsert(slugify(l1Name), { name: l1Name, level: 1, sortOrder: sortL1++ });
    let sortL2 = 0;
    for (const [l2Name, l3Names] of Object.entries(l2Map)) {
      const l2 = await upsert(slugify(`${l1Name}-${l2Name}`), { name: l2Name, level: 2, parentId: l1.id, sortOrder: sortL2++ });
      let sortL3 = 0;
      for (const l3Name of l3Names) {
        await upsert(slugify(`${l1Name}-${l2Name}-${l3Name}`), { name: l3Name, level: 3, parentId: l2.id, sortOrder: sortL3++ });
      }
    }
  }
  console.log(`Craft categories: ${created} created, the rest already existed`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
