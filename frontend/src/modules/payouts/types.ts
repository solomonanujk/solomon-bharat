export type PayoutStatus = 'PENDING' | 'PAID';

export interface Payout {
  id: string;
  sellerId: string;
  orderId: string;
  orderItemId: string;
  amount: string;
  status: PayoutStatus;
  paidAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SellerPayoutSummary {
  totalEarned: string;
  pendingPayout: string;
  lastPayout: { amount: string; paidAt: string } | null;
}

export interface PayoutListFilter {
  status?: PayoutStatus;
}

export interface AdminPayoutListFilter extends PayoutListFilter {
  sellerId?: string;
}

export interface AdminPayout extends Payout {
  seller: { businessName: string };
}
