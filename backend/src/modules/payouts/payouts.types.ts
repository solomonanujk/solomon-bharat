import { PayoutStatus } from '@prisma/client';

export interface PayoutListFilter {
  status?: PayoutStatus;
  sellerId?: string;
}

export interface SellerPayoutSummary {
  totalEarned: string;
  pendingPayout: string;
  lastPayout: { amount: string; paidAt: Date } | null;
  /** Flat aliases of `lastPayout` (the frontend type expects these names). */
  lastPayoutAmount: string | null;
  lastPayoutDate: Date | null;
}

export interface AdminPayoutSellerInfo {
  businessName: string;
}

export { PayoutStatus };
