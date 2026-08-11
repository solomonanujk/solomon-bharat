export interface DateRangeFilter {
  from?: Date;
  to?: Date;
}

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

export interface RevenueReport {
  gmv: string;
  adminMargin: string;
  sellerPayouts: string;
}

export interface OrdersByStatusRow {
  status: string;
  count: number;
}

export interface OrdersByCountryRow {
  country: string;
  count: number;
  gmv: string;
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

export interface CategoryPerformanceRow {
  categoryId: string;
  name: string;
  ordersCount: number;
  gmv: string;
}

export interface CollectionPerformanceRow {
  collectionId: string;
  name: string;
  ordersCount: number;
  gmv: string;
}

export type ReportRow =
  | RevenueReport
  | OrdersByStatusRow
  | OrdersByCountryRow
  | SellerPerformanceRow
  | ProductPerformanceRow
  | CategoryPerformanceRow
  | CollectionPerformanceRow;
