export interface DashboardSummary {
  pendingSellerApplications: number;
  pendingProductReviews: number;
  activeOrders: number;
  ordersAwaitingCollection: number;
  pendingPayoutsCount: number;
  pendingPayoutsAmount: string;
  totalGMV: string;
  totalBuyers: number;
  totalApprovedSellers: number;
}

export type ReportType =
  | 'revenue'
  | 'orders-by-status'
  | 'orders-by-country'
  | 'sellers-performance'
  | 'products-performance'
  | 'categories-performance'
  | 'collections-performance';

export interface RevenueReportRow {
  gmv: string;
  adminMargin: string;
  sellerPayouts: string;
}

export interface OrdersByStatusRow {
  status: string;
  count: number;
}

export interface SellerPerformanceRow {
  sellerId: string;
  businessName: string;
  approvedProducts: number;
  ordersCount: number;
  totalPayout: string;
}

export interface ProductPerformanceRow {
  productId: string;
  name: string;
  ordersCount: number;
  unitsSold: number;
}
