export interface BuyerProfile {
  id: string;
  userId: string;
  companyName: string | null;
  contactName: string;
  phone: string | null;
  country: string;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateBuyerProfileInput {
  companyName?: string;
  contactName?: string;
  phone?: string;
  country?: string;
}

export interface Address {
  id: string;
  buyerId: string;
  label: string | null;
  line1: string;
  line2: string | null;
  city: string;
  state: string | null;
  postalCode: string;
  country: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
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

export interface WishlistProductSummary {
  id: string;
  name: string;
  slug: string;
  adminPrice: string;
  moq: number;
  imageUrl: string | null;
}

export interface WishlistEntry {
  id: string;
  createdAt: string;
  product: WishlistProductSummary;
}

export type MessageSender = 'BUYER' | 'ADMIN';

export interface BuyerMessage {
  id: string;
  buyerId: string;
  sender: MessageSender;
  body: string;
  readAt: string | null;
  createdAt: string;
}

export interface AdminSafeUser {
  id: string;
  email: string;
  status: string;
}

export interface AdminBuyerListRow extends BuyerProfile {
  user: AdminSafeUser;
}
