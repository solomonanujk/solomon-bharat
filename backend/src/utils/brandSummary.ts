import { Brand, BrandStatus } from '@prisma/client';

/** Compact brand projection returned with the seller's own profile / session. No private fields. */
export interface BrandSummaryDto {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  status: BrandStatus;
  isVerified: boolean;
  minOrderValueInr: number;
}

export function toBrandSummary(
  brand: Pick<Brand, 'id' | 'name' | 'slug' | 'logoUrl' | 'status' | 'isVerified' | 'minOrderValueInr'>,
): BrandSummaryDto {
  return {
    id: brand.id,
    name: brand.name,
    slug: brand.slug,
    logoUrl: brand.logoUrl,
    status: brand.status,
    isVerified: brand.isVerified,
    minOrderValueInr: Number(brand.minOrderValueInr),
  };
}
