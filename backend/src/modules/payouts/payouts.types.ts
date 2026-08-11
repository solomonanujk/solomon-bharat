import { PayoutStatus } from '@prisma/client';

export interface PayoutListFilter {
  status?: PayoutStatus;
  sellerId?: string;
}

export interface SellerPayoutSummary {
  totalEarned: string;
  pendingPayout: string;
  lastPayout: { amount: string; paidAt: Date } | null;
}

export { PayoutStatus };
