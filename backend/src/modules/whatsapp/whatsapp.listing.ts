/**
 * The product a seller is describing in chat, and the rules for when it is complete.
 * Pure functions only (no database, no AI), so they are cheap to test and cost nothing to run.
 */
import type { CreateProductInput } from '../products/products.types';

export const DIMENSION_UNITS = ['cm', 'in', 'm'] as const;
export type DimensionUnit = (typeof DIMENSION_UNITS)[number];

export interface CategoryOption {
  id: string;
  name: string;
  path: string;
}

export interface ListingDraft {
  name?: string;
  description?: string;
  /** Free-text product type from the AI ("cotton saree"), used to find the real category. */
  categoryText?: string;
  categoryId?: string;
  categoryPath?: string;
  /** Close matches shown to the seller while the category is still ambiguous. */
  categoryOptions?: CategoryOption[];
  /** How many times the seller has been asked to pick the category. */
  categoryAsks?: number;
  /** True when the category is our closest match after the seller did not settle it. */
  categorySuggested?: boolean;
  materials?: string;
  craftTechnique?: string;
  placeOfOrigin?: string;
  /** Rupees per piece. */
  price?: number;
  moq?: number;
  stock?: number;
  madeToOrder?: boolean;
  weightKg?: number;
  length?: number;
  width?: number;
  height?: number;
  dimensionUnit?: DimensionUnit;
  leadTime?: string;
  careInstructions?: string;
  hsn?: string;
  /** True when the HSN code is the AI's guess, not something the seller said. */
  hsnSuggested?: boolean;
  /** How many times the seller has been asked for the HSN code. */
  hsnAsks?: number;
  /** True when the seller did not know the HSN code and we could not suggest one; the team fills it in. */
  hsnSkipped?: boolean;
  isGITagged?: boolean;
  artisanName?: string;
}

/** Questions are asked in this order. */
export const FIELD_ORDER = [
  'photos',
  'name',
  'category',
  'price',
  'moq',
  'stock',
  'materials',
  'description',
  'craftTechnique',
  'placeOfOrigin',
  'weight',
  'dimensions',
  'leadTime',
  'careInstructions',
  'hsn',
] as const;
export type FieldKey = (typeof FIELD_ORDER)[number];

export const MIN_PHOTOS = 2;
export const MAX_PHOTOS = 10;
export const MAX_VIDEOS = 3;

const has = (v: string | undefined): boolean => Boolean(v && v.trim());

/** Mandatory fields (BUSINESS_DECISIONS §3 and §13) that are still empty, in question order. */
export function missingFields(draft: ListingDraft, photoCount: number): FieldKey[] {
  const missing: FieldKey[] = [];
  for (const key of FIELD_ORDER) {
    switch (key) {
      case 'photos':
        if (photoCount < MIN_PHOTOS) missing.push(key);
        break;
      case 'name':
        if (!has(draft.name)) missing.push(key);
        break;
      case 'category':
        if (!draft.categoryId) missing.push(key);
        break;
      case 'price':
        if (!(draft.price && draft.price > 0)) missing.push(key);
        break;
      case 'moq':
        if (!(draft.moq && draft.moq >= 1)) missing.push(key);
        break;
      case 'stock':
        // Made-to-order products have no stock figure; ready stock needs at least 1.
        if (draft.madeToOrder !== true && !(draft.stock && draft.stock >= 1)) missing.push(key);
        break;
      case 'materials':
        if (!has(draft.materials)) missing.push(key);
        break;
      case 'description':
        if (!has(draft.description)) missing.push(key);
        break;
      case 'craftTechnique':
        if (!has(draft.craftTechnique)) missing.push(key);
        break;
      case 'placeOfOrigin':
        if (!has(draft.placeOfOrigin)) missing.push(key);
        break;
      case 'weight':
        if (!(draft.weightKg && draft.weightKg > 0)) missing.push(key);
        break;
      case 'dimensions':
        if (!(draft.length && draft.width && draft.height && draft.dimensionUnit)) missing.push(key);
        break;
      case 'leadTime':
        if (!has(draft.leadTime)) missing.push(key);
        break;
      case 'careInstructions':
        if (!has(draft.careInstructions)) missing.push(key);
        break;
      case 'hsn':
        if (!draft.hsn && !draft.hsnSkipped) missing.push(key);
        break;
    }
  }
  return missing;
}

/** Applies new values over the draft; undefined means "not mentioned" and never erases anything. */
export function mergeDraft(base: ListingDraft, patch: Partial<ListingDraft>): ListingDraft {
  const merged: ListingDraft = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) (merged as Record<string, unknown>)[key] = value;
  }
  // Made to order wins over an earlier stock figure and vice versa.
  if (patch.madeToOrder === true) delete merged.stock;
  if (patch.stock !== undefined && patch.madeToOrder === undefined) merged.madeToOrder = false;
  if (patch.hsn !== undefined) merged.hsnSuggested = patch.hsnSuggested ?? false;
  if (merged.categoryId) delete merged.categoryOptions;
  return merged;
}

/** "30 x 20 x 10 cm", the exact form the web listing form reads and writes. */
export function dimensionsString(draft: ListingDraft): string | undefined {
  if (!(draft.length && draft.width && draft.height && draft.dimensionUnit)) return undefined;
  return `${draft.length} x ${draft.width} x ${draft.height} ${draft.dimensionUnit}`;
}

/** Turns a complete draft into the same input the website form submits. */
export function toCreateInput(draft: ListingDraft): CreateProductInput {
  const madeToOrder = draft.madeToOrder === true;
  const moq = draft.moq as number;
  const price = draft.price as number;
  return {
    name: (draft.name as string).trim(),
    description: (draft.description as string).trim(),
    categoryId: draft.categoryId as string,
    materials: (draft.materials as string).trim(),
    dimensions: dimensionsString(draft),
    weight: String(draft.weightKg),
    moq,
    declaredStock: madeToOrder ? 0 : (draft.stock as number),
    sellerPrice: price,
    leadTime: draft.leadTime,
    priceTiers: [{ moq, sellerPrice: price }],
    isMadeToOrder: madeToOrder,
    placeOfOrigin: draft.placeOfOrigin,
    craftTechnique: draft.craftTechnique,
    careInstructions: draft.careInstructions,
    isGITagged: draft.isGITagged ?? false,
    artisanName: draft.artisanName,
    tariffCode: draft.hsn,
  };
}
