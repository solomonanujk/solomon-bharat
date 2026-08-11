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

export interface OrdersByCountryRow {
  country: string;
  count: number;
  gmv: string;
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

export interface ReportFilter {
  from?: string;
  to?: string;
}

export interface PlatformSetting {
  key: string;
  value: unknown;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  adminId: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: unknown;
  createdAt: string;
}

export interface AuditLogFilter {
  entityType?: string;
  adminId?: string;
  page?: number;
  limit?: number;
}

export interface AdminUserListFilter {
  role?: 'SUPER_ADMIN' | 'SELLER' | 'BUYER';
  page?: number;
  limit?: number;
}
