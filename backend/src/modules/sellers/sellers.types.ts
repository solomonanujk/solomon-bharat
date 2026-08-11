import { SellerApplicationStatus } from '@prisma/client';

export interface SubmitApplicationInput {
  businessName: string;
  contactName: string;
  email: string;
  phone: string;
  businessAddress: string;
  message?: string;
}

export interface UpdateSellerProfileInput {
  businessName?: string;
  contactName?: string;
  phone?: string;
  businessAddress?: string;
  bankDetails?: string;
  notificationPrefs?: Record<string, unknown>;
}

export interface ApplicationListFilter {
  status?: SellerApplicationStatus;
}

export { SellerApplicationStatus };
