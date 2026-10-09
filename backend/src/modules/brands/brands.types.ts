import { BrandStatus } from '@prisma/client';

export const COMMISSION_FIRST_SETTING_KEY = 'marketplace_commission_first';
export const COMMISSION_REPEAT_SETTING_KEY = 'marketplace_commission_repeat';
export const DEFAULT_COMMISSION_FIRST = 25;
export const DEFAULT_COMMISSION_REPEAT = 15;

export interface CommissionRates {
  first: number;
  repeat: number;
}

/** Card shape used in public brand lists. */
export interface BrandListItem {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  isVerified: boolean;
  country: string | null;
  productCount: number;
}

/**
 * Public brand detail — an explicit whitelist. legalName, gstin, status and the
 * commission overrides must never appear here.
 */
export interface PublicBrand extends BrandListItem {
  bannerUrl: string | null;
  story: string | null;
  website: string | null;
  instagram: string | null;
  returnPolicy: string | null;
  minOrderValueInr: number;
  followerCount: number;
  isFollowing: boolean;
}

/** The brand owner's own view (includes private fields and read-only commission overrides). */
export interface OwnBrand extends PublicBrand {
  status: BrandStatus;
  legalName: string | null;
  gstin: string | null;
  commissionFirstOverride: number | null;
  commissionRepeatOverride: number | null;
}

export interface UpdateOwnBrandInput {
  logoUrl?: string | null;
  bannerUrl?: string | null;
  story?: string | null;
  country?: string | null;
  website?: string | null;
  instagram?: string | null;
  returnPolicy?: string | null;
  minOrderValueInr?: number;
  legalName?: string | null;
  gstin?: string | null;
}

export interface AdminUpdateBrandInput {
  isVerified?: boolean;
  status?: BrandStatus;
  name?: string;
  commissionFirstOverride?: number | null;
  commissionRepeatOverride?: number | null;
}

export interface AdminBrandListFilter {
  status?: BrandStatus;
  search?: string;
}

export interface BrandOrderStats {
  ordersCount: number;
  gmv: number;
}
