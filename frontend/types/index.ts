// ─── Core Domain Types ────────────────────────────────────────────────────────
// Shapes mirror the backend exactly: /api/v1, envelope { success, data, message, meta },
// camelCase fields throughout (see AGENTS.md → Frontend for the module map).

export type Role = 'SUPER_ADMIN' | 'SELLER' | 'BUYER' | 'AGENT'
export type UserStatus = 'ACTIVE' | 'SUSPENDED'

export type OrderStatus =
  | 'PENDING_PAYMENT'
  | 'PAYMENT_RECEIVED'
  | 'CONFIRMED'
  | 'PROCURING'
  | 'COLLECTED'
  | 'IN_TRANSIT'
  | 'DELIVERED'
  | 'CANCELLED'

export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'RESUBMITTED'
export type CategoryStatus = 'ACTIVE' | 'ARCHIVED'
export type CollectionStatus = 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'ARCHIVED'
export type SellerApplicationStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'MORE_INFO_REQUESTED'
export type AgentApplicationStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'MORE_INFO_REQUESTED'
export type PaymentStatus = 'PENDING' | 'COMPLETED' | 'FAILED'
export type PayoutStatus = 'PENDING' | 'PAID'
export type NotificationType =
  | 'PRODUCT_APPROVED'
  | 'PRODUCT_REJECTED'
  | 'ORDER_STATUS_CHANGED'
  | 'PAYOUT_PAID'
  | 'SELLER_APPLICATION_APPROVED'
  | 'SELLER_APPLICATION_REJECTED'
  | 'AGENT_APPLICATION_APPROVED'
  | 'AGENT_APPLICATION_REJECTED'
  | 'NEW_MESSAGE'

// ─── Users & Auth ─────────────────────────────────────────────────────────────

export interface User {
  id: string
  email: string
  role: Role
  status: UserStatus
  emailVerifiedAt: string | null
  createdAt: string
  updatedAt: string
}

// ─── Categories (3-level tree) ────────────────────────────────────────────────

export interface Category {
  id: string
  name: string
  slug: string
  level: 1 | 2 | 3
  parentId: string | null
  description: string | null
  heroImage: string | null
  status: CategoryStatus
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface CategoryNode extends Category {
  productCount: number
  children: CategoryNode[]
}

export interface CategoryDetail extends Category {
  productCount: number
  breadcrumb: Category[]
  children: CategoryNode[]
}

// ─── Products ─────────────────────────────────────────────────────────────────

export interface ProductImage {
  id: string
  url: string
  sortOrder: number
}

export interface ProductPriceTier {
  /** Absent for a tier the seller hasn't saved yet (not yet assigned a real id). */
  id?: string
  moq: number
  sellerPrice: number
  /** Set separately by an admin, per tier — never visible to sellers or buyers directly. */
  adminPrice?: number | null
  /** Set separately by an admin, per tier — the price shown to agents, never to buyers. */
  agentPrice?: number | null
}

/** A flat (non-variant) tier as exposed to buyers — never the seller's own cost. */
export interface BuyerPriceTier {
  id: string
  moq: number
  adminPrice: number
  /** Only populated when fetched in an authenticated agent context — never present for buyers. */
  agentPrice?: number | null
}

export interface VariantAttribute {
  name: string
  value: string
}

export type VariantStatus = 'ACTIVE' | 'INACTIVE' | 'OUT_OF_STOCK'

export interface ProductVariant {
  id: string
  type: string
  value: string
  sku?: string | null
  status?: VariantStatus
  imageUrl?: string | null
  attributes?: VariantAttribute[]
  priceTiers?: ProductPriceTier[]
}

/** Listing-detail fields shared by every product projection. */
export interface ProductListingDetails {
  tags: string[]
  stepQty: number
  isHandmade: boolean
  placeOfOrigin: string | null
  isGITagged: boolean
  howItIsMade: string | null
  artisanName: string | null
}

/** Buyer-safe projection — never includes sellerId/sellerPrice/declaredStock. */
export interface Product extends ProductListingDetails {
  id: string
  name: string
  slug: string
  description: string
  materials: string
  dimensions: string | null
  weight: string | null
  moq: number
  adminPrice: number
  /** Only populated when fetched in an authenticated agent context — never present for buyers. */
  agentPrice?: number
  /** The product's own flat tiers — empty when it uses variants instead (each
   *  variant carries its own priceTiers on `variants` below). */
  priceTiers: BuyerPriceTier[]
  leadTime: string | null
  categoryId: string
  isFeatured: boolean
  publishedAt: string | null
  images: ProductImage[]
  variants: ProductVariant[]
  related?: Product[]
  avgRating: number | null
  reviewCount: number
}

/** Seller-safe projection — never includes adminPrice/margin. */
/** A seller's proposed pricing/variant edit to an already-APPROVED (live) product,
 *  awaiting admin review — buyers keep seeing the product's real priceTiers/variants
 *  untouched until this is approved. No `id` on the tiers/variants themselves since
 *  they're just a proposal, not real rows yet. */
export interface ProposedPriceTier {
  moq: number
  sellerPrice: number
}

export interface ProposedVariant {
  type: string
  value: string
  sku?: string
  status?: VariantStatus
  imageUrl?: string
  attributes?: VariantAttribute[]
  priceTiers?: ProposedPriceTier[]
}

export interface PendingPricingChange {
  id: string
  proposedMoq: number
  proposedSellerPrice: number
  proposedPriceTiers: ProposedPriceTier[]
  proposedVariants: ProposedVariant[]
  createdAt: string
}

export interface MyProduct extends ProductListingDetails {
  id: string
  name: string
  slug: string
  description: string
  materials: string
  dimensions: string | null
  weight: string | null
  moq: number
  declaredStock: number
  sellerPrice: number
  leadTime: string | null
  categoryId: string
  approvalStatus: ApprovalStatus
  rejectionReason: string | null
  isPublished: boolean
  images: ProductImage[]
  variants: ProductVariant[]
  priceTiers: ProductPriceTier[]
  createdAt: string
  updatedAt: string
  /** Non-null only once this product is APPROVED and has an unreviewed pricing/
   *  variant edit awaiting admin approval. */
  pendingPricingChange: PendingPricingChange | null
}

/** Full admin projection — includes both prices + seller attribution. */
export interface AdminProduct extends Omit<MyProduct, never> {
  sellerId: string
  adminPrice: number | null
  agentPrice: number | null
  isFeatured: boolean
}

export interface ProductsParams {
  categoryId?: string
  collectionId?: string
  search?: string
  /** Curated unscoped browse modes for the navbar's "New Products"/"Bestsellers"/"Trending" links. */
  sort?: 'newest' | 'featured' | 'trending'
  material?: string
  minPrice?: number
  maxPrice?: number
  moqMax?: number
  page?: number
  limit?: number
}

export interface PaginatedResult<T> {
  items: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

// ─── Collections ──────────────────────────────────────────────────────────────

export interface Collection {
  id: string
  name: string
  slug: string
  heroImage: string | null
  editorialIntro: string | null
  isFeatured: boolean
  status: CollectionStatus
  publishAt: string | null
  createdAt: string
  updatedAt: string
  products?: Product[]
}

// ─── Sellers ──────────────────────────────────────────────────────────────────

export interface SellerApplication {
  id: string
  businessName: string
  contactName: string
  email: string
  phone: string
  businessAddress: string
  message: string | null
  status: SellerApplicationStatus
  rejectionReason: string | null
  internalNotes: string | null
  reviewedById: string | null
  reviewedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface SellerApplyInput {
  businessName: string
  contactName: string
  email: string
  phone: string
  businessAddress: string
  message?: string
}

export interface SellerProfile {
  id: string
  userId: string
  businessName: string
  contactName: string
  phone: string
  businessAddress: string
  bankDetails: string | null
  notificationPrefs: Record<string, boolean> | null
  createdAt: string
  updatedAt: string
}

// ─── Agents ───────────────────────────────────────────────────────────────────

export interface AgentApplication {
  id: string
  businessName: string
  contactName: string
  email: string
  phone: string
  businessAddress: string
  country: string
  message: string | null
  status: AgentApplicationStatus
  rejectionReason: string | null
  internalNotes: string | null
  reviewedById: string | null
  reviewedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface AgentApplyInput {
  businessName: string
  contactName: string
  email: string
  phone: string
  businessAddress: string
  country: string
  message?: string
}

export interface AgentProfile {
  id: string
  userId: string
  businessName: string
  contactName: string
  phone: string
  businessAddress: string
  createdAt: string
  updatedAt: string
}

// ─── Buyers ───────────────────────────────────────────────────────────────────

export interface BuyerProfile {
  id: string
  userId: string
  companyName: string | null
  contactName: string | null
  phone: string | null
  country: string | null
}

export interface Address {
  id: string
  label: string | null
  line1: string
  line2: string | null
  city: string
  state: string | null
  postalCode: string
  country: string
  isDefault: boolean
}

export interface WishlistEntry {
  id: string
  createdAt: string
  product: {
    id: string
    name: string
    slug: string
    adminPrice: number
    moq: number
    leadTime: string | null
    imageUrl: string | null
    avgRating: number | null
    reviewCount: number
  }
}

// ─── Orders ───────────────────────────────────────────────────────────────────

export interface OrderItem {
  id: string
  orderId: string
  productId: string
  productName?: string
  quantity: number
  unitAdminPrice: number
  lineAdminTotal: number
  unitSellerPrice?: number
  lineSellerTotal?: number
  reviewed: boolean
}

// ─── Reviews ──────────────────────────────────────────────────────────────────

export interface Review {
  id: string
  buyerName: string
  rating: number
  comment: string | null
  createdAt: string
  images: { id: string; url: string }[]
}

export interface Order {
  id: string
  buyerId: string
  shippingAddressId: string | null
  status: OrderStatus
  adminPriceTotal: number
  sellerPriceTotal?: number
  adminMargin?: number
  trackingNumber: string | null
  exportDocuments: string[] | null
  expectedCollectionDate: string | null
  cancelledReason: string | null
  createdAt: string
  updatedAt: string
  items: OrderItem[]
}

/** What a seller sees for their own linked order items — never a full Order. */
export interface SellerOrderItem {
  orderId: string
  orderItemId: string
  productId: string
  productName: string
  quantity: number
  sellerPrice: number
  lineSellerTotal: number
  status: OrderStatus
  expectedCollectionDate: string | null
  createdAt: string
}

// ─── Payments ─────────────────────────────────────────────────────────────────

export interface CheckoutItemInput {
  productId: string
  quantity: number
  variantId?: string
}

export interface CheckoutResult {
  orderId: string
  paymentId: string
  approveUrl: string | null
  adminPriceTotal: string
  currency?: string
  chargeAmount?: string
}

export interface Payment {
  id: string
  orderId: string
  provider: string
  providerPaymentId: string | null
  amount: number
  currency: string
  status: PaymentStatus
  createdAt: string
  updatedAt: string
}

export interface Invoice {
  invoiceNumber: string
  orderId: string
  issuedAt: string
  soldBy: string
  buyerEmail: string
  currency: string
  items: { productName: string; quantity: number; unitPrice: string; lineTotal: string }[]
  total: string
}

// ─── Payouts ──────────────────────────────────────────────────────────────────

export interface Payout {
  id: string
  sellerId: string
  orderId: string
  orderItemId: string
  amount: number
  status: PayoutStatus
  paidAt: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface PayoutSummary {
  totalEarned: number
  pendingPayout: number
  lastPayoutAmount: number | null
  lastPayoutDate: string | null
}

// ─── Notifications ────────────────────────────────────────────────────────────

export interface AppNotification {
  id: string
  userId: string
  type: NotificationType
  title: string
  message: string
  link: string | null
  isRead: boolean
  createdAt: string
}

// ─── Messages (buyer ↔ Solomon Bharat admin only) ────────────────────────────

export interface BuyerMessage {
  id: string
  body: string
  sender: 'BUYER' | 'ADMIN'
  createdAt: string
}

// ─── Admin ────────────────────────────────────────────────────────────────────

export interface AdminDashboardSummary {
  pendingSellerApplications: number
  pendingProductReviews: number
  activeOrders: number
  ordersAwaitingCollection: number
  pendingPayoutsCount: number
  pendingPayoutsAmount: number
  totalGMV: number
  totalBuyers: number
  totalApprovedSellers: number
}

export type ReportType =
  | 'revenue'
  | 'orders-by-status'
  | 'orders-by-country'
  | 'sellers-performance'
  | 'products-performance'
  | 'categories-performance'
  | 'collections-performance'

export interface PlatformSetting {
  key: string
  value: unknown
  updatedAt: string
}

export interface AuditLogEntry {
  id: string
  adminId: string
  entityType: string
  entityId: string
  action: string
  createdAt: string
}

// ─── Cart (client-only, single-merchant — no per-seller splitting) ──────────

export interface CartItem {
  productId: string
  productSlug: string
  productName: string
  image: string
  quantity: number
  /** Admin selling price per unit, in INR (source of truth currency). */
  unitAdminPriceInr: number
  moq: number
  variantId?: string
  variantLabel?: string
  leadTime?: string | null
}
