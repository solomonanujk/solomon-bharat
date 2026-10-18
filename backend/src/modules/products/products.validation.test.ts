import { describe, it, expect } from 'vitest';
import {
  createProductSchema,
  readyStockIssue,
  saveDraftSchema,
  updateProductAsAdminSchema,
  updateProductSchema,
} from './products.validation';

const CATEGORY_ID = '3f1c2b8e-1a2b-4c3d-8e4f-123456789abc';

describe('saveDraftSchema (form-shaped payloads)', () => {
  it('accepts a numeric weight (the form sends a number in the JSON draft body)', () => {
    const r = saveDraftSchema.safeParse({ name: 'X', categoryId: CATEGORY_ID, weight: 1.25 });
    expect(r.success).toBe(true);
    expect(r.success && r.data.weight).toBe('1.25');
  });

  it('still accepts a string weight and still enforces the length cap', () => {
    expect(saveDraftSchema.safeParse({ name: 'X', categoryId: CATEGORY_ID, weight: '2' }).success).toBe(true);
    expect(saveDraftSchema.safeParse({ name: 'X', categoryId: CATEGORY_ID, weight: '9'.repeat(101) }).success).toBe(false);
  });

  it('accepts the full draft body the product form builds', () => {
    const r = saveDraftSchema.safeParse({
      name: 'Table Runner',
      categoryId: CATEGORY_ID,
      description: 'd',
      materials: 'Cotton',
      dimensions: '10 x 20 x 0 cm',
      weight: 0.5,
      declaredStock: 12,
      sellerPrice: 100,
      moq: 10,
      priceTiers: [{ moq: 10, sellerPrice: 100 }],
      variants: [
        {
          type: 'Size',
          value: 'S',
          sku: 'S-1',
          status: 'ACTIVE',
          attributes: [{ name: 'Size', value: 'S' }],
          priceTiers: [{ moq: 10, sellerPrice: 100 }],
          inventory: 5,
          weight: 0.5,
          weightUnit: 'kg',
        },
      ],
      placeOfOrigin: 'Jaipur',
      howItIsMade: 'by hand',
      artisanName: 'A',
      ecoMaterials: [],
      ecoPackaging: [],
      ecoProduction: [],
      isBestseller: false,
      tariffCode: '6302',
    });
    expect(r.success).toBe(true);
  });
});

describe('updateProductAsAdminSchema', () => {
  it('keeps adminPrice/agentPrice on tiers, which the seller schema strips', () => {
    const body = { priceTiers: [{ moq: 10, sellerPrice: 5, adminPrice: 8, agentPrice: 7 }] };
    expect(updateProductAsAdminSchema.parse(body).priceTiers).toEqual(body.priceTiers);
    expect(updateProductSchema.parse(body).priceTiers).toEqual([{ moq: 10, sellerPrice: 5 }]);
  });
});

describe('made to order vs ready stock', () => {
  const base = {
    name: 'Rug',
    description: 'd',
    categoryId: CATEGORY_ID,
    materials: 'Wool',
    weight: '2',
    moq: 5,
    sellerPrice: 100,
  };
  const variant = (inventory?: number, status = 'ACTIVE') => ({
    type: 'Size',
    value: 'S',
    status,
    ...(inventory !== undefined ? { inventory } : {}),
  });

  it('ready stock without variants needs declaredStock of at least 1', () => {
    expect(createProductSchema.safeParse({ ...base, isMadeToOrder: 'false', declaredStock: '0' }).success).toBe(false);
    expect(createProductSchema.safeParse({ ...base, isMadeToOrder: 'false', declaredStock: '3' }).success).toBe(true);
  });

  it('made to order needs no stock quantity', () => {
    expect(createProductSchema.safeParse({ ...base, isMadeToOrder: 'true', declaredStock: '0' }).success).toBe(true);
    expect(
      createProductSchema.safeParse({
        ...base,
        isMadeToOrder: 'true',
        declaredStock: '0',
        variants: JSON.stringify([variant()]),
      }).success,
    ).toBe(true);
  });

  it('ready stock with variants needs inventory on every active variant', () => {
    const parse = (variants: unknown[]) =>
      createProductSchema.safeParse({ ...base, isMadeToOrder: 'false', declaredStock: '0', variants: JSON.stringify(variants) });
    expect(parse([variant(4), variant()]).success).toBe(false);
    expect(parse([variant(4), variant(0)]).success).toBe(false);
    expect(parse([variant(4), variant(undefined, 'INACTIVE')]).success).toBe(true);
  });

  it('readyStockIssue skips fields a partial update did not send', () => {
    expect(readyStockIssue({ isMadeToOrder: false })).toBeNull();
    expect(readyStockIssue({ isMadeToOrder: false, declaredStock: 0 })).not.toBeNull();
  });

  it('accepts metres as a variant dimension unit', () => {
    const r = updateProductSchema.safeParse({ variants: [{ type: 'Size', value: 'L', length: 1.2, dimensionUnit: 'm' }] });
    expect(r.success).toBe(true);
  });
});
