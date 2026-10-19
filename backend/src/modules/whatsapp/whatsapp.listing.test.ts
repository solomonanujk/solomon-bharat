import { describe, expect, it } from 'vitest';
import { ListingDraft, dimensionsString, mergeDraft, missingFields, toCreateInput } from './whatsapp.listing';

const complete: ListingDraft = {
  name: 'Brass Diya',
  description: 'Hand finished brass diya.',
  categoryId: 'cat-1',
  categoryPath: 'Home > Decor > Diyas',
  materials: 'Brass',
  craftTechnique: 'Hand cast',
  placeOfOrigin: 'Moradabad',
  price: 250,
  moq: 10,
  stock: 100,
  weightKg: 0.2,
  length: 8,
  width: 8,
  height: 4,
  dimensionUnit: 'cm',
  leadTime: '7-10 days',
  careInstructions: 'Wipe with a dry cloth',
  hsn: '7418',
};

describe('missingFields', () => {
  it('lists everything for an empty draft, in question order', () => {
    expect(missingFields({}, 0)).toEqual([
      'photos', 'name', 'category', 'price', 'moq', 'stock', 'materials', 'description',
      'craftTechnique', 'placeOfOrigin', 'weight', 'dimensions', 'leadTime', 'careInstructions', 'hsn',
    ]);
  });

  it('is empty for a complete draft with two photos', () => {
    expect(missingFields(complete, 2)).toEqual([]);
  });

  it('needs at least two photos', () => {
    expect(missingFields(complete, 1)).toEqual(['photos']);
  });

  it('does not ask for stock when the product is made to order', () => {
    const { stock: _stock, ...rest } = complete;
    expect(missingFields({ ...rest, madeToOrder: true }, 2)).toEqual([]);
    expect(missingFields(rest, 2)).toEqual(['stock']);
  });

  it('asks for the whole size when any part or the unit is missing', () => {
    expect(missingFields({ ...complete, height: undefined }, 2)).toEqual(['dimensions']);
    expect(missingFields({ ...complete, dimensionUnit: undefined }, 2)).toEqual(['dimensions']);
  });

  it('treats blank text as missing', () => {
    expect(missingFields({ ...complete, materials: '   ' }, 2)).toEqual(['materials']);
  });
});

describe('mergeDraft', () => {
  it('adds new values and never erases with undefined', () => {
    const merged = mergeDraft({ name: 'A', price: 5 }, { price: 9, moq: undefined, materials: 'Wood' });
    expect(merged).toEqual({ name: 'A', price: 9, materials: 'Wood' });
  });

  it('made to order replaces stock; a stock figure replaces made to order', () => {
    expect(mergeDraft({ stock: 20 }, { madeToOrder: true })).toEqual({ madeToOrder: true });
    expect(mergeDraft({ madeToOrder: true }, { stock: 30 })).toEqual({ madeToOrder: false, stock: 30 });
  });

  it('marks an HSN as suggested only when the patch says so', () => {
    expect(mergeDraft({}, { hsn: '7418', hsnSuggested: true }).hsnSuggested).toBe(true);
    expect(mergeDraft({ hsn: '7418', hsnSuggested: true }, { hsn: '7419' }).hsnSuggested).toBe(false);
  });

  it('drops pending category options once a category is chosen', () => {
    const merged = mergeDraft({ categoryOptions: [{ id: 'a', name: 'A', path: 'X > A' }] }, { categoryId: 'a' });
    expect(merged.categoryOptions).toBeUndefined();
  });
});

describe('dimensionsString', () => {
  it('uses the web form format', () => {
    expect(dimensionsString(complete)).toBe('8 x 8 x 4 cm');
    expect(dimensionsString({ length: 1 })).toBeUndefined();
  });
});

describe('toCreateInput', () => {
  it('builds the same input the website form submits, with one flat price tier', () => {
    expect(toCreateInput(complete)).toMatchObject({
      name: 'Brass Diya',
      categoryId: 'cat-1',
      weight: '0.2',
      dimensions: '8 x 8 x 4 cm',
      moq: 10,
      declaredStock: 100,
      sellerPrice: 250,
      priceTiers: [{ moq: 10, sellerPrice: 250 }],
      isMadeToOrder: false,
      tariffCode: '7418',
    });
  });

  it('uses zero stock for made-to-order products', () => {
    const { stock: _stock, ...rest } = complete;
    expect(toCreateInput({ ...rest, madeToOrder: true })).toMatchObject({ declaredStock: 0, isMadeToOrder: true });
  });
});
