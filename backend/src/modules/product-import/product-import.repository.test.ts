import { describe, it, expect, beforeEach } from 'vitest';
import { buildMockPrismaClient, mockModel, MockPrismaClient } from '../../test-utils/mockPrisma';
import { ProductImportRepository } from './product-import.repository';

describe('ProductImportRepository', () => {
  let db: MockPrismaClient;
  let repo: ProductImportRepository;

  beforeEach(() => {
    db = buildMockPrismaClient({ productVariant: mockModel() });
    repo = new ProductImportRepository(db as never);
  });

  it('findExistingVariantSkus returns the taken SKUs', async () => {
    db.productVariant.findMany.mockResolvedValue([{ sku: 'A' }, { sku: null }]);
    await expect(repo.findExistingVariantSkus(['A', 'B'])).resolves.toEqual(['A']);
    expect(db.productVariant.findMany).toHaveBeenCalledWith({
      where: { sku: { in: ['A', 'B'] } },
      select: { sku: true },
    });
  });

  it('findExistingVariantSkus skips the query for an empty list', async () => {
    await expect(repo.findExistingVariantSkus([])).resolves.toEqual([]);
    expect(db.productVariant.findMany).not.toHaveBeenCalled();
  });
});
