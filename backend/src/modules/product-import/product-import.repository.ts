import { PrismaClient } from '@prisma/client';
import { prisma } from '../../config/prisma';

/** Product creation itself goes through ProductsRepository.create — this only holds
 *  the import-specific lookups. */
export class ProductImportRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  /** Which of these SKUs are already taken (ProductVariant.sku is globally unique,
   *  including variants of soft-deleted products). */
  async findExistingVariantSkus(skus: string[]): Promise<string[]> {
    if (skus.length === 0) return [];
    const rows = await this.db.productVariant.findMany({
      where: { sku: { in: skus } },
      select: { sku: true },
    });
    return rows.map((r) => r.sku).filter((s): s is string => s !== null);
  }
}

export const productImportRepository = new ProductImportRepository();
