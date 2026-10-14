/**
 * Adds the Indian craft category tree to an existing database without touching anything else.
 * The server also does this on start; this script is for running it by hand.
 *   npm run seed:categories
 */
import { PrismaClient } from '@prisma/client';
import { seedCraftCategories } from '../src/modules/categories/craftCategories';

const prisma = new PrismaClient();

seedCraftCategories(prisma)
  .then((created) => console.log(`Craft categories: ${created} created, the rest already existed`))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
