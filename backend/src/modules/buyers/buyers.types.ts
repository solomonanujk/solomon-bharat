import { MessageSender } from '@prisma/client';

export interface UpdateBuyerProfileInput {
  companyName?: string;
  contactName?: string;
  phone?: string;
  country?: string;
}

export interface CreateAddressInput {
  label?: string;
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
  isDefault?: boolean;
}

export type UpdateAddressInput = Partial<CreateAddressInput>;

export interface WishlistProductSummary {
  id: string;
  name: string;
  slug: string;
  adminPrice: string;
  moq: number;
  leadTime: string | null;
  imageUrl: string | null;
  avgRating: number | null;
  reviewCount: number;
}

export interface WishlistEntry {
  id: string;
  createdAt: Date;
  product: WishlistProductSummary;
}

export { MessageSender };
