**Solomon Bharat**
Product Requirements Document
Version 3.15  |  Status: Draft  |  15 October 2026
*Confidentiality: Internal Use Only*
**Solomon Bharat Private Limited**
B2B Wholesale Export Marketplace — Indian Artisan & Handmade Products
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
*Two selling models. **Curated:** Solomon Bharat purchases from sellers and sells to buyers (admin-intermediated export model). **Marketplace brands:** brands sell directly to buyers under their own name; the payment is split so the platform keeps a commission and the brand receives the rest (§17). Agents purchase from Solomon Bharat, at their own admin-set price, to resell to their own customers off-platform.*
*Four roles: SUPER_ADMIN · SELLER · BUYER · AGENT*

> **v3.9 note:** §18 records the owner-confirmed decisions and everything built in October 2026 (UK launch, manual bank transfer, new order lifecycle, brand invites at 0% commission, custom requests, samples, export documents and more). Where §18 disagrees with an earlier section, **§18 wins**. Owner decisions are also kept in `docs/BUSINESS_DECISIONS.md`.

# 1. Executive Summary


## 1.1 Product Overview

Solomon Bharat is a premium B2B wholesale export marketplace connecting verified Indian manufacturers, artisan brands, and handicraft businesses with international buyers — boutiques, independent retailers, gift shops, eco stores, and importers — starting with the UK market. A network of approved independent agents extends that reach further, reselling Solomon Bharat's catalog to their own customer base at a dedicated agent price.
Solomon Bharat operates two selling models. For **curated** sellers it is the sole merchant: it buys from sellers and sells to buyers and agents, and those parties never transact with each other directly. For **marketplace brands** (§17) the brand is the merchant and sells directly to the buyer under its own name, while Solomon Bharat provides the platform, collects the payment and earns a commission.

## 1.2 Business Model — Core Principles

- Sellers list products on the platform for admin review.
- Admin approves or rejects products. On approval, admin sets a buyer price and, independently, an agent price on the same product/MOQ tier — neither is visible to sellers.
- Buyers browse Solomon-curated products (no seller or brand identity shown) alongside marketplace brands' products, each carrying a brand tag (§17).
- When a buyer places an order, admin purchases goods from the seller and handles export to the buyer.
- Agents are independent resellers, approved by admin, who buy from Solomon Bharat at the agent price (through the same purchasing pipeline as a buyer) and resell to their own customers off-platform — Solomon Bharat has no visibility into or involvement in that resale.
- Sellers are paid their listed price manually by admin after fulfillment, regardless of whether the buyer-side purchaser was a buyer or an agent.
- For curated products, all buyer/agent invoices and contracts are with Solomon Bharat. For marketplace brand products the contract and invoice are with the brand, facilitated by Solomon Bharat (§17.8).
- Marketplace brands are charged a commission (25% on each buyer's first paid order with the brand, 15% on that buyer's later orders) and receive the remainder of the payment through a split at payment time; curated orders are not split (§17.9).
- No returns. No achievements. No buyer referral program. Product sharing (WhatsApp/social, and PDF catalogues) exists only inside the Agent Portal, for agents to market to their own customers — there is no general buyer-facing share or referral mechanic.

## 1.3 Vision

Become the world's most trusted digital marketplace for sourcing authentic Indian products through a single, reliable export intermediary.

## 1.4 Mission

Enable global businesses to discover and purchase authentic Indian products through Solomon Bharat — a premium export-ready marketplace combining verified product quality, transparent trade processes, and exceptional buyer experience.

## 1.5 Target Audience


### Buyers

International boutiques, gift shops, eco stores, lifestyle retailers, importers — UK-first.

### Sellers

Verified Indian manufacturers, artisan brands, handicraft businesses, MSMEs, craft cooperatives.

### Agents

Independent resellers — boutique owners, market traders, social-commerce sellers — who buy wholesale from Solomon Bharat at a dedicated agent price to resell to their own customer base.

### Admin (SUPER_ADMIN)

Solomon Bharat internal team — manages the full trade flow end to end.

## 1.6 Value Proposition


### For Buyers

- Curated catalog of verified Indian products under one trusted brand — Solomon Bharat.
- All orders, invoices, and export documents from a single counterparty.
- No supplier relationship management required.

### For Sellers

- Access to international markets without managing buyer relationships.
- Simple: list products, get approval, receive payment.
- Dashboard showing listings, approval status, and order-linked payouts.

### For Agents

- A dedicated wholesale price, set independently of the buyer price, on every product an admin approves for agent resale.
- Tools built for reselling: a PDF catalogue builder (image, name, description — no price) and one-tap product sharing to WhatsApp/social, so agents can market to their own customers without building anything themselves.
- The same trusted, verified-product pipeline buyers get — Solomon Bharat remains the counterparty on every purchase.

## 1.7 Success Metrics (KPIs)


| Category | Key Metrics |
| --- | --- |
| Commerce | GMV, Orders, Average Order Value (AOV), Conversion Rate |
| Buyers | Active Buyers, Repeat Buyers, Buyer Retention |
| Sellers | Active Sellers, Approved Products, Catalog Quality |
| Agents | Active Agents, Agent GMV, Catalogues Generated, Products Shared |
| Operations | Order Fulfillment Time, Admin Processing Time, Payout Turnaround |
| Platform | Product Approval Rate, Catalog Completeness, Buyer Satisfaction |


# 2. Business Model & Core Trade Flow


## 2.1 Model Summary


| Aspect | Detail |
| --- | --- |
| Seller → Admin | Seller lists product at their price. Admin approves and sets both a buyer selling price and an agent selling price. |
| Buyer → Admin | Buyer places order with Solomon Bharat. Invoice and contract is with Solomon Bharat. |
| Agent → Admin | Agent places order with Solomon Bharat at the agent price, through the same purchasing pipeline as a buyer. Invoice and contract is with Solomon Bharat. |
| Admin → Seller | On buyer or agent order, admin procures from seller at seller's listed price. |
| Admin → Buyer | Admin collects goods from seller and exports to buyer. |
| Admin → Agent | Admin collects goods from seller and ships to the agent's own address. Reselling to the agent's own customer happens off-platform. |
| Seller payout | Seller's listed price, paid manually by admin after fulfillment — identical regardless of whether the order was placed by a buyer or an agent. |
| Buyer / Agent payment | PayPal only, to Solomon Bharat. |
| Returns | No returns. All sales are final. |
| Brand visibility | Curated products never show seller/brand identity. Marketplace brand products show a brand tag and link to a brand storefront (§17.6). |
| Seller price visibility | Sellers only see their own listed price — not the admin selling price or the agent price. |
| Agent price visibility | Only agents see the agent price. Buyers never see it, and it is set independently of the buyer price (a product can be approved for buyers before an agent price is ever set). |


## 2.2 Pricing Architecture

- Seller Price — declared by seller; what admin pays per unit. Visible to seller and admin only.
- Admin Selling Price (Buyer Price) — set by admin on approval; what buyers pay. Visible to admin and buyers only.
- Agent Price — set by admin, independently of the buyer price, on the same product/MOQ tier at approval or any time after; what agents pay. Visible to admin and the purchasing agent only, never to buyers.
- Admin Margin — Admin Selling Price (or Agent Price, for an agent-placed order) minus Seller Price. Solomon Bharat's gross profit per unit, regardless of purchaser type.

## 2.3 End-to-End Trade Flow


### Step 1 — Seller Submits Product

→  Seller logs in → fills product form → submits
→  Status: Pending Review

### Step 2 — Admin Reviews & Sets Price

→  Admin reviews product details, images, seller price
→  [Approve] Admin sets selling price → product published to marketplace
→  [Reject] Admin adds reason → seller notified → seller can edit and resubmit

### Step 3 — Buyer Discovers & Orders

→  Buyer browses Categories or Collections (no seller info shown)
→  Buyer uses context-scoped search within a category or collection
→  Buyer adds to cart → authenticates → pays via PayPal

### Step 4 — Admin Fulfills

→  Admin receives order → contacts seller → arranges collection
→  Admin handles export logistics to buyer
→  Admin updates order status throughout

### Step 5 — Seller Paid

→  After collection, admin pays seller manually at their listed price
→  Payout record appears in seller dashboard

### Agent Variant of Steps 3–4

An approved agent follows the same purchasing mechanics as Step 3 (browse → cart → authenticate → pay via PayPal) and Step 4 (admin fulfillment), with two differences: pricing is resolved at the agent price instead of the buyer price, and goods ship to the agent's own address rather than a buyer's. What the agent does after receiving the goods — reselling to their own customer, at whatever price and however they choose — is entirely outside Solomon Bharat's system. See §9 Agent Portal for the full flow (application, approval, catalogue building, sharing, and purchasing).

# 3. User Personas


## 3.1 Buyer

International business owner or purchasing manager sourcing authentic Indian products for resale. Goals: discover curated products, order wholesale confidently, simplify cross-border sourcing.
Platform needs: category and collection browsing, context-scoped search, product detail, simple checkout, order tracking.

## 3.2 Seller

Indian artisan brand or manufacturer. Goals: reach international markets, list products easily, get paid.
Platform needs: product submission, approval status visibility, stock declaration, payout dashboard.

## 3.3 Agent

Independent reseller — a boutique owner, market trader, or social-commerce seller with their own downstream customer base. Goals: source authentic Indian products at a dedicated wholesale price, market them to their own customers with minimal effort, and fulfill orders without managing a supplier relationship.
Platform needs: agent-priced browsing, a PDF catalogue builder, one-tap product sharing (WhatsApp/social), cart and checkout at the agent price, order tracking.

## 3.4 Admin (SUPER_ADMIN)

Solomon Bharat internal team. Responsibilities: seller onboarding, product approval and pricing (both buyer and agent price), agent onboarding, buyer and agent orders, procurement, export, payouts, marketplace health, all platform settings.

## 3.5 Persona Summary


| Persona | Role | Primary Goal | Key Portal Features |
| --- | --- | --- | --- |
| Buyer | BUYER | Source quality Indian products | Categories, Collections, Product Detail, Cart, Orders |
| Seller | SELLER | List products and receive payment | Product Submission, Approval Status, Orders, Payouts |
| Agent | AGENT | Resell products to their own customers | Agent-Priced Browsing, Catalogue Builder, Product Sharing, Cart, Orders |
| Admin | SUPER_ADMIN | Manage end-to-end trade flow | Product Approval + Pricing (Buyer & Agent), Agent Applications, Orders, Payouts, Reports, All Settings |


# 4. Information Architecture


## 4.1 Navigation Structure

Primary public navigation: Home → Categories → Collections → Sign In → Cart
*There is no Shop or All Products page. Product discovery happens exclusively through Categories and Collections.*

## 4.2 Sitemap


### Public Marketplace

- Home
- Categories
- └── Category Detail Page (product grid + context search)
- Collections
- └── Collection Detail Page (product grid + context search)
- Product Detail
- Authentication (Login / Sign Up)
- Cart & Checkout
- Apply as a Seller
- Apply as an Agent

### Buyer Workspace (requires BUYER role)

- Dashboard
- Orders
- Wishlist
- Messages
- Addresses
- Payment Methods
- Notifications
- Profile & Settings

### Seller Portal (requires SELLER role)

- Dashboard
- My Products
- Submit New Product
- Orders
- Payouts
- Settings

### Agent Portal (requires AGENT role)

- Dashboard
- Products (agent-priced browsing)
- Catalogue Builder (select products → generate PDF)
- Orders
- Settings

### Admin Portal (requires SUPER_ADMIN role)

- Dashboard
- Seller Applications
- Agent Applications
- Products (Review, Approve + Set Buyer & Agent Price, Publish)
- Buyers
- Orders (Full lifecycle — buyer and agent orders)
- Payouts (to Sellers)
- Categories & Collections
- Pricing & Variant Change Requests (§10.5a)
- Reports & Analytics
- User Management, Audit Log, Platform Settings (§10.10–10.12)
*"CMS" as a distinct content-management surface is not implemented — see §13.2/§15.8. What exists is Categories & Collections management (sometimes loosely called "Admin CMS" in §10.8) plus hardcoded homepage/footer content.*

## 4.3 Discovery Principles

- No flat product grid anywhere on the platform.
- Every product is encountered through a Category or Collection context.
- Search is scoped to the current Category or Collection — not global.
- Admin controls which products appear in which Collections.

# 5. User Journeys & Core Flows


## 5.1 Buyer Discovery Journey

→  Buyer lands on Homepage
→  Clicks a Category or a Collection
→  Browses the product grid within that context
→  Uses context-scoped search if needed
→  Clicks product → Product Detail page
→  Add to Cart → Auth gate → Checkout → PayPal
*Buyers cannot browse "all products" — they must enter through a category or collection.*

## 5.2 Seller Product Submission Journey

→  Seller logs in to Seller Portal
→  Fills product form: name, description, images, 3-level category, MOQ, stock, seller price
→  Product submitted → status: Pending Review
→  [Approved] Admin sets selling price → product published
→  [Rejected] Reason shown → seller edits → resubmits

## 5.3 Admin Order Fulfillment Journey

→  Buyer places order → admin notified
→  Admin confirms order, contacts seller, arranges procurement
→  Admin collects goods from seller
→  Admin handles export and shipping to buyer
→  Admin updates order status through each stage
→  Admin marks payout to seller as paid

## 5.4 Agent Application Journey

→  Prospective agent visits the public "Apply as an Agent" page
→  Fills application form: business name, contact name, email, phone, business address, country, message
→  Application submitted → status: Pending Review, no account yet
→  [Approved] Admin approves → an AGENT account is created and login credentials are emailed → agent can now sign in to the Agent Portal
→  [Rejected] Reason shown by email → no account created
*Mirrors the Seller Product Submission Journey's application-then-approval shape (§5.2), reused for agent onboarding.*

## 5.5 Agent Catalogue & Resale Journey

→  Agent logs in → Agent Portal
→  Browses products at agent price (never buyer price)
→  Either: adds products to cart → checks out at agent price → PayPal → goods ship to the agent's own address
→  Or: selects several products → generates a PDF catalogue (image, name, description — no price) → shares it with their own customers
→  Or: shares an individual product via the native share sheet (WhatsApp, Instagram, etc.) or a fallback modal (WhatsApp link, copy link, download image)
→  Agent resells to their own customer at whatever price they choose — entirely outside Solomon Bharat's system
*Reselling, markup, and end-customer fulfillment are not tracked by the platform — Solomon Bharat's involvement ends at the agent's own purchase.*

## 5.6 Removed Journeys

- Achievement Progression — removed
- Buyer Referral Journey — removed
- Returns & Disputes — removed (all sales final)
- Global Search — removed (search is context-scoped)
- General buyer-facing Share Link Journey — removed. Product sharing (WhatsApp/social, PDF catalogues) exists only inside the Agent Portal (§5.5, §9) for agents marketing to their own customers — it is not a public/buyer-facing feature.

# 6. Public Marketplace Pages


## 6.1 Overview

The public marketplace is the buyer-facing storefront. Curated products appear as Solomon Bharat's own catalog with no seller or brand identity; marketplace brands' products appear alongside them with a brand tag (§17.6). No Shop or All Products page. Discovery happens through Categories and Collections only.

## 6.2 Homepage

Introduces Solomon Bharat and directs buyers into Categories or Collections.

### Layout

→  Announcement Bar
→  Navigation: Home | Categories | Collections | Sign In | Cart
→  Editorial Hero — full-width image + headline + CTAs
→  Featured Categories — grid of category cards
→  Trust Indicators: "Verified Indian Suppliers" | "Export Ready" | "Secure PayPal Payments"
→  Newsletter CTA + Seller Application CTA + Agent Application CTA
→  Footer
*No product grid on the homepage. Buyers directed into Categories or Collections first.*

### Primary CTAs

- Browse Categories
- Explore Collections
- Apply as a Seller (secondary)
- Apply as an Agent (secondary)

## 6.3 Categories

Primary product discovery entry point. Each category has its own detail page with a product grid and context-scoped search.

### Category Listing Page

Grid of Level 1 category cards. Examples: Home Décor, Textiles, Kitchenware, Fashion Accessories, Gifting, Furniture, Lighting.

### Category Detail Page Layout

→  Category Hero — editorial image + name + short description
→  Subcategory chips (Level 2 filter)
→  Context Search Bar — searches only within this category
→  Filters — Sub-subcategory (L3), Material, MOQ, Price Range
→  Product Grid (3 columns desktop)
→  Pagination

### Product Card

- Product image
- Product name
- Admin selling price
- MOQ
- Add to Wishlist icon
*Curated products show no seller name, brand name, or supplier info. Marketplace brand products show a brand tag (§17.6).*

## 6.4 Collections

Admin-curated editorial groupings of products around themes, seasons, or use cases.

### Collection Listing Page

Editorial grid of collection cards. Examples: Sustainable Living, Hotel Collection, Festive Décor, Artisan Favorites.

### Collection Detail Page Layout

→  Collection Hero Banner — full-width editorial image
→  Collection Title + Editorial Introduction (written by admin)
→  Context Search Bar — searches only within this collection
→  Product Grid — hand-picked by admin
→  Related Collections

### Collection Rules

- Admin creates and manages all collections.
- A product can appear in multiple collections.
- Collections can be scheduled, featured on homepage, or archived.
*Sellers have no control over which collections their products appear in.*

## 6.5 Context-Scoped Search

Search is never global. Always scoped to the current category or collection.

| Context | What Search Returns |
| --- | --- |
| Inside a Category | Products within that category and all its children only |
| Inside a Collection | Products within that collection only |
| Homepage / Navigation | No search — buyers must enter a category or collection first |

- Search bar on Category Detail and Collection Detail pages only.
- Placeholder: "Search in Home Décor..." or "Search in Sustainable Living..."
- Results update inline without page reload.
*No global search bar in the main navigation. Enforces curated discovery.*

## 6.6 Product Detail Page


### Layout

→  Image Gallery (multiple images, thumbnail row, full-screen zoom/pan lightbox) + a short clickable video strip beneath it when the product has videos (its own lightbox with an autoplaying `<video>` player)
→  Bestseller / Handmade / GI Tagged badges (shown when set) + Product Name in serif
→  Star Rating + Review Count (average of published reviews on this product; hidden if no reviews yet) — see §6.10
→  Admin Selling Price per unit, with a buyer-selectable display currency — see §6.11
→  Eco-friendly attribute tags (Materials/Packaging/Production, combined into one line)
→  Ships from / Estimated delivery line (place of origin + lead time, when set)
→  Variants — reconstructed from each variant's **full attribute set**, not just its primary axis, so a product with both a Size and a Color axis correctly offers both as independently selectable rows (each variant may carry its own price tier); `INACTIVE` (hidden) variants are excluded from the selector entirely, not just greyed out
→  MOQ &amp; per-tier pricing, resolved for whichever variant combo is currently selected, falling back to the flat product's own tiers when it has no variants
→  Add to Cart CTA
→  Product Description, Materials, How it's made (artisan name + craft process — its own expandable section, shown only when either is set), Dimensions/Weight (the selected variant's own values when it has them, else the flat product-level values), and Details (Lead Time, Min. order, and HS/Tariff code — the selected variant's own code, falling back to the product-level one)
→  Related Products (same category)
*Curated products show no seller name, brand name, origin supplier, or any supplier reference. Marketplace brand products show a brand tag and a "Buy more from this brand" section (§17.6).*

## 6.7 Authentication

Guests can browse all categories, collections, and product detail pages freely. Authentication required for cart, checkout, wishlist, messages, and order management.

### Auth Flow

→  Protected Action (Add to Cart / Wishlist)
→  Authentication Modal (background stays visible)
→  Login or Sign Up
→  Email Verification
→  Resume Intended Action

## 6.8 Footer

Marketplace: Categories, Collections. Company: About, Contact, Careers. Resources: Help Center, FAQs, Export Guide. Legal: Privacy, Terms, Cookies. Social: LinkedIn, Instagram, Facebook.
*"Shop" removed from footer; a "Brands" link to the marketplace brand index (§17.6) is present. No link to any all-products page.*

## 6.9 Cross-Page Design Rules

- Max content width: 1280px
- Sticky navigation on all public pages
- No "Shop" link anywhere in navigation or footer
- No seller/brand attribution on curated products in public pages; marketplace brand products carry a brand tag (§17.6)
- Skeleton loading, lazy-loaded images
- Mobile: bottom navigation, collapsible filters, swipeable carousels

## 6.10 Reviews & Ratings

Buyers may leave one review per delivered order item — a 1–5 star rating, optional text, and up to 5 photos. Reviews are tied to a specific fulfilled purchase, not open to arbitrary visitors, so every review on the platform is from a verified buyer. Product pages display the aggregate average rating and review count publicly (§6.6); individual review text/photos are shown in a reviews list on the product page. Reviews are never attributed to a seller or brand — same brand-invisibility rule as the rest of the marketplace (§1.2) — they read as reviews of the product on Solomon Bharat, not of a supplier.
*There is no admin moderation queue for reviews in the current build — published reviews appear immediately. Consider whether pre-moderation is needed before this is exposed more broadly.*

## 6.11 Currency Display

Buyers can view product prices converted from the underlying INR admin price into their preferred display currency, using live FX rates (Frankfurter API, refreshed via a backend proxy). This is a **display-only conversion** — actual checkout and PayPal settlement still happen in the platform's base currency; it does not change seller pricing, agent pricing, or invoicing, and must not be confused with the "Multi-currency seller pricing" item in §16.4 Out of Scope, which refers to sellers declaring prices in multiple currencies (not built, not planned for MVP). The currency preference is a lightweight client-side setting (`useCurrencyStore`), not tied to buyer profile or country.

# 7. Buyer Workspace


## 7.1 Overview

Authenticated hub for buyers (BUYER role) to manage orders, wishlist, messages with Solomon Bharat, and account settings.

## 7.2 Navigation

Desktop sidebar: Dashboard, Orders, Wishlist, Messages, Addresses, Payment Methods, Notifications, Profile, Settings. Mobile: Dashboard, Orders, Wishlist, Messages, Profile.

## 7.3 Buyer Dashboard

Overview: Active Orders, Pending Orders, Completed Orders, Saved Products. Primary CTA: Continue Browsing.

## 7.4 Orders


| State | Description |
| --- | --- |
| Payment Received | Buyer paid, order in admin queue |
| Confirmed | Admin confirmed the order |
| Processing | Admin procuring from seller |
| Shipped | Goods in transit to buyer |
| Delivered | Buyer received goods |
| Cancelled | Order cancelled before fulfillment |

Quick actions: View Order, Track Shipment, Download Invoice, Contact Solomon Bharat.
*No "Return" or "Dispute" action. All sales are final.*

## 7.5 Wishlist

Save products for future sourcing. Filter by category. Add to cart from wishlist.

## 7.6 Messages

Communication between buyer and Solomon Bharat admin only. Not buyer-to-seller.

## 7.8 My Reviews

For each delivered order item, the buyer sees a "Leave a Review" prompt if they haven't reviewed it yet. Review form: 1–5 star rating, optional text, up to 5 photos. See §6.10 for how reviews surface publicly on the product page.

## 7.9 Removed from Buyer Workspace

- Saved Brands — followed marketplace brands (§17.6)
- Referrals — removed
- Referral Credits — removed

# 8. Seller Portal


## 8.1 Overview

Dedicated workspace for approved Indian sellers (SELLER role) to manage product listings, track approvals, view orders linked to their products, and track payouts. Sellers never interact with buyers and never see buyer-facing prices.

## 8.2 Navigation

Desktop sidebar: Dashboard, My Products, Submit Product, Orders, Payouts, Settings.

## 8.3 Seller Dashboard


### KPI Cards

- Total Products Submitted
- Approved / Pending / Rejected
- Total Orders Linked to My Products
- Total Earnings (paid out)
- Pending Payout

### Recent Activity

- Recent approval status changes
- Recent orders linked to their products
- Recent payouts received

## 8.4 My Products


| Column | Description |
| --- | --- |
| Thumbnail | Product image |
| Product Name |  |
| Category | Full 3-level path |
| Seller Price | Their declared price — what admin pays them |
| Declared Stock | Self-reported available quantity — derived as the sum of each variant's own Inventory field when the product has variants (§8.5); the seller never types a separate total in that case |
| Approval Status | **Draft** / Pending / Approved / Rejected / Resubmitted — Draft is a real, filterable status (`ProductApprovalStatus.DRAFT`), not a UI-only concept; see §8.5's Save as Draft note |
| Date Submitted |  |
| Actions | Edit / Resubmit / Delete |


### Rejection Flow

- Seller receives notification with admin's rejection reason.
- Rejected product shows reason inline in product list.
- Seller edits the product and resubmits.
- Resubmitted product returns to Pending Review.

## 8.4a Product Detail View

Clicking a product from My Products opens `/portal/products/[id]` — a full read-only summary distinct from the Edit form (a separate button/route). Rebuilt so that every field the submission form collects has a visible home here, nothing held back:

→  The exact buyer-facing photo gallery and video strip (§6.6's `PhotoGallery`/`ProductVideoStrip` components, reused as-is) — so a seller previews precisely what buyers will see — plus a "View live" link straight to the public PDP once the product is Approved and published
→  Pricing & Variants — a full table when variants exist (Photo, full option combo, SKU, complete price ladder, Inventory, Weight, Dimensions, Tariff code, Status pill), or a flat MOQ/price table otherwise
→  Materials & Sourcing — materials, place of origin, Handmade/GI Tagged, eco-attribute tag badges
→  Craft Story — artisan name, how it's made (section shown only when either is set)
→  Tags, and — for a flat (no-variant) product only — its own Weight/Dimensions
→  A right-hand Overview panel: price-from, MOQ, order step, declared stock, lead time, category, tariff/HS code
→  A Timeline panel: created/updated dates
→  A real proposed-vs-current breakdown when a pricing/variant change request is pending (§8.9) — the actual proposed MOQ/price/variant values, not just a generic notice

## 8.5 Submit New Product

A progressive-reveal form (`ProductForm.tsx`, shared with the Admin Portal's create/edit flows via a `mode` prop — see §13.3/§13.5): only Name and Category are shown up front; every other section appears once a category is chosen. A seller can **Save as Draft** at any point — only Name and Category are real requirements to do so — and resume later from the "Drafts" filter on My Products (§8.4).

### Basic information

| Field | Required | Notes |
| --- | --- | --- |
| Name | Yes | 60-character cap, live counter |
| Category | Yes | Typeahead search over the 3-level tree (not a cascading dropdown) — shows "This product will appear in: L1 > L2 > L3" once selected |
| Description | Yes | 1,000-character cap, live counter |
| Materials | Yes |  |

### Additional details

| Field | Required | Notes |
| --- | --- | --- |
| Made in | No | Typeahead over Indian states/UTs and known artisan/manufacturing hub cities; still accepts and displays free text not in the list (for a legacy value). Maps to `placeOfOrigin`. |
| Mark as bestseller | No | Seller-settable checkbox → `isBestseller`, shown as a badge on the public Product Detail Page and on Product Cards (§6.6) |
| Eco-friendly attribute tags | No | Three independent controlled-vocabulary multiselects — Product Materials, Packaging, Production (e.g. "Organic," "Recyclable," "Fair trade"; full vocab in `ecoAttributes.constants.ts`) — shown as a combined tag line on the PDP |

### Images & videos

| Field | Required | Notes |
| --- | --- | --- |
| Images | Yes | Min 2, max 10. JPEG/PNG/WEBP only — a HEIC/PDF/etc. selection is rejected client-side with a clear toast instead of silently failing to render. First image is the Featured/cover image; drag-and-drop to reorder. |
| Videos | No | Up to 3. MP4/MOV/WEBM. Server enforces 200MB/file (`MAX_VIDEO_FILE_SIZE_BYTES`) — the in-form helper text currently says "2 GB or smaller," which doesn't match the real limit; see §15.8. |

### Product options (variants)

A Yes/No toggle — always re-choosable, not a one-way commitment once answered. **No** (or **Yes** with nothing ever configured) submits the product as a single flat row. **Yes** opens a modal to add up to two option axes: **Size**, plus optionally one more from {Color, Material, Style, Scent, Product language}. **"Product language" being offered here directly contradicts this PRD's own decision to exclude a Product Language field anywhere (§16.4 Out of Scope) — a flagged, unresolved discrepancy; see §15.8.** Choosing both axes cross-multiplies into a combo table; choosing Color specifically also prompts the seller to assign a swatch photo per color value (from images uploaded in the same session, including ones not yet saved to the server) via a modal with a draggable focal-point crop tool for the swatch thumbnail.

Per combo row:

| Field | Required | Notes |
| --- | --- | --- |
| SKU | No | Auto-generated from the product name + option values if left blank |
| Price | Yes | A single value per row — this form has **no** per-row volume/MOQ tier ladder (contrast §10.5a's admin-side per-tier pricing, which still applies to whatever single tier exists) |
| Inventory | Yes | Summed across all active rows into Declared Stock (§8.4) |
| Weight (+ unit) | Yes | kg or lb |
| Length / Width / Height (+ unit) | No | cm or in |
| Tariff / HS code | No |  |
| Status | — | Show/Hide toggle (`ACTIVE`/`INACTIVE`) — a hidden row is excluded entirely from the buyer-facing variant selector (§6.6), not just visually greyed out |

### Fields the current form no longer collects

The following fields still exist on the `Product` model, are still fully validated by the backend, and are preserved untouched by an existing product's **Save as Draft** — but the current Submit/edit form has no input for any of them, and a full **Submit**/**Publish** save (not a draft save) explicitly force-resets three of them on every save:

| Field | What happens now |
| --- | --- |
| MOQ | Always submitted as `1` — no MOQ input exists in the form |
| Order Step (`stepQty`) | Defaults to `1` server-side — no input exists |
| Lead Time | Omitted from the payload — untouched on an edit, absent on a new product |
| Handmade (`isHandmade`) | **Force-reset to `false` on every non-draft save**, even if it was previously `true` |
| GI Tagged (`isGITagged`) | **Force-reset to `false` on every non-draft save**, same as above |
| Tags | **Force-reset to an empty array on every non-draft save** |
| How It's Made / Artisan Name | Omitted from the payload — untouched on an edit, absent on a new product |

*This is a real product-behavior gap, not a cosmetic one: fully re-submitting (not draft-saving) an older product that has Handmade/GI Tagged/Tags set will silently clear them. See §15.8.*

*Seller Price is derived as the lowest per-row price across active combos (or the single flat price when there are no variants) — what admin pays the seller. It is not the buyer-facing price. Sellers cannot see the buyer-facing price.*

## 8.6 AI Content Polish

The backend endpoint (`POST /products/ai/polish`, Gemini `gemini-2.5-flash-lite`, proofreads a name/description/tags field without inventing facts) is still fully implemented and tested, but **the current Submit New Product form no longer calls it anywhere** — the Faire-parity rebuild (§8.5) dropped the trigger button along with the standalone Tags field it used to sit next to. This PRD's earlier drafts described it as an active in-form feature; that is no longer true as of this rebuild. See §15.8.

## 8.7 Orders


| Visible to Seller | Not Visible to Seller |
| --- | --- |
| Order ID (internal reference) | Buyer name or details |
| Product(s) ordered | Buyer country |
| Quantity | Admin selling price / buyer price |
| Seller Price (what they'll receive) |  |
| Order status |  |
| Expected collection date (if set by admin) |  |


## 8.8 Payouts


### Payout Dashboard

- Total Earned (all time)
- Pending Payout
- Last Payout Amount and Date

| Column | Description |
| --- | --- |
| Date | When admin processed the payment |
| Order Reference | Linked order ID |
| Product(s) | Which products the payout covers |
| Amount | Seller price × quantity |
| Status | Paid / Pending |

*Payouts are manual in MVP. Admin marks as paid after completing external payment. Seller sees the record update in their dashboard.*

## 8.9 Pricing & Variant Change Requests

A product's core listing fields (name, description, images, category, materials) can only be edited by the seller before admin approval (§8.4 — editing is blocked once approved). But **price, MOQ, price tiers, and variants** on an already-approved, live product can change over time — raw material costs shift, a seller wants to add a new color. For that, the seller submits a change request instead of editing the live listing directly: proposed MOQ, proposed seller price, proposed price tiers, and/or proposed variants. The live, buyer-facing listing is completely unaffected until admin reviews it.

→  Seller opens an approved product → "Request Pricing/Variant Change" → fills proposed values → submits
→  Request enters a Pending queue, visible to the seller as a status on that product
→  [Admin Approves] The proposed tiers/variants atomically replace the live ones → seller notified
→  [Admin Rejects] Live listing stays untouched → seller notified with the request's status, can submit a new request

This keeps a live, purchasable listing stable for buyers/agents mid-review, while still letting sellers adjust pricing and variants without waiting for a full product resubmission cycle. See §10.5a for the admin-side review queue.

*A proposed variant in this flow only carries type, value, SKU, status, image, attributes, and price tiers — it does **not** carry the newer per-variant Weight, Dimensions, Tariff code, or Inventory fields from §8.5. A change request can add/reprice/reshape variants, but cannot propose a change to those four fields on an existing variant; see §15.3.*

## 8.10 Settings

Business profile, contact information, bank details (reference only), notification preferences, password/security.

# 9. Agent Portal

## 9.1 Overview

Dedicated workspace for approved independent resellers (AGENT role) to browse the catalog at a dedicated agent price, build shareable PDF catalogues, share individual products, and purchase for resale to their own customers. Agents never see the buyer price, and buyers never see the agent price. Agents never interact with buyers or sellers directly, and never see seller/brand identity — same brand-visibility rule as the rest of the marketplace.

## 9.2 Navigation

Desktop sidebar: Dashboard, Products, Catalogue, Orders, Settings.

## 9.3 Agent Dashboard

Overview: Total Orders, Recent Order Value. Quick links: Browse Products, Build a Catalogue, View Orders.

## 9.4 Onboarding

Agents do not self-signup. A prospective agent submits a public application (business name, contact name, email, phone, business address, country, message) and an admin reviews it — approve, reject (reason required), request more info, or add internal notes — identical to the Seller Application flow (§10.4). On approval, an AGENT account is created and login credentials are emailed; the agent's business details (company name, contact name, phone, country) carry over automatically so their shipping profile is ready to use immediately.

## 9.5 Products (Agent-Priced Browsing)

A flat, catalog-wide product grid — unlike the buyer marketplace, agent browsing is **not** scoped to a category or collection, since an agent building a resale catalogue wants to see everything at once. Each product card shows:

- Product image
- Agent price (never the buyer price)
- MOQ, rating
- "Add to cart" — adds at the agent price
- Share button (§9.7)

Only products an admin has set an agent price for appear here — a product can be live for buyers with no agent price yet set, and it simply won't appear in agent browsing until it is.

## 9.6 Catalogue Builder

Agent selects any number of products (checkbox per product, reusing the same grid as §9.5) and generates a PDF catalogue: one section per product, showing image, name, and description — **no price is ever shown**, since the agent sets their own resale price with their customer, outside the platform. The generated PDF is stored and downloadable again later without regenerating it.

## 9.7 Product Sharing

Every product card carries a share button. Tapping it opens the device's native share sheet (WhatsApp, Instagram, Mail, etc. — whichever the OS offers) with the product's image, name, and description attached. Where native sharing isn't available (most desktop browsers), a fallback modal offers: a WhatsApp link pre-filled with the product's name/description, a "copy link" action, and a "download image" action. This is an agent-only feature — it does not appear on buyer-facing product cards or the public Product Detail page.

## 9.8 Cart & Checkout

Agents use the same cart and checkout flow as buyers (§6, PayPal, Solomon Bharat as merchant of record), priced at the agent price instead of the buyer price. Goods ship to the agent's own address — there is no drop-ship-to-end-customer address option; reselling and delivery to the agent's own customer happens off-platform.

## 9.9 Orders

Same order-history view and lifecycle as the Buyer Workspace (§7.4) — Payment Received → Confirmed → Processing → Shipped → Delivered / Cancelled. Admin's order queue (§10.6) internally flags which orders were agent-placed for reporting purposes, but the fulfillment lifecycle itself is identical for buyer and agent orders.

## 9.10 Settings

Business profile (company name, contact name, phone, country), password/security — same fields captured at application time, editable afterward.

# 10. Admin Portal


## 10.1 Overview

The operational command center for Solomon Bharat (SUPER_ADMIN role). Manages the full trade flow: seller onboarding, agent onboarding, product approval and pricing (buyer and agent price), buyer and agent orders, procurement, export, seller payouts, marketplace content, and all platform settings.

## 10.2 Navigation

Desktop sidebar: Dashboard, Seller Applications, Agent Applications, Sellers, Products, Pricing Changes, Buyers, Orders, Payouts, Categories & Collections, Reports, Users, Audit Log, Settings.

## 10.3 Admin Dashboard


### KPI Cards

- Pending Seller Applications
- Pending Agent Applications
- Pending Product Reviews
- Active Orders
- Orders Awaiting Collection
- Pending Payouts to Sellers
- Total GMV
- Total Buyers
- Total Approved Sellers
- Total Approved Agents

### Quick Actions

- Review Pending Products
- View New Orders
- Process Payouts
- Review Seller Applications
- Review Agent Applications

## 10.4 Seller & Agent Applications

Admin reviews new seller and agent applications on separate review queues (identical review pattern for both). Actions: Approve (creates the account and sends access credentials — a SELLER account for a seller application, an AGENT account for an agent application), Reject (with reason), Request More Info, Add Internal Notes.

## 10.5 Product Management (Approve & Price)


| Column | Description |
| --- | --- |
| Thumbnail | Image preview |
| Product Name |  |
| Seller | Which seller submitted it |
| Category | Full 3-level path |
| Seller Price | What seller wants to be paid per unit |
| Date Submitted |  |
| Status | Pending / Approved / Rejected |
| Actions | Review / Approve / Reject |


### Approval Flow

→  Admin clicks Review → full product detail opens
→  [Approve] Admin sets Admin Selling Price and, independently, an Agent Price (per MOQ tier, in the same step) → product published to marketplace. The agent price may be left unset at approval time and added later — a product does not need an agent price to be approved or published for buyers.
→  [Reject] Admin enters reason → seller notified → seller can resubmit

### 10.5a Pricing & Variant Change Request Review

A separate queue (distinct from new-product review above) for the change requests sellers submit against already-live products (§8.9): proposed MOQ, seller price, price tiers, and/or variants. Admin sees the current live values side-by-side with the proposed ones.

- [Approve] The proposed tiers/variants atomically replace the live listing's tiers/variants. Seller notified.
- [Reject] Live listing is untouched. Seller notified, can submit a new request.

This queue only ever touches pricing/variant fields — it cannot be used to change a product's name, description, images, or category; those still require the full resubmission flow above.

### Price Fields on Approval


| Field | Editable By | Visible To |
| --- | --- | --- |
| Seller Price | Seller only | Seller + Admin |
| Admin Selling Price (Buyer Price) | Admin only | Admin + Buyer |
| Agent Price | Admin only | Admin + purchasing Agent |
| Margin (auto-calculated) | N/A | Admin only |


### Post-Approval Actions

- Edit Selling Price (buyer price and/or agent price, independently)
- Unpublish / Republish
- Feature Product
- Add to Collection
- Archive

## 10.6 Order Management


| State | Description | Triggered By |
| --- | --- | --- |
| Payment Received | Buyer or agent paid via PayPal | Automatic |
| Confirmed | Admin confirms and begins procurement | Admin |
| Procuring | Admin contacting seller, arranging collection | Admin |
| Collected | Goods collected from seller | Admin |
| In Transit | Goods being shipped to buyer or agent | Admin |
| Delivered | Buyer or agent received goods | Admin |
| Cancelled | Cancelled before fulfillment | Admin |

The order list can be filtered by whether an order was placed by a buyer or an agent — the fulfillment lifecycle itself is identical either way; this is a reporting distinction only, not a separate workflow.


### Admin Order Actions

- Confirm Order
- Update Status
- Add Tracking Number
- Attach Export Documents
- Contact Buyer (via Messages)
- Download Invoice
- Cancel Order

## 10.7 Payout Management


| Column | Description |
| --- | --- |
| Seller | Seller name |
| Order Reference | Linked order ID |
| Product(s) | Items fulfilled |
| Amount Owed | Seller price × quantity |
| Status | Pending / Paid |
| Actions | Mark as Paid, Add Notes |

*Payout processing is manual in MVP. Admin marks as paid after completing external bank transfer.*

## 10.8 Categories & Collections


### Categories

- Create, edit, reorder, archive categories at all 3 levels
- Archiving blocked if active products exist — admin must reassign all products first
- Admin can reassign any product's category post-approval (no seller notification)

### Collections

- Create editorial collections: name, hero banner, editorial intro
- Manually select which approved products appear in each collection
- Feature collections on the homepage
- Schedule collection publication
- A product can appear in multiple collections

## 10.9 Reports & Analytics

- Revenue (GMV, Admin Margin, Seller Payouts)
- Orders by status, product, category, buyer country
- Buyer growth and retention
- Seller performance (approved products, orders, payouts)
- Product performance (views, add-to-cart, orders)
- Category and collection performance
Export: CSV, Excel, PDF. Custom date ranges supported.

## 10.10 User Management

Admin can list all platform users across roles, suspend a user's account (blocks login/checkout without deleting their data), reactivate a suspended account, and promote a user to SUPER_ADMIN. Promotion is the only way a SUPER_ADMIN account is ever created after the initial seed admin (§13.9's `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD`) — there is no signup path or self-service escalation to SUPER_ADMIN (consistent with §10.13's Role Assignment rule).

## 10.11 Audit Log

Every sensitive admin action — product approval/rejection, price changes, pricing-change-request decisions, payout marking, user suspension/promotion — is recorded to an audit log with who performed it and when. Admin can browse the log. This is the enforcement mechanism behind §13.6's "audit logging for all sensitive admin actions" requirement.

## 10.12 Platform Settings

Key-value platform settings admin can view and update (e.g. operational toggles, thresholds) without a code deploy. Distinct from the per-user Settings pages in the Buyer Workspace, Seller Portal, and Agent Portal — this is platform-wide configuration, admin-only.

## 10.13 Role-Based Access Control (RBAC)

The platform uses exactly 4 roles. No sub-admin roles. All admin functionality is accessible to SUPER_ADMIN only.

| Role | Who | Access |
| --- | --- | --- |
| SUPER_ADMIN | Solomon Bharat internal team | Full access: product approval, pricing (buyer + agent), pricing/variant change requests, orders, payouts, categories, collections, reports, settings, user management, audit log |
| SELLER | Approved Indian suppliers | Seller Portal only: submit products, view own approval status, view own orders, view own payouts, manage own profile |
| BUYER | International business buyers | Public marketplace + Buyer Workspace: browse, cart, checkout, orders, wishlist, messages with admin, profile |
| AGENT | Approved independent resellers | Agent Portal only: browse at agent price, catalogue builder, product sharing, cart, checkout, orders, manage own profile |


### Role Assignment

- SUPER_ADMIN — assigned manually in the database or by another SUPER_ADMIN. Cannot be self-assigned.
- SELLER — assigned automatically when admin approves a seller application.
- BUYER — assigned automatically on buyer signup completion.
- AGENT — assigned automatically when admin approves an agent application. An approved agent's account also gets buyer-style purchasing capability under the hood (so they can check out through the same cart/order pipeline a buyer uses, priced at the agent price) — this is an implementation detail, not a separate role.

### Access Boundaries


| Action | SUPER_ADMIN | SELLER | BUYER | AGENT |
| --- | --- | --- | --- | --- |
| View public marketplace | ✓ | ✓ | ✓ | ✓ |
| Browse categories & collections | ✓ | ✓ | ✓ | — (agent browsing is a flat catalog view, §9.5) |
| View product detail page | ✓ | ✓ | ✓ | ✓ (agent-priced) |
| Add to cart / checkout | ✓ | — | ✓ | ✓ (at agent price) |
| Place orders | ✓ | — | ✓ | ✓ |
| View buyer/agent orders | ✓ (all) | — | ✓ (own) | ✓ (own) |
| Submit products | — | ✓ | — | — |
| View approval status | ✓ (all) | ✓ (own) | — | — |
| Approve / reject products | ✓ | — | — | — |
| Approve / reject agent applications | ✓ | — | — | — |
| Set admin selling (buyer) price | ✓ | — | — | — |
| Set agent price | ✓ | — | — | — |
| View seller price | ✓ | ✓ (own) | — | — |
| View admin selling (buyer) price | ✓ | — | ✓ | — |
| View agent price | ✓ | — | — | ✓ (own purchases only) |
| Build PDF catalogues | — | — | — | ✓ |
| Share products (native share / WhatsApp) | — | — | — | ✓ |
| Manage full order lifecycle | ✓ | — | — | — |
| View seller payouts | ✓ (all) | ✓ (own) | — | — |
| Mark payouts as paid | ✓ | — | — | — |
| Manage categories | ✓ | — | — | — |
| Manage collections | ✓ | — | — | — |
| Review pricing/variant change requests | ✓ | — | — | — |
| Leave product reviews | — | — | ✓ (own delivered orders) | — |
| View reports & analytics | ✓ | — | — | — |
| Manage platform settings | ✓ | — | — | — |
| Suspend / reactivate / promote users | ✓ | — | — | — |
| View audit log | ✓ | — | — | — |

*RBAC is enforced at middleware level on every API route. Never implement role checks inside service or controller logic.*

# 11. Category Management System

Categories are the primary navigation and discovery structure. Fully controlled by admin (SUPER_ADMIN). Sellers pick from the admin-defined list; buyers filter through all three levels.

## 11.1 Category Hierarchy


| Level | Name | Example |
| --- | --- | --- |
| Level 1 | Category | Home Décor |
| Level 2 | Subcategory | Textiles |
| Level 3 | Sub-subcategory | Table Runners |

Every product must be assigned to exactly one Level 3 sub-subcategory. This automatically places it under the parent subcategory and category.
*A product belongs to one and only one category path. It cannot be cross-listed.*

## 11.2 Category Ownership & Control


| Who | Can Do What |
| --- | --- |
| SUPER_ADMIN | Create, edit, reorder, archive categories at any level |
| SUPER_ADMIN | Reassign a product to a different category post-approval (no seller notification) |
| SELLER | Select from admin-defined list when submitting a product (cascading 3-level dropdown) |
| SELLER | Cannot create, suggest, or modify categories |
| SELLER | Can see their product's assigned category but cannot change it after submission |
| BUYER | Browse and filter by all three category levels |


## 11.3 Archiving Rules

- Admin clicks Archive on a category node.
- [Active products exist] Admin sees warning: "X products assigned. Reassign them before archiving." Blocked until all products reassigned.
- [No active products] Category archived immediately.
- Archived categories hidden from seller dropdown and buyer filters. Visible to admin only.
- Archived categories can be restored.

## 11.4 Buyer-Facing Category Experience


| Page | What Buyer Sees |
| --- | --- |
| Category Listing | Grid of Level 1 category cards |
| Level 1 Category Page | Hero + Level 2 subcategory chips + product grid filterable by L2 and L3 |
| Level 2 Subcategory Page | Hero + Level 3 sub-subcategory filter chips + product grid |
| Product Detail | Breadcrumb: Category > Subcategory > Sub-subcategory (each node clickable) |


## 11.5 Category Data Model


| Field | Type | Description |
| --- | --- | --- |
| id | UUID | Unique identifier |
| name | String | Display name |
| slug | String | URL-safe identifier |
| level | Integer (1–3) | Hierarchy level |
| parent_id | UUID / null | Parent category ID (null for Level 1) |
| description | Text | Short editorial description for category pages |
| hero_image | URL | Editorial hero image |
| status | Enum | active / archived |
| sort_order | Integer | Position among siblings |
| product_count | Integer | Computed: published products in this node and children |


## 11.6 Category Rules Summary


| Rule | Detail |
| --- | --- |
| Hierarchy depth | Exactly 3 levels |
| Created by | SUPER_ADMIN only |
| Selected by | SELLER (on product submission, all 3 levels required) |
| Products per category path | One only — no cross-listing |
| Admin reassignment | Allowed post-approval. No seller notification. Product stays published. |
| Archiving | Blocked if active products exist. Admin must reassign first. |
| Buyer filters | All 3 levels filterable on category pages |
| Search scope | Context search covers selected level and all children |


## 11.7 Example Category Tree


| Level 1 | Level 2 | Level 3 (examples) |
| --- | --- | --- |
| Home Décor | Textiles | Table Runners, Cushion Covers, Wall Hangings, Bed Throws |
| Home Décor | Ceramics | Vases, Bowls, Planters, Decorative Plates |
| Home Décor | Lighting | Pendant Lights, Table Lamps, Candle Holders |
| Kitchenware | Cookware | Kadhai, Tawa, Handi, Sauce Pans |
| Kitchenware | Serveware | Serving Bowls, Platters, Trays, Condiment Sets |
| Fashion Accessories | Jewellery | Necklaces, Earrings, Bangles, Rings |
| Fashion Accessories | Bags & Totes | Tote Bags, Clutches, Potli Bags |
| Gifting | Festive Hampers | Diwali Sets, Wedding Favours, Corporate Gifts |
| Furniture | Seating | Chairs, Stools, Floor Cushions, Ottomans |
| Furniture | Storage | Shelves, Cabinets, Baskets, Boxes |

*Illustrative example only. Admin defines and manages the actual category tree via the Admin Portal.*

# 12. UI/UX Design Language

The marketplace should feel like walking into a beautifully curated Indian artisan gallery — premium, editorial, warm, trustworthy. India expressed through craftsmanship and materials, not stereotypical motifs or tourist-inspired decoration.

## 12.0 Design Source of Truth

**Visual design and feature scope come from two different places — do not blend them by default.**

- **UI/UX (colors, typography, spacing, component styling, navigation/footer chrome, hero and card treatments, imagery)** is inherited wholesale from the existing `solomon-bharat2` codebase, specifically `solomon-bharat2/frontend`. Do not invent new colors, fonts, spacing, or component styling. Where a page or component in this PRD has a visual equivalent already built there, port it (or its component) as-is and adapt only its copy/data/CTAs to match this PRD's content rules.
- **Feature scope and business rules** come only from this PRD (Sections 4, 6–11, and the exclusions in §15.4). `solomon-bharat2` is a larger, differently-scoped product — it has pages and sections (seller/brand portal + public brand attribution, a global Shop/catalogue with product grids, referrals, wallet, team management, reviews, Google OAuth) that this PRD does not define. **Do not build those**, even though the visual components exist in `solomon-bharat2/frontend`. Conversely, if this PRD requires something `solomon-bharat2` doesn't have, build it using the same design tokens and component library described below rather than a new visual language.
- §§12.2–12.5 below document the actual tokens/assets currently in `solomon-bharat2/frontend` (`app/globals.css`, `app/layout.tsx`, `components/ui/`) as the values to reuse. If that codebase changes, its running code is the authority, not this snapshot.
- **As of v3.6, this porting is done.** This repo's own `frontend/app/globals.css` and `frontend/app/layout.tsx` now carry these exact tokens (confirmed by direct read, not by re-checking `solomon-bharat2`) — §12.2–12.3 below reflect this repo's live values, including two corrections versus earlier drafts (the actual typefaces, and one additional color token, `--color-product-text`, not previously documented). Treat *this* repo's running frontend as the authority going forward; `solomon-bharat2` was the original source, not an ongoing one.

## 12.1 Brand Personality


| Attribute | Experience |
| --- | --- |
| Premium | Carefully curated and high quality |
| Elegant | Clean, balanced, and timeless |
| Authentic | Genuine Indian craftsmanship |
| Editorial | Story-driven, magazine-like presentation |
| Minimal | Spacious and distraction-free |
| Warm | Natural colors and materials |
| Professional | Built for serious B2B commerce |
| Global | Designed for international buyers |


## 12.2 Color Palette

Ported verbatim from `solomon-bharat2/frontend/app/globals.css` (Tailwind v4 CSS-first `@theme` tokens). Use these token names/hexes — do not substitute the old bespoke Kraft/Twine values from earlier drafts of this PRD.

| Token | Purpose | Hex |
| --- | --- | --- |
| `--color-bg` | Page background | #F9F7F2 |
| `--color-surface` | Card / panel surface | #FCFAFA |
| `--color-primary` | Body text, primary ink | #1A1A1A |
| `--color-accent` | Primary CTA / links | #A68B67 |
| `--color-accent-hover` | Accent hover state | #8B7055 |
| `--color-muted-bg` | Subtle fill / secondary surface | #F5F0E8 |
| `--color-muted-text` | Secondary / muted text | #444748 |
| `--color-border-warm` | Borders, dividers | #E5E1D8 |
| `--color-product-text` | Product name / price text — deliberately dimmer than primary ink | #35322C |
| `--color-success` | Success states | #6B7E6B |
| `--color-error` | Error states | #BA1A1A |
| `--color-warning` | Warning states | #C29D72 |

*Avoid: bright blue SaaS palettes, neon, heavy gradients, pure black backgrounds, highly saturated colors.*

## 12.3 Typography

**As actually built** in `frontend/app/layout.tsx` (loaded via `next/font/google`) — this supersedes earlier drafts of this PRD and the `solomon-bharat2` snapshot it was ported from:

- **Fraunces** (weights 300–700, CSS var `--font-playfair`) — editorial serif for homepage hero headlines and other large editorial moments only. Chosen as an open-license stand-in with "the same warm, generous-x-height serif character" as Faire's proprietary Nantes typeface (per in-code comment) — do not confuse with Playfair Display; the CSS variable name is a legacy alias only.
- **Hanken Grotesk** (weights 300–700, CSS var `--font-public-sans`) — all other UI text: body copy, forms, nav, dashboards. Chosen as an open-license stand-in with "the same clean geometric-grotesk proportions" as Faire's proprietary Graphik. Do not confuse with Public Sans; the CSS variable name is a legacy alias only.
- Large headlines, generous whitespace, clear hierarchy, comfortable line spacing.
- Body text: `letter-spacing: 0.02em`, antialiased. No dark-mode palette is currently defined.

## 12.4 Layout, Spacing & Components

- Tailwind CSS v4, CSS-first config (`@theme` block in `globals.css`) — no separate `tailwind.config`.
- Component primitives: shadcn/ui, `style: base-nova`, `baseColor: neutral`, icons via `lucide-react`. Reuse `components/ui/*` (Button, Input, Badge, Dialog, Select, Sheet, Table, Tabs, Price) from `solomon-bharat2/frontend` rather than rebuilding equivalents from scratch.
- Max content width: 1280px centered.
- 8pt spacing system; generous section spacing (120–160px desktop).
- Products are the hero — interface supports, never competes.

## 12.5 Photography & Imagery

- Reuse the exact image assets already used in `solomon-bharat2/frontend` (hosted on its Cloudinary account, e.g. the homepage hero image and retailer-highlight images referenced directly by URL in `components/homepage/*.tsx`). Do not commission or generate new stock photography for pages that already have an equivalent in that codebase.
- For any new page this PRD introduces that has no `solomon-bharat2` equivalent, match its direction: natural light, soft shadows, neutral backgrounds, editorial composition; artisan workshops, handmade textures, natural materials, Indian craft environments. Avoid AI renders, over-edited imagery, generic stock, busy backgrounds.

## 12.6 Design Rules from Model Changes

- No "Shop" or "Browse All" CTA — homepage hero directs into Categories or Collections only. Do not port `solomon-bharat2`'s global catalogue/Shop pages or its product-grid homepage sections (Trending Products, Featured Brands) — they conflict with §16.4 Out of Scope.
- Category and Collection pages carry editorial heroes — essential, not optional.
- Navigation: Home | Categories | Collections | Sign In | Cart — clean and minimal. Use `solomon-bharat2`'s NavBar/Footer components visually, but with this nav item set and this PRD's footer link groups (§6.8) — drop any "Shop" link (a "Brands" index for marketplace brands exists — §17.6).
- Context search bar appears below category/collection hero, above filter row.
- Empty states within categories/collections should feel editorial, not like a dead-end grid.
- On curated products, no seller/brand name, logo, or attribution anywhere in the buyer-facing UI (marketplace brand products are the sole exception — §17.6), even where a ported `solomon-bharat2` component (e.g. a retailer/brand highlight section) would normally show one — either omit the section or restyle its content to reference Solomon Bharat only.

# 13. Technical Architecture & Engineering Standards

The platform is built as a monorepo with a Next.js frontend and Node.js + Express backend. Module names are identical on both sides for long-term maintainability.

## 13.1 Overall Project Structure

solomon-bharat/
├── frontend/                 # Next.js (App Router)
├── backend/                  # Node.js + Express
├── README.md
├── AGENTS.md
├── docker-compose.yml
└── .gitignore

## 13.2 Backend Architecture


### Stack

- Node.js + Express + TypeScript
- Prisma ORM + PostgreSQL
- Redis (caching, rate limiting, sessions)
- JWT (access + refresh tokens), bcrypt, Multer, Zod, Swagger/OpenAPI
- Vitest + Supertest

### Pattern

- Feature-Based Modular Architecture
- Layered: Routes → Controller → Service → Repository
- Repository Pattern via Prisma
- Colocated Tests per module

### Request Flow

Client → Express Route → Controller → Service → Repository → Prisma → PostgreSQL

### Backend Folder Structure

**Note on `cms`:** the module list below includes `cms/` as originally planned. **It does not exist in the actual codebase** — there is no `cms` directory, route, or model anywhere in `backend/src` or the Prisma schema, despite `README.md` claiming it as one of "14 complete modules." Homepage hero/banner content, footer static pages, and other editorial content are currently **hardcoded in frontend components** (`components/homepage/*`, the `StubPage`-shelled footer pages), not admin-editable through any backend CMS. See §10.8 (which is really Categories & Collections management, not a general content-management surface) and §15.8 for the full discrepancy. The 14 modules that actually exist are: `auth`, `buyers`, `sellers`, `agent-applications`, `catalogues`, `products`, `categories`, `collections`, `orders`, `payouts`, `payments`, `notifications`, `reviews`, `admin` — `reviews` replaces `cms` as the 14th real module.

backend/src/
├── app.ts  /  server.ts
├── config/          # env.ts, prisma.ts, redis.ts, logger.ts
├── middleware/       # auth.ts, errorHandler.ts, validate.ts, upload.ts, rateLimiter.ts, csrf.ts
├── providers/        # payments/, mail/, storage/, fx/ — real SDK + mock-fallback per provider, see §15.5
├── utils/           # bcrypt.ts, jwt.ts, response.ts, pagination.ts, helpers.ts, cookies.ts
├── modules/
│   ├── auth/
│   │   ├── auth.routes.ts
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── auth.repository.ts
│   │   ├── auth.validation.ts
│   │   ├── auth.types.ts
│   │   ├── auth.controller.test.ts
│   │   ├── auth.service.test.ts
│   │   ├── auth.repository.test.ts
│   │   └── index.ts
│   ├── buyers/           # Buyer accounts & workspace
│   ├── sellers/          # Seller accounts & portal
│   ├── agent-applications/ # Agent onboarding application + Agent Portal profile
│   ├── catalogues/       # Agent PDF catalogue generation
│   ├── products/         # Product listings & approval (buyer + agent pricing), AI polish, pricing-change requests
│   ├── categories/       # 3-level category tree
│   ├── collections/      # Admin-curated collections
│   ├── orders/           # Full order lifecycle
│   ├── payouts/          # Seller payout tracking
│   ├── payments/         # PayPal integration, FX rates, invoices
│   ├── notifications/    # In-app notifications
│   ├── reviews/          # Buyer product reviews & ratings — as built; not in the original plan
│   └── admin/            # Admin-specific operations: dashboard, reports, audit log, settings, user management
├── routes/index.ts
└── prisma/schema.prisma

### Backend Module Responsibilities


| Module | Responsibility |
| --- | --- |
| auth | Login, signup, JWT, password reset, email verification. Roles: SUPER_ADMIN | SELLER | BUYER | AGENT |
| buyers | Buyer account, profile, addresses, wishlist |
| sellers | Seller account, onboarding application, profile |
| agent-applications | Agent onboarding application, admin review, agent profile (creates a linked buyer-style purchasing identity on approval) |
| catalogues | Agent-only PDF catalogue generation and storage |
| products | Product submission, approval workflow, buyer + agent price setting, publish/unpublish, AI content polish (§8.6), pricing/variant change requests (§8.9, §10.5a) |
| categories | 3-level category tree CRUD, archiving rules, product reassignment |
| collections | Admin-curated collections, product membership, scheduling |
| orders | Full order lifecycle: payment received → procuring → collected → delivered (buyer- or agent-placed) |
| payouts | Seller payout records, manual payout status tracking |
| payments | PayPal integration, payment confirmation, invoice generation, live FX rates for buyer currency display (§6.11) |
| notifications | In-app notifications for sellers, buyers, and agents |
| reviews | Buyer product reviews & ratings, one per delivered order item (§6.10, §7.8) — as built, not in the original plan; **not** the `cms` module the original plan called for (see the note above the folder tree) |
| admin | Admin aggregations, reports, audit log, platform settings, user management (suspend/reactivate/promote) |


## 13.3 Frontend Architecture


### Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS
- TanStack Query (React Query)
- Axios, React Hook Form, Zod
- Vitest + React Testing Library

### Pattern

- Next.js App Router (file-based routing)
- Feature-Based Modular Architecture
- Component-Based Architecture
- Colocated Tests per module

### Request Flow

User → Page (app/) → Feature Module → Component → Hook → Service → Backend API

### Frontend Folder Structure — As Planned (§13.3 original) vs As Built

The structure below was the original module-mirroring plan. **It does not match the current codebase.** The actual, as-built structure — verified in `frontend/` — is documented immediately after, and is the one to extend going forward. The two differ in two important ways: (1) there is no `frontend/src/` root or `modules/` tree — routes live directly under `frontend/app/`, and shared logic lives in flat `components/`, `hooks/queries/`, and `lib/store/` folders instead; (2) only three route groups exist — `(public)`, `(seller)`, `(admin)` — buyer- and agent-facing pages are **flat top-level routes** shared by both roles (role-branching happens inside components/hooks, not via a `(buyer)`/`(agent)` route group). There is no `/agent/*` URL prefix.

**As-built (`frontend/`, current):**

frontend/
├── app/
│   ├── layout.tsx  /  page.tsx  (homepage)  /  loading.tsx  /  error.tsx  /  not-found.tsx
│   ├── (public)/
│   │   ├── categories/[slug]/page.tsx        # Category detail (product grid + context search)
│   │   ├── collections/page.tsx  +  [slug]/page.tsx
│   │   ├── products/[slug]/page.tsx          # Product detail page
│   │   └── search/page.tsx
│   ├── (seller)/portal/                      # SELLER role required
│   │   ├── page.tsx                          # dashboard
│   │   ├── products/page.tsx  +  [id]/page.tsx  +  [id]/edit/page.tsx  +  new/page.tsx
│   │   ├── orders/page.tsx
│   │   ├── payouts/page.tsx
│   │   └── settings/page.tsx
│   ├── (admin)/admin/                        # SUPER_ADMIN role required
│   │   ├── page.tsx                          # dashboard
│   │   ├── seller-applications/page.tsx
│   │   ├── agent-applications/page.tsx
│   │   ├── sellers/page.tsx  +  [id]/page.tsx
│   │   ├── buyers/page.tsx
│   │   ├── products/page.tsx  +  [id]/page.tsx  +  [id]/edit/page.tsx  +  new/page.tsx
│   │   ├── pricing-changes/page.tsx          # ProductPricingChangeRequest review queue
│   │   ├── orders/page.tsx  +  [id]/page.tsx
│   │   ├── payouts/page.tsx
│   │   ├── categories/page.tsx
│   │   ├── collections/page.tsx  +  [id]/page.tsx
│   │   ├── reports/page.tsx
│   │   └── settings/page.tsx
│   ├── cart/page.tsx  ·  checkout/page.tsx  +  checkout/return/page.tsx
│   ├── dashboard/page.tsx                    # shared buyer/agent post-login landing
│   ├── orders/page.tsx  ·  wishlist/page.tsx  ·  messages/page.tsx  ·  notifications/page.tsx
│   ├── payment-methods/page.tsx  ·  profile/page.tsx
│   ├── catalogue/page.tsx                    # agent PDF catalogue builder (shared route, agent-only in practice)
│   ├── sell/page.tsx                         # seller application/onboarding flow
│   ├── apply/page.tsx  ·  apply-agent/page.tsx  ·  become-agent/page.tsx
│   ├── login, signup, verify-email, reset-password/page.tsx
│   ├── about, careers, contact, cookies, export-guide, faqs, help, privacy, terms  # 10-line placeholder stubs — StubPage shell, no real content
│   └── api/currencies/route.ts  +  api/fx-rates/route.ts   # Next.js route handlers proxying FX/currency data
├── components/
│   ├── ui/            # shadcn/ui primitives: Price, badge, button, dialog, input, label, select, sheet, table, tabs
│   ├── shared/         # NavBar, Footer, ProductCard, AuthModal, DataTable, EmptyState, StatusBadge,
│   │                    # ShareProductButton + ShareFallbackModal, CatalogueTray, AddressFormDialog,
│   │                    # AddedToCartPopup, ImageLightbox, StarRating, HeroImageUpload, AppInitialiser, StubPage
│   ├── homepage/       # HeroSection, CategorySection, BuyerCategoryGrid, BuyerHomeFeed,
│   │                    # HowItWorksSection, RetailerHighlightSection, TestimonialsSection
│   ├── catalogue/      # product-browsing filter/facet UI (distinct from the agent PDF catalogue):
│   │                    # CategoryFilterDrilldown, CategorySidebarTree, CategoryTileCarousel,
│   │                    # FilterSections, FiltersDrawer, InlineFilterSidebar, ProductGrid
│   ├── pdp/            # PhotoGallery, ProductVideoStrip, ProductInfo (product detail page)
│   ├── seller-portal/  # ProductForm (shared seller+admin create/edit via a `mode` prop), CategoryCascade,
│   │                    # CategoryTypeahead, ColorSwatchModal, ColorSwatchPromptModal, ProductOptionsModal,
│   │                    # PortalSidebar, StatusBadges — `ListingScore` (originally planned) was removed, not built
│   └── admin/          # AdminSidebar, ProductAdminShared
├── hooks/queries/       # one React Query hook file per backend module area (18 files):
│                         # useAuth, useAdmin, useAgents, useBuyerDashboard, useBuyerProfile, useCatalogues,
│                         # useCategories, useCollections, useMessages, useNotifications, useOrders,
│                         # usePayments, usePayouts, useProducts, useReviews, useSellers, useWishlist, useAddresses
├── lib/
│   ├── store/           # Zustand: useAuthStore, useCartStore, useCatalogueStore, useCurrencyStore
│   ├── api.ts  ·  utils.ts  ·  pricing.ts  ·  cloudinaryImage.ts (incl. `cloudinaryFit`, a scale-to-fit
│   │  transform used anywhere a client-side focal point or full-image display must not be server-cropped —
│   │  distinct from `cloudinaryFill`'s crop-to-exact-box transform)  ·  getApiError.ts  ·  ecoAttributes.ts
│   │  (mirrors the backend's `ecoAttributes.constants.ts` vocab)  ·  indianPlaces.ts (the "Made in" typeahead list)
├── providers/  ·  types/  ·  public/
└── components.json                          # shadcn/ui config

*PDF generation for agent catalogues has no frontend code — it's entirely server-side (`backend/src/modules/catalogues/pdfBuilder.ts`, `pdfkit`). The frontend `catalogue` page only builds the product selection and calls the generate endpoint.*

### Frontend Module Structure — Original Plan (superseded)

The per-feature `modules/<name>/{components,hooks,services}` mirroring pattern shown below was the original intent and is **not** how the codebase is organized (see above). Retained here only as historical context for §13.5's naming-consistency table, which itself now maps to the as-built folders, not this structure.

modules/<name>/
├── components/  (Component.tsx + Component.test.tsx)
├── hooks/       (useFeature.ts + useFeature.test.ts)
├── services/    (feature.service.ts + feature.service.test.ts)
├── validation.ts  /  types.ts  /  index.ts

## 13.4 Tech Stack


### Frontend


| Technology | Purpose |
| --- | --- |
| Next.js (App Router) | React framework — SSR, SSG, file-based routing |
| TypeScript | Type safety across all frontend code |
| Tailwind CSS | Utility-first styling |
| TanStack Query | Server state management, caching, background refetching |
| Axios | HTTP client for API calls |
| React Hook Form | Form state management |
| Zod | Schema validation |
| Vitest + React Testing Library | Unit and component testing |
| Zustand | Lightweight client state (auth, cart, agent-catalogue-in-progress, currency) — as built; not in the original plan |
| Recharts | Admin dashboard/report charts — as built |
| Sonner | Toast notifications — as built |
| next-themes, @base-ui/react, shadcn CLI | UI primitive tooling behind `components/ui/` — as built |

*As built, there is no frontend test file anywhere in the repo (`frontend/`) and no Vitest/Jest config present — despite Vitest + RTL being the original plan. Frontend has zero automated test coverage today; see §15.7.*

### Backend


| Technology | Purpose |
| --- | --- |
| Node.js + Express.js | HTTP server and routing framework |
| TypeScript | Type safety across all backend code |
| Prisma ORM | Type-safe database access and migrations |
| PostgreSQL | Primary relational database |
| Redis | Caching, session storage, rate limiting |
| JWT | Authentication tokens (access + refresh) |
| bcrypt | Password hashing |
| Multer | File uploads (product images, documents) |
| Zod | Request validation schemas |
| Vitest + Supertest | Unit and integration testing |
| Swagger / OpenAPI | API documentation at /api/docs |
| @paypal/paypal-server-sdk | Real PayPal Orders API integration (create/capture) — as built. See §15.5 for the mock-provider fallback that the live deployment currently runs on. |
| Resend | Transactional email (verification, password reset, application decisions) — as built, with a console-logging fallback provider when unconfigured |
| Cloudinary SDK | Product image + generated-PDF storage — as built, with a local-disk fallback provider (`backend/uploads`) when unconfigured |
| @google/generative-ai (Gemini) | AI content polish for seller product submissions (`gemini-2.5-flash-lite`) — as built; not in the original plan. See §8.5a. |
| pdfkit | Server-side PDF generation for agent catalogues — as built. See §9.6. |
| Frankfurter API (via a thin provider) | INR→buyer-currency FX rates for price display — as built; not in the original plan. See §6.11. |
| ioredis + rate-limit-redis | Redis-backed rate limiting (public + auth-specific limiters) — as built |
| pino / pino-http | Structured request/app logging — as built |
| helmet | HTTP security headers — as built |

*Third-party integrations (PayPal, Resend, Cloudinary) follow a consistent pattern: a typed provider interface, a real SDK implementation, and a mock/fallback implementation, selected at module load based on whether the relevant env var is set (`backend/src/providers/{payments,mail,storage}/index.ts`). See §15.5.*


## 13.5 Module Naming Consistency

*Backend keeps the original per-module mirroring (`modules/<name>/`). Frontend, as built, has no `modules/` tree at all (§13.3) — the "Frontend" column below shows where each backend module's logic actually lives client-side: a React Query hook file under `hooks/queries/`, plus the relevant `components/` subfolder.*

| Module | Backend | Frontend (as built) | Purpose |
| --- | --- | --- | --- |
| Authentication | modules/auth/ | lib/store/useAuthStore.ts, hooks/queries/useAuth.ts | Auth, JWT, roles |
| Buyer accounts | modules/buyers/ | hooks/queries/useBuyerProfile.ts, useBuyerDashboard.ts, useAddresses.ts, useWishlist.ts | Buyer profile, wishlist, addresses |
| Seller accounts | modules/sellers/ | hooks/queries/useSellers.ts, components/seller-portal/ | Seller profile, applications |
| Agent accounts | modules/agent-applications/ | hooks/queries/useAgents.ts | Agent profile, applications |
| Catalogues | modules/catalogues/ | hooks/queries/useCatalogues.ts, lib/store/useCatalogueStore.ts, components/shared/CatalogueTray.tsx | Agent PDF catalogue generation |
| Products | modules/products/ | hooks/queries/useProducts.ts, components/seller-portal/ProductForm.tsx, components/pdp/, components/catalogue/ | Listings, approval, buyer + agent pricing, AI polish, pricing-change requests |
| Categories | modules/categories/ | hooks/queries/useCategories.ts, components/catalogue/CategorySidebarTree.tsx etc. | 3-level category tree |
| Collections | modules/collections/ | hooks/queries/useCollections.ts | Admin-curated collections |
| Orders | modules/orders/ | hooks/queries/useOrders.ts | Full order lifecycle |
| Payouts | modules/payouts/ | hooks/queries/usePayouts.ts | Seller payout records |
| Payments | modules/payments/ | hooks/queries/usePayments.ts, lib/store/useCurrencyStore.ts | PayPal integration, FX/currency display |
| Notifications | modules/notifications/ | hooks/queries/useNotifications.ts | In-app notifications |
| Reviews | modules/reviews/ | hooks/queries/useReviews.ts | Buyer product reviews & ratings — as built; replaces the originally-planned `cms` module below |
| Admin ops | modules/admin/ | hooks/queries/useAdmin.ts, components/admin/ | Admin views, reports, audit log, settings, user management |
| ~~CMS~~ | ~~modules/cms/~~ | ~~modules/cms/~~ | **Not implemented.** Originally planned for homepage hero/banners/static pages; those are hardcoded in `components/homepage/*` and `StubPage`-shelled footer routes instead. See §13.2's folder-structure note and §15.8. |


## 13.6 Engineering Standards


### Code Quality

- TypeScript strict mode — no any types ever
- ESLint + Prettier via pre-commit hooks
- Zod as single source of truth for validation on both sides

### Testing

- Colocated tests — test files live next to the file they test
- Backend: unit tests per layer (controller, service, repository) + integration via Supertest
- Frontend: component tests via React Testing Library, hook tests via Vitest
- Minimum coverage target: 70% on service layer business logic

### API Design

- RESTful API. Versioned routes: /api/v1/...
- Response envelope: { success, data, message, meta }
- Paginated lists: meta includes total, page, limit, totalPages
- All endpoints documented via Swagger/OpenAPI at /api/docs
- RBAC enforced at middleware level — never inside service or controller logic

### Authentication & Route Guards

- JWT access token (short expiry) + refresh token rotation
- Roles: SUPER_ADMIN | SELLER | BUYER | AGENT
- requireAuth — any authenticated user
- requireAdmin — SUPER_ADMIN only
- requireSeller — SELLER only
- requireBuyer — BUYER only
- requireAgent — AGENT only
- requireBuyerOrAgent — BUYER or AGENT (checkout, orders, and address routes an agent's linked purchasing identity also needs)
- Role changes can only be made by SUPER_ADMIN. Never allow role escalation from the API.

### Security

- HTTPS everywhere
- Rate limiting on all public endpoints via Redis
- Input validation on every request via Zod middleware
- CSRF protection on all state-changing endpoints
- Audit logging for all sensitive admin actions (product approval, price changes, payout marking)

### Performance

- Redis caching on: categories, collections, published product listings
- Core Web Vitals: LCP < 2.5s, INP < 200ms, CLS < 0.1
- Next.js Image component for all product images
- TanStack Query for client-side caching and background refetching

### Database

- Prisma migrations only — never edit DB schema directly
- Soft deletes on: products, orders, sellers, buyers
- Required indexes: category_id, seller_id, status, created_at

## 13.7 Key Data Models

*This section shows the core trade-flow models only. The full as-built schema (`backend/prisma/schema.prisma`) has 33 models and 14 enums — including several real, shipped workflows not otherwise documented anywhere else in this PRD before v3.6. See §15.3 for the complete model/enum reference. The two most significant additions are called out here:*

- **ProductPricingChangeRequest** — a change-request/approval workflow letting a seller propose a new price, MOQ, price-tier set, or variant set on a product that is *already approved and live*, without touching the live listing until admin approves. See §8.9 (seller-facing) and §10.5a (admin review queue).
- **Review** (+ `ReviewImage`) — buyer product reviews with a 1–5 rating and up to 5 photos, restricted to one review per delivered order item; powers a public average-rating/review-count aggregate on product pages. See §6.10 and §7.8.

### Product


| Field | Visible To | Set By |
| --- | --- | --- |
| seller_price | SELLER (own), SUPER_ADMIN | SELLER |
| admin_price | SUPER_ADMIN, BUYER | SUPER_ADMIN (set on approval) |
| agent_price | SUPER_ADMIN, purchasing AGENT | SUPER_ADMIN (set on approval or later; optional — a product may be approved and published for buyers with no agent_price yet) |
| approval_status | SELLER (own), SUPER_ADMIN | SUPER_ADMIN |
| rejection_reason | SELLER (own), SUPER_ADMIN | SUPER_ADMIN |
| declared_stock | SELLER (own), SUPER_ADMIN | SELLER |
| category_id | SUPER_ADMIN | SELLER (submit), SUPER_ADMIN (reassign) |
| collection_ids | SUPER_ADMIN | SUPER_ADMIN |
| published_at | SUPER_ADMIN | System |


### Order


| Field | Description |
| --- | --- |
| buyer_id | Linked purchasing account — a BUYER, or an AGENT's linked purchasing identity |
| admin_price_total | Total the purchaser paid — the buyer price for a buyer order, the agent price for an agent order |
| seller_price_total | Total owed to seller(s) — unaffected by whether the purchaser was a buyer or an agent |
| admin_margin | admin_price_total − seller_price_total |
| placed_as_agent | Boolean — flags an agent-placed order for admin reporting/filtering; the fulfillment lifecycle itself is identical either way |
| procurement_status | Confirming / Procuring / Collected / Shipped / Delivered |
| seller_id | Linked SELLER(s) for this order |
| payout_status | Pending / Paid |
| payout_date | When admin paid seller |
| export_documents | Uploaded shipping/customs docs |


### Agent Application


| Field | Description |
| --- | --- |
| business_name, contact_name, email, phone, business_address, country | Captured at application time |
| message | Optional free-text note from the applicant |
| status | Pending / Approved / Rejected / More Info Requested |
| rejection_reason, internal_notes | Admin-only |
| reviewed_by, reviewed_at | Which admin reviewed it, and when |


### Catalogue

Represents one agent-generated PDF catalogue.

| Field | Description |
| --- | --- |
| agent_id | Which agent generated it |
| title | Optional, agent-provided; defaults to a dated title |
| product_ids | Which products were included |
| file_url | Stored PDF location, so the agent can re-download without regenerating |


## 13.8 Search Implementation

Search queries must include a required scope parameter: category_id or collection_id. Global search is not supported — returns 400 error if no scope is provided. Enforced at API level, not just UI.

## 13.9 Environment Variables

*As built (`backend/.env.example`, `frontend/.env.example`), superseding the original plan below it. Notably: no SMTP vars (email is Resend, not raw SMTP), no `NEXT_PUBLIC_PAYPAL_CLIENT_ID` (PayPal is initiated server-side, not via a frontend SDK), and several vars the original plan didn't anticipate (Gemini, seed-admin credentials, `APP_URL` for CORS/cookie configuration).*

### Backend (`backend/.env.example`) — as built

DATABASE_URL=
REDIS_URL=
JWT_SECRET=
JWT_REFRESH_SECRET=
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=30d
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
PAYPAL_MODE=sandbox|live          # unset → falls back to the mock payment provider, see §15.5
CLOUDINARY_URL=                   # unset → falls back to local-disk storage under backend/uploads
RESEND_API_KEY=
RESEND_FROM_EMAIL=                # unset → falls back to a console-logging mail provider
GEMINI_API_KEY=                   # required for POST /products/ai/polish; unset → that endpoint 400s
PORT=
NODE_ENV=
APP_URL=                          # single-origin CORS target + cross-domain cookie config (Vercel↔Render)
SEED_ADMIN_EMAIL=
SEED_ADMIN_PASSWORD=

### Frontend (`frontend/.env.example`) — as built

NEXT_PUBLIC_API_URL=http://localhost:4000

### Original Plan (superseded)

DATABASE_URL=
REDIS_URL=
JWT_SECRET=
JWT_REFRESH_SECRET=
JWT_EXPIRES_IN=
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
PAYPAL_MODE=sandbox|live
CLOUDINARY_URL=
SMTP_HOST=  SMTP_PORT=  SMTP_USER=  SMTP_PASS=
PORT=  NODE_ENV=

NEXT_PUBLIC_API_URL=
NEXT_PUBLIC_PAYPAL_CLIENT_ID=
NEXT_PUBLIC_APP_URL=

# 14. Roadmap & Release Strategy


## 14.1 MVP (Phase 1)


### Public Marketplace

- Homepage, Categories, Collections, Product Detail, Authentication, Cart, Checkout (PayPal)
*No Shop page. Context-scoped search only.*

### Buyer Workspace

- Dashboard, Orders, Wishlist, Messages, Profile

### Seller Portal

- Dashboard, My Products, Submit Product, Orders, Payouts, Settings

### Agent Portal

- Dashboard, Products (agent-priced browsing), Catalogue Builder (PDF), Product Sharing (native share / WhatsApp fallback), Orders, Settings
- Public: Apply as an Agent

### Admin Portal

- Dashboard, Seller Applications, Agent Applications, Product Management (Approve + Buyer & Agent Price), Pricing/Variant Change Requests, Buyers, Orders (buyer + agent), Payouts, Categories & Collections, Reports, User Management, Audit Log, Settings
- Buyer Workspace addition: Reviews (leave a review per delivered order item)
- Seller Portal addition: AI Content Polish (optional, on product submission), Pricing/Variant Change Requests

## 14.2 Phase 1.5

- Enhanced admin analytics (margin, seller performance, collection performance)
- Advanced filters within categories and collections
- Notification center improvements
- Bulk product actions for admin
- Seller stock alert notifications

## 14.3 Future Releases

- AI product recommendations within collections
- Sample request workflow
- Mobile apps (iOS / Android)
- Multi-language support
- Automated payout processing
- ERP / accounting integrations
- Multi-currency seller pricing

# 15. Implementation Status & As-Built Reference

Everything above this section describes the intended product. This section is the reconciliation layer: what is actually running in the codebase today (D:\solomon), verified by reading the source directly — not inferred from this PRD's plan or from `README.md`'s own claims (which are themselves out of date in places, see §15.8). Treat this section as the authority on "what's built" and the rest of the PRD as the authority on "what it should do and why." When they conflict, this section wins until the relevant earlier section is corrected.

## 15.1 Build Status Summary

| Layer | Status |
| --- | --- |
| Backend (17 modules incl. `brands`, `product-import`, `rfqs`; RBAC, providers, PDF/AI/FX integrations) | Complete and deployed. All routes below are live; v3.9 routes are listed in §18.14. |
| Frontend — public marketplace, seller portal, admin portal | Complete and deployed. Real, data-driven pages throughout. |
| Frontend — buyer/agent workspace pages | Complete, but as flat shared top-level routes, not the `(buyer)`/`(agent)` route groups the original plan called for (§13.3). |
| Frontend — footer/informational pages | **Real content as of v3.9:** Terms, Privacy, Cookie Policy, Seller Agreement, Help, FAQs and Export guide (§18.11). |
| CMS (homepage hero/banner/static-page management) | **Not built.** Content is hardcoded in frontend components. |
| Frontend automated tests | **None.** Zero test files, no test runner configured. |
| Backend automated tests | **v3.9: 60 test files, 1,152 tests passing.** Earlier note: 35 test files across 12/14 modules (missing full coverage for `agent-applications`, `reviews`, `catalogues`). `README.md` claims ~483 passing tests; not independently re-verified in this pass. Coverage report on disk is a stale (~6-week-old) snapshot, not continuously regenerated. |
| Payments | **v3.9: live deployment runs manual bank transfer** (`PAYMENT_MODE=manual`); the admin confirms receipt with the UTR (§18.5). The PayPal code still exists but is not live; the payment gateway is waiting on the provider. |
| Deployment | Live: Render (backend), Vercel (frontend), Upstash (Redis), Neon (Postgres, pre-existing/shared with dev). |
| Overall phase | Pre-launch (UK first). All demo data was removed from production; only the admin account remains (§18.13). |

## 15.2 Backend Module & API Reference

14 modules under `backend/src/modules/`, each `routes → controller → service → repository`, mounted under `/api/v1` in `backend/src/routes/index.ts`. Route guards in parentheses use the names defined in §13.6 (`requireAuth`, `requireAdmin`, `requireSeller`, `requireBuyer`, `requireAgent`, `requireBuyerOrAgent`); "public" means no auth required, "optional auth" means the route behaves differently if a token is present but doesn't require one.

**auth** — `/api/v1/auth` (9 routes): `POST /signup` (public, buyer self-signup) · `POST /login` · `POST /refresh` · `POST /logout` · `GET /verify-email` · `POST /forgot-password` · `POST /reset-password` · `GET /me` (auth) · `GET /session` (public, cookie-only read used by frontend middleware, no token rotation).

**categories** — `/api/v1/categories` (8): `GET /` (public tree + published product counts) · `GET /admin/tree` (admin, incl. archived) · `GET /:slug` (optional auth) · `POST /` (admin, image upload) · `PATCH /reorder` (admin) · `PATCH /:id` (admin, image upload) · `POST /:id/archive` (admin, blocked if active products assigned) · `POST /:id/restore` (admin).

**sellers** — `/api/v1/sellers` (11): `POST /apply` (public) · `GET /applications` (admin) · `GET /applications/:id` (admin) · `POST /applications/:id/approve` (admin, creates SELLER account) · `POST /applications/:id/reject` (admin) · `POST /applications/:id/request-info` (admin) · `POST /applications/:id/notes` (admin) · `GET /me` (seller) · `PATCH /me` (seller) · `GET /` (admin list) · `GET /:id` (admin detail).

**products** — `/api/v1/products` (26, the largest module): `GET /me` (seller, own list) · `GET /me/:id` (seller) · `PATCH /me/:id` (seller, blocked once approved) · `POST /me/:id/resubmit` (seller) · `DELETE /me/:id` (seller, soft) · `GET /admin` (admin list, w/ seller price + margin) · `GET /admin/pricing-changes` (admin, §10.5a queue) · `POST /admin/pricing-changes/:id/approve` (admin) · `POST /admin/pricing-changes/:id/reject` (admin) · `GET /admin/:id` · `PATCH /admin/:id` (admin, no ownership check, works on already-approved products) · `POST /admin/:id/approve` (sets selling price) · `POST /admin/:id/reject` · `PATCH /admin/:id/price` · `PATCH /admin/:id/category` (reassign L3 category) · `POST /admin/:id/publish` · `POST /admin/:id/unpublish` · `POST /admin/:id/feature` · `POST /admin/:id/unfeature` · `POST /ai/polish` (seller, Gemini, §8.6) · `POST /` (seller create, 2–10 images) · `POST /admin` (admin creates directly as already-approved/published — house inventory or on a seller's behalf) · `GET /` (public browse: categoryId/collectionId/search/sort) · `GET /recommendations` (buyer/agent, personalized) · `GET /facets/place-of-origin` (public) · `GET /:slug` (public; includes agentPrice when the viewer is an authenticated agent).

**collections** — `/api/v1/collections` (15): `GET /admin` (admin list incl. draft/archived) · `GET /admin/:id` · `POST /` (admin create) · `PATCH /:id` · `POST /:id/publish` · `POST /:id/unpublish` · `POST /:id/archive` · `POST /:id/feature` · `POST /:id/unfeature` · `POST /:id/products` (add) · `PATCH /:id/products/reorder` · `DELETE /:id/products/:productId` · `GET /featured` (public) · `GET /` (public list) · `GET /:slug` (public detail).

**buyers** — `/api/v1/buyers` (13, `requireBuyerOrAgent` except where noted): `GET /me` · `PATCH /me` · `GET /me/addresses` · `POST /me/addresses` · `PATCH /me/addresses/:id` · `DELETE /me/addresses/:id` · `POST /me/addresses/:id/default` · `GET /me/wishlist` (buyer-only) · `POST /me/wishlist` (buyer-only) · `DELETE /me/wishlist/:productId` (buyer-only) · `GET /me/messages` (buyer-only) · `POST /me/messages` (buyer-only) · `GET /admin` (list) · `GET /admin/:id` · `GET /admin/:id/messages` · `POST /admin/:id/messages` (admin reply).

**orders** — `/api/v1/orders` (13): `GET /me` · `GET /me/:id` (buyer/agent) · `GET /seller/items` (seller, no buyer info exposed) · `GET /admin` · `GET /admin/:id` · `POST /admin/:id/confirm` · `POST /admin/:id/procure` · `POST /admin/:id/collect` · `POST /admin/:id/ship` · `POST /admin/:id/deliver` · `POST /admin/:id/cancel` · `PATCH /admin/:id/tracking` · `POST /admin/:id/export-documents`. State machine matches the `OrderStatus` enum exactly: `PENDING_PAYMENT → PAYMENT_RECEIVED → CONFIRMED → PROCURING → COLLECTED → IN_TRANSIT → DELIVERED`, or `→ CANCELLED` at any point before fulfillment.

**payments** — `/api/v1/payments` (4): `GET /fx-rates` (buyer/agent, §6.11) · `POST /checkout` (buyer/agent, creates order + starts PayPal) · `POST /:id/capture` · `GET /:id` (status) · `GET /orders/:orderId/invoice` (owner or admin).

**payouts** — `/api/v1/payouts` (5): `GET /me` · `GET /me/summary` (seller) · `GET /admin` · `GET /admin/:id` · `POST /admin/:id/mark-paid` · `PATCH /admin/:id/notes`.

**notifications** — `/api/v1/notifications` (4): `GET /` (any auth role) · `GET /unread-count` · `POST /:id/read` · `POST /read-all`.

**reviews** — `/api/v1/reviews` (2): `POST /` (buyer, one per delivered order item, up to 5 photos) · `GET /` (public, paginated + avgRating/reviewCount aggregate). No admin moderation endpoint exists — published reviews are live immediately.

**agent-applications** — mounted at `/api/v1/agents` (10): `POST /apply` (public) · `GET /applications` (admin) · `GET /applications/:id` (admin) · `POST /applications/:id/approve` (admin, creates AGENT account) · `POST /applications/:id/reject` (admin) · `POST /applications/:id/request-info` (admin) · `POST /applications/:id/notes` (admin) · `GET /me` (agent) · `PATCH /me` (agent) · `GET /` (admin list) · `GET /:id` (admin detail).

**catalogues** — mounted at `/api/v1/agent/catalogues` (3): `POST /` (agent, generates PDF from selected products) · `GET /` (agent, list own) · `GET /:id` (agent, re-download without regenerating).

**admin** — `/api/v1/admin` (8), entire router gated by `requireAuth, requireAdmin`: `GET /dashboard` · `GET /reports` (revenue/orders-by-status/orders-by-country/sellers/products/categories/collections performance, JSON or CSV) · `GET /audit-log` (§10.11) · `GET /settings` · `PUT /settings/:key` (§10.12) · `GET /users` · `POST /users/:id/suspend` · `POST /users/:id/reactivate` · `POST /users/:id/promote` (role escalation to SUPER_ADMIN — the only way a new SUPER_ADMIN account is created after the seed admin, §10.10).

Test coverage per module: `admin`, `auth`, `buyers`, `categories`, `collections`, `notifications`, `orders`, `payments`, `payouts`, `products`, `sellers` each have the full controller+service+repository test triple. `catalogues` and `reviews` have service-level tests only. `agent-applications` has none.

## 15.3 Database Schema Reference

`backend/prisma/schema.prisma`, 805 lines, 14 enums, 33 models.

**Enums:**
- `Role`: SUPER_ADMIN, SELLER, BUYER, AGENT
- `UserStatus`: ACTIVE, SUSPENDED
- `SellerApplicationStatus` / `AgentApplicationStatus`: PENDING, APPROVED, REJECTED, MORE_INFO_REQUESTED
- `CategoryStatus`: ACTIVE, ARCHIVED
- `ProductApprovalStatus`: PENDING, APPROVED, REJECTED, RESUBMITTED
- `ProductPricingChangeStatus`: PENDING, APPROVED, REJECTED
- `CollectionStatus`: DRAFT, SCHEDULED, PUBLISHED, ARCHIVED
- `OrderStatus`: PENDING_PAYMENT, PAYMENT_RECEIVED, CONFIRMED, PROCURING, COLLECTED, IN_TRANSIT, DELIVERED, CANCELLED
- `PaymentStatus`: PENDING, COMPLETED, FAILED
- `PayoutStatus`: PENDING, PAID
- `MessageSender`: BUYER, ADMIN
- `NotificationType` (11 values): PRODUCT_APPROVED, PRODUCT_REJECTED, ORDER_STATUS_CHANGED, PAYOUT_PAID, SELLER_APPLICATION_APPROVED, SELLER_APPLICATION_REJECTED, AGENT_APPLICATION_APPROVED, AGENT_APPLICATION_REJECTED, NEW_MESSAGE, PRODUCT_PRICING_CHANGE_APPROVED, PRODUCT_PRICING_CHANGE_REJECTED
- `VariantStatus`: ACTIVE, INACTIVE, OUT_OF_STOCK

**Models, grouped by domain:**

| Domain | Models |
| --- | --- |
| Auth | User, RefreshToken, EmailVerificationToken, PasswordResetToken |
| Sellers | SellerApplication, SellerProfile |
| Agents | AgentApplication, AgentProfile |
| Buyers | BuyerProfile, Address, WishlistItem, Message |
| Catalog | Category (self-referential, 3 levels via parentId/level), Product, ProductImage, ProductVideo, ProductPriceTier, ProductVariant, VariantAttribute, VariantPriceTier, ProductPricingChangeRequest |
| Collections | Collection, ProductCollection (join table) |
| Orders | Order, OrderItem |
| Reviews | Review, ReviewImage |
| Payments/Payouts | Payment, Payout |
| Notifications | Notification |
| Admin | AuditLog, PlatformSetting |
| Agent tools | Catalogue |

**Notable model details beyond the core trade flow (§13.7):**
- Three-way pricing (`sellerPrice` / `adminPrice` / `agentPrice`) exists on `Product`, `ProductPriceTier`, and `VariantPriceTier` — agent pricing is a fully modeled tier column throughout, not a single bolt-on field.
- `Product` carries an extensive listing-detail field set beyond a bare row: `tags String[]`, `stepQty`, `isHandmade`, `placeOfOrigin`, `isGITagged`, `howItIsMade`, `artisanName` — in-code comments note these exist for parity with a richer "Add Product" experience from an earlier iteration of the codebase. **As of the Faire-parity form rebuild (§8.5), most of these are no longer settable through the seller UI at all** — see §8.5's "Fields the current form no longer collects" table for exactly which ones and what happens to pre-existing values.
- A second field group, added for that same rebuild, sits directly on `Product`: `ecoMaterials String[]`, `ecoPackaging String[]`, `ecoProduction String[]` (each validated against a fixed vocab in `ecoAttributes.constants.ts`), `isBestseller Boolean`, `tariffCode String?` (the flat/no-variant product's own HS code). All five are actively collected by the current form and displayed on the PDP (§6.6).
- `ProductVideo` mirrors `ProductImage` (`url`, `sortOrder`) — up to 3 per product, uploaded and validated alongside images in the same multipart request (`uploadProductMedia` in `backend/src/middleware/upload.ts`, 200MB/file), stored via `CloudinaryStorageProvider.uploadVideo` (chunked, `resource_type: 'video'`) or the local-disk fallback.
- `ProductVariant` supports multi-axis attribute combinations via a separate `VariantAttribute` table (name/value pairs), not just a single type/value pair on the variant itself — the variant's own `type`/`value` fields mirror the **first** axis only (Size, when present), kept for backward-compatible display. A consequence worth flagging: reading a variant's axes from `type`/`value` alone (rather than its full `attributes[]`) silently drops every secondary axis — this was a real bug on the public PDP's variant selector, fixed in the same pass that added §8.5's richer per-variant fields below.
- `ProductVariant` also carries per-variant shipping/inventory detail added for that rebuild: `weight`/`weightUnit`, `length`/`width`/`height`/`dimensionUnit`, `tariffCode`, `inventory`. When a product has variants, `Product.declaredStock` is derived server-side as the sum of `inventory` across them (`deriveDeclaredStock` in `products.service.ts`); `Product.weight`/`dimensions` stay authoritative only for the no-variant case.
- `ProductPricingChangeRequest` stores `proposedMoq`, `proposedSellerPrice`, `proposedPriceTiers` (Json), `proposedVariants` (Json). Approving atomically replaces the live product's tiers/variants; rejecting leaves the live product completely untouched. See §8.9, §10.5a. **`proposedVariants` predates the per-variant weight/dimensions/tariff/inventory fields above and doesn't carry them** — see §8.9's footnote.
- `Order` carries `placedAsAgent Boolean`, `adminPriceTotal`, `sellerPriceTotal`, `adminMargin`, `exportDocuments Json?`, `expectedCollectionDate`, `trackingNumber` directly on the row — the admin-intermediated margin/logistics model from §2 is captured at the data layer, not derived at read time.
- Soft deletes (`deletedAt`, indexed) on `SellerProfile`, `AgentProfile`, `BuyerProfile`, `Product`, `Order`.
- `Catalogue.items` is `Json`: `{productId, price, moq}[]` — the agent's own resale-relevant price/MOQ per product, frozen at PDF-generation time (note: this is the *agent's purchase* price/MOQ snapshot for the agent's own reference, not a price shown in the generated PDF itself — the PDF never shows a price, §9.6).
- `AuditLog` and `PlatformSetting` back §10.11/§10.12 and are fully implemented, not placeholders.

No PRD-described model is missing from the schema; if anything the schema is richer than this PRD's original data-model sections suggested (pricing-change-requests, multi-axis variants, audit log, platform settings, reviews).

## 15.4 Frontend Route Inventory

See §13.3 for the full as-built folder structure. Summary of what's real vs. placeholder:

- **`(admin)/admin/`**: 20 real, data-driven page files (dashboard, seller-applications, agent-applications, sellers + [id], buyers, categories, collections + [id], orders + [id], payouts, pricing-changes, products list + [id] + [id]/edit + new, reports, settings). All wired to live queries via `hooks/queries/`.
- **`(seller)/portal/`**: 8 real pages (dashboard, orders, payouts, products list + [id] + [id]/edit + new, settings).
- **`(public)/`**: 5 real pages (categories/[slug], collections + [slug], products/[slug], search).
- **Top-level shared routes** (buyer + agent, no route group): `page.tsx` (homepage), `cart`, `checkout` + `checkout/return`, `dashboard`, `catalogue` (agent PDF builder), `sell` (seller application flow, 807 lines), `apply` + `apply-agent` + `become-agent` (809 lines — the single largest page in the repo), `messages`, `notifications`, `orders`, `payment-methods`, `profile`, `wishlist`, `login`/`signup`/`verify-email`/`reset-password`. All real.
- **9 footer/informational pages** (`about`, `careers`, `contact`, `cookies`, `export-guide`, `faqs`, `help`, `privacy`, `terms`): each exactly 10 lines, rendering the shared `StubPage` component (NavBar + heading + one paragraph + Footer) — explicitly commented in code as "a minimal placeholder page shell for footer links that don't have full content yet." **Not real content** — do not present these as built in any status report without this caveat.
- **`app/api/`**: two Next.js route handlers (`currencies/route.ts`, `fx-rates/route.ts`) proxying FX/currency data server-side — not part of the main Express backend API.

## 15.5 Third-Party Integrations — Real/Mock Provider Pattern

PayPal, email, and file storage all follow the same pattern: a typed provider interface, a real SDK implementation, and a mock/fallback implementation, chosen at module-load time by a factory (`backend/src/providers/{payments,mail,storage}/index.ts`) based on whether the relevant env var is set.

| Integration | Real implementation | Fallback (when env var unset) | Current live status |
| --- | --- | --- | --- |
| Payments | `@paypal/paypal-server-sdk`, `OrdersController.ordersCreate`/`ordersCapture`, sandbox/production switch via `PAYPAL_MODE` | `MockPaymentProvider` | **Running on the mock provider** — no `PAYPAL_CLIENT_ID`/`SECRET` set in production yet |
| Email | `Resend` SDK — verification, password reset, application decisions | `ConsoleMailProvider` (logs instead of sending) | Depends on whether `RESEND_API_KEY` is set in the deployed environment — verify before relying on outbound email in production |
| File storage | `cloudinary` v2 SDK — `uploadImage`/`uploadFile` (raw resource type for PDFs)/`deleteImage` | `LocalDiskStorageProvider` (serves from `backend/uploads` via the `/uploads` static route) | Cloudinary is required in the real Render deployment per `DEPLOYMENT.md` (Render's disk isn't persistent) |
| AI content polish | `@google/generative-ai`, model `gemini-2.5-flash-lite`, proofreads name/description/tags without rewriting facts | None — `POST /products/ai/polish` returns 400 if `GEMINI_API_KEY` is unset | Optional feature; safe to run without it |
| FX rates | Frankfurter API via a thin provider, INR→display-currency conversion | None documented | Feeds `GET /payments/fx-rates` and buyer-facing currency display (§6.11) |

## 15.6 Deployment Architecture

- **Backend → Render**, via Blueprint (`render.yaml`): single web service `solomon-bharat-backend`, Node runtime, `rootDir: backend`, build = `npm ci --include=dev && npx prisma migrate deploy && npm run build`, health check at `/api/v1/health`. `PAYPAL_MODE=sandbox` and `JWT_EXPIRES_IN=15m` / `JWT_REFRESH_EXPIRES_IN=30d` are hardcoded in the blueprint; secrets (`DATABASE_URL`, `REDIS_URL`, JWT secrets, `APP_URL`, PayPal/Cloudinary/Resend/Gemini keys, seed-admin credentials) are `sync: false` — set manually in Render's dashboard.
- **Frontend → Vercel**, root directory `frontend`.
- **Redis → Upstash.**
- **Database → an existing Neon Postgres instance**, already migrated and seeded, reused as-is (not a fresh production database).
- **Known, already-fixed operational issues** (per `DEPLOYMENT.md`, confirmed in code): Render's IPv6-to-Neon DNS resolution issue, fixed via `NODE_OPTIONS=--dns-result-order=ipv4first` in `render.yaml`; cross-domain cookies for the Vercel↔Render hop, handled via `SameSite=None; Secure` in `backend/src/utils/cookies.ts`; CORS locked to a single origin (`APP_URL`) in `backend/src/app.ts`.
- **Known, still-open gaps** (per `DEPLOYMENT.md`): single-origin CORS is a real limitation if a second frontend origin is ever needed; PayPal is still on mock/sandbox, not live; dev and prod currently share one database; one pre-existing high-severity `npm audit` advisory is not yet fixed.
- **Local dev**: `docker-compose.yml` runs Postgres 16-alpine + Redis 7-alpine with fixed dev credentials (`solomon`/`solomon`/`solomon_bharat`) — local-only, not representative of the production topology above.

## 15.7 Testing Status

- **Backend**: 35 test files across 12 of 14 modules. Full controller+service+repository triple for `admin`, `auth`, `buyers`, `categories`, `collections`, `notifications`, `orders`, `payments`, `payouts`, `products`, `sellers`. Service-only tests for `catalogues` and `reviews`. No tests at all for `agent-applications`. `README.md` claims ~483 passing tests — plausible given the file/module count, not independently re-run as part of this audit. The `backend/coverage/` report on disk is dated roughly six weeks before this section was written and is not part of a continuously-regenerated pipeline — treat any coverage percentage from it as stale.
- **Frontend**: zero test files anywhere in `frontend/`, and no Vitest/Jest configuration present, despite §13.4's original plan calling for Vitest + React Testing Library. There is currently no automated frontend test coverage of any kind — UI regressions are only caught by manual testing.

## 15.8 Known Documentation Debt / Discrepancies

Places where existing project documentation (not this PRD) describes something that isn't actually true of the current code — flagged so nobody re-propagates them:

1. `README.md` claims a 14th backend module called `cms`. **It does not exist.** The real 14th module is `reviews` (§15.2). Homepage/banner/static-page content is hardcoded in frontend components, not admin-managed.
2. `README.md` claims frontend route groups `(public)`, `(buyer)`, `(seller)`, `(agent)`, `(admin)`. **Only `(public)`, `(seller)`, `(admin)` exist.** Buyer- and agent-facing pages are flat top-level routes shared by both roles; there is no `/agent/*` URL prefix (§13.3, §15.4).
3. A recent commit message references redirecting agents from the homepage to `/agent` — no literal `/agent` route exists in the frontend tree, so this redirect target is either aspirational, dead code, or resolves through a different mechanism not identified in this audit. Worth a follow-up check if agent homepage redirects behave unexpectedly.
4. Earlier drafts of this PRD (§12.3, pre-v3.6) named the typefaces "Playfair Display" and "Public Sans." The actual fonts loaded are **Fraunces** and **Hanken Grotesk** — only the CSS variable names (`--font-playfair`, `--font-public-sans`) retain the old names, as deliberate open-license stand-ins for a different proprietary pair (Nantes/Graphik). Corrected in §12.3 as of v3.6.
5. ~~The 9 footer/informational pages are placeholder shells.~~ **Resolved in v3.9** — legal and help pages now have real content (§18.11).
6. PayPal is "integrated" in the sense of real, tested SDK code — but the live deployment does not use it. **As of v3.9 production runs manual bank transfer** (§18.5).
7. The Submit New Product variant-options modal offers "Product language" as a selectable option-axis type, alongside Size/Color/Material/Style/Scent (§8.5). This directly contradicts this PRD's own repeated decision to exclude a Product Language field anywhere on the platform (§16.4 Out of Scope). Verified in `ProductOptionsModal.tsx`'s `AXIS_TYPES` constant — not yet fixed as of this pass.
8. The Product videos uploader's own helper text says "Each video should be 2 GB or smaller." The backend actually enforces 200MB/file (`MAX_VIDEO_FILE_SIZE_BYTES` in `backend/src/middleware/upload.ts`) — a seller following the displayed limit will have a 200MB–2GB video rejected at upload time with no matching client-side warning.
9. A full Submit/Publish save of an existing product through the current form silently force-resets `isHandmade`, `isGITagged`, and `tags` to `false`/`false`/`[]`, even if they were previously set — the form has no input for any of the three, and sends hardcoded values rather than omitting the fields. Saving as a draft does not trigger this (those fields are simply omitted from a draft save's payload, leaving prior values untouched). See §8.5.
10. `ProductPricingChangeRequest.proposedVariants` (Json) does not carry the per-variant `weight`/`length`/`width`/`height`/`dimensionUnit`/`tariffCode`/`inventory` fields introduced alongside it in the same schema change — a pricing/variant change request can reshape or reprice variants but cannot propose changes to their physical/shipping detail. See §8.9, §15.3.
11. **Superseded in v3.9:** sellers now have a "Draft with AI" button for product descriptions (`POST /products/description-draft`, Claude via `ANTHROPIC_API_KEY`; §18.7). Original note: the AI Content Polish trigger (§8.6) was removed from `ProductForm.tsx` during the Faire-parity rebuild — the backend endpoint (`POST /products/ai/polish`) is untouched and still works, but nothing in the frontend calls it anymore. Earlier PRD drafts (pre-v3.7) described this as an active in-form feature.

## 15.9 Features Built Beyond the Original PRD Scope

These exist in the shipped code and are now documented in the body of this PRD as of v3.6, but were not present in any pre-v3.6 draft. Listed together here for visibility, since they represent real product surface a stakeholder reading only the table of contents might otherwise miss:

- **Product Pricing & Variant Change Requests** (§8.9, §10.5a, `ProductPricingChangeRequest` model) — lets sellers propose price/MOQ/tier/variant changes to a live, already-approved product without disturbing what buyers/agents currently see, pending admin review.
- **Reviews & Ratings** (§6.10, §7.8, `Review`/`ReviewImage` models) — one review per delivered order item, public aggregate rating on product pages, no admin moderation step currently.
- **AI Content Polish** (§8.6) — optional Gemini-based proofreading of a seller-submitted name/description/tags field; does not alter factual fields. Backend-complete and tested, but currently unreachable from the UI — see §15.8.
- **Buyer-facing multi-currency price display** (§6.11) — live FX-rate conversion for display purposes only; does not affect seller pricing, agent pricing, or PayPal settlement currency. Distinct from the out-of-scope "multi-currency seller pricing" (§16.4).
- **Admin User Management, Audit Log, Platform Settings** (§10.10–10.12) — account suspension/reactivation, the only path to promoting a new SUPER_ADMIN, a browsable log of sensitive admin actions, and key-value platform configuration editable without a deploy.
- **Draft product status** (`ProductApprovalStatus.DRAFT`, §8.4/§8.5) — a seller can save a partially-filled product (name + category only) and resume it later from a dedicated "Drafts" filter, rather than losing progress or being forced through the full validation checklist immediately.
- **Faire-parity Submit New Product rebuild** (§8.5) — progressive reveal, a category typeahead, product video upload, controlled-vocabulary eco-attribute tags, a seller-settable bestseller flag, and a redesigned variant-options builder with per-row SKU/price/inventory/weight/dimensions/tariff-code/status and a focal-point color-swatch cropping tool. Came with a real, documented narrowing of scope: several previously-collectible fields (MOQ, Order Step, Lead Time, Handmade, GI Tagged, Tags, How It's Made, Artisan Name, per-row volume pricing) are no longer settable through this form — see §8.5's own field table for exactly what changed.
- **Product Detail View for sellers** (§8.4a) — a dedicated, comprehensive read-only summary page (`/portal/products/[id]`) distinct from the edit form, reusing the buyer-facing gallery/video components so a seller can preview exactly what buyers see, plus a full per-variant table and a real proposed-vs-current breakdown for pending pricing/variant changes.
- **PDP additions matching the Faire-parity fields** (§6.6) — Bestseller/Handmade/GI-Tagged badges, eco-attribute tags, a "How it's made" section, per-variant weight/dimensions display, HS/tariff code, and product video playback. Included a correctness fix to the variant selector itself: it previously read only a variant's primary axis, so a product with both Size and Color axes silently hid Color from buyers entirely (§15.3).

# 16. Appendix


## 16.1 Revision History


| Version | Date | Summary |
| --- | --- | --- |
| 1.0 | July 2026 | Initial PRD |
| 2.0 | July 2026 | Premium UX rewrite with comprehensive design system |
| 3.0 | August 2026 | Admin-intermediated export model. New Seller Portal and Admin Portal. Removed share links, achievements, referrals, returns. |
| 3.1 | August 2026 | Removed Shop page. Discovery via Categories and Collections only. Context-scoped search. |
| 3.2 | August 2026 | Category Management System fully defined: 3-level hierarchy, archiving rules, reassignment, buyer filters. |
| 3.3 | August 2026 | Full technical architecture: monorepo, folder structure, tech stack, engineering standards, data models, env vars. |
| 3.4 | August 2026 | RBAC simplified to 3 roles only: SUPER_ADMIN, SELLER, BUYER. Removed all sub-admin roles. Access boundaries table added. |
| 3.5 | August 2026 | Added AGENT role (4th role). New Agent Portal: agent application/approval funnel, dedicated agent price set independently of buyer price on the same product tiers, agent-priced browsing, cart/checkout reusing the buyer purchasing pipeline, PDF catalogue builder (no price shown), and product sharing (native share sheet / WhatsApp fallback) — scoped to the Agent Portal only, not a general buyer-facing feature. |
| 3.6 | September 2026 | As-built pass: reconciled the PRD against the actual codebase. Added §15 Implementation Status & As-Built Reference (full API/schema/route inventory, deployment architecture, testing status, documentation debt). Documented features that exist in code but were previously undocumented: Product Pricing & Variant Change Requests (§8.9, §10.5a), Reviews & Ratings (§6.10, §7.8), AI Content Polish (§8.5a), buyer-facing multi-currency price display (§6.11), Admin User Management / Audit Log / Platform Settings (§10.11–10.13). Corrected typography tokens (§12.3: actual fonts are Fraunces + Hanken Grotesk, not Playfair Display / Public Sans) and the frontend folder structure (§13.3) to match the real `frontend/app/`, `components/`, `hooks/queries/`, `lib/store/` layout — there is no `frontend/src/modules/` tree and no `(buyer)`/`(agent)` route groups in the actual build. Expanded §13.7 data models and §13.9 env vars to match the real 28-model Prisma schema and `.env.example` files. |
| 3.7 | September 2026 | Faire-parity Submit New Product rebuild reconciled against §8.5, which is now a full rewrite: progressive reveal, category typeahead, product video upload (new `ProductVideo` model), controlled-vocabulary eco-attribute tags, a seller-settable bestseller flag, and a redesigned per-row variant table (SKU/price/inventory/weight/dimensions/tariff-code/status, focal-point color-swatch cropping) — plus a documented narrowing of scope (MOQ/Order Step/Lead Time/Handmade/GI Tagged/Tags/How It's Made/Artisan Name/volume pricing no longer collected, three of them force-reset on save; §8.5, §15.8). Documented the real Draft product status (§8.4, §8.5) and added §8.4a for the rebuilt seller-facing Product Detail View page. Updated §6.6 Product Detail Page for the matching buyer-facing additions (bestseller/handmade/GI-tagged badges, eco tags, "How it's made," per-variant weight/dimensions, HS/tariff code, video playback) and a correctness fix to the variant selector (previously read only a variant's primary axis, silently hiding a second axis like Color). Expanded §13.7/§15.3 for the new `Product`/`ProductVariant`/`ProductVideo` fields and corrected the schema's real size (805 lines, 14 enums, 33 models — was stated as 772/11/28). Updated §13.3's component/lib folder listings (`ListingScore` was never built; added `CategoryTypeahead`, `ColorSwatchModal`, `ColorSwatchPromptModal`, `ProductOptionsModal`, `ProductVideoStrip`, `ecoAttributes.ts`, `indianPlaces.ts`). Added four new §15.8 documentation-debt entries surfaced during this pass (a "Product language" variant-axis option contradicting §16.4, a video-size helper-text mismatch, the field-reset behavior above, and a pricing-change-request gap around the new per-variant fields). |
| 3.8 | October 2026 | Marketplace brands: second seller type with onboarding question, brand profiles and storefronts, direct pricing with quantity tiers, brand-level minimum order value, per-brand orders in a single checkout, 25%/15% commission with per-brand overrides, split payments for marketplace orders (curated orders unsplit), brand portal and admin brand management, and Shopify/WooCommerce spreadsheet product import. New §17; contradicting statements in §1, §6 and §16 updated. |
| 3.15 | 15 October 2026 | Solomon AI guide and admin knowledge base (§18.14a). |
| 3.14 | 15 October 2026 | Excel import of seller applications; approved applications move to Sellers; server-side search (§18.2). |
| 3.13 | 15 October 2026 | Admin deletes non-approved seller applications (§18.2). |
| 3.12 | 15 October 2026 | Admin switch between Curated and Marketplace for approved sellers (§18.2). |
| 3.11 | 15 October 2026 | Direct sample ordering through cart and checkout (§18.7). |
| 3.10 | 15 October 2026 | Owner feedback round: new-buyer price fix, sign-up design, full product details and story on the product page, sample/wholesale switch, brand minimum-order pop-up, All products page (§18.7, §18.9, §18.16). |
| 3.9 | 14 October 2026 | Owner decisions and October build, new §18: UK-first launch; admin assigns seller type; manual bank-transfer payments; Solomon collects all payments (no split); new order lifecycle (Quality checked, Refunded, 24h brand acceptance, dispatch photos, payout on dispatch); brand invite links and own buyers at 0% commission with instant payout; custom requests (RFQ) and samples; craft category tree; mandatory craft fields; brand shop minimum required; admin price editor on every curated product; vacation mode and internal seller rating; commercial invoice and packing list PDFs; WhatsApp notifications; "Draft with AI"; legal pages and cookie consent; help content; mobile responsiveness; demo data purged. Updated §15, §16 and §17 where they conflicted. |

## 16.2 Glossary


| Term | Definition |
| --- | --- |
| SUPER_ADMIN | Solomon Bharat internal team. Full platform access. The sole merchant role. |
| SELLER | Approved Indian manufacturer or artisan. Access to Seller Portal only. |
| BUYER | International business buyer. Access to marketplace and Buyer Workspace. |
| AGENT | Approved independent reseller. Access to Agent Portal only: agent-priced browsing, catalogue builder, product sharing, cart, checkout, orders. |
| seller_price | Price declared by seller; what admin pays seller per unit |
| admin_price | Price set by admin on approval; what buyers pay on the marketplace |
| agent_price | Price set by admin, independently of admin_price, on the same product/MOQ tier; what agents pay. Optional — a product can be approved and published for buyers before an agent_price is set. |
| admin_margin | admin_price (or agent_price, for an agent order) − seller_price = gross profit per unit for Solomon Bharat |
| Catalogue | An agent-generated PDF (image, name, description per product — no price) built to share with the agent's own customers |
| Context Search | Search scoped to the current category or collection — never global |
| Collection | Admin-curated editorial grouping of products around a theme or season |
| MOQ | Minimum Order Quantity |
| GMV | Gross Merchandise Value — total buyer + agent payments received |
| AOV | Average Order Value |
| CMS | Content Management System. Not implemented as a distinct module in the current build — see §15.8. |
| RBAC | Role-Based Access Control |
| MVP | Minimum Viable Product — Phase 1 release |
| ProductPricingChangeRequest | A seller-submitted proposal to change price/MOQ/tiers/variants on an already-live, approved product, held pending until admin approves or rejects it (§8.9, §10.5a) |
| Review | A buyer's 1–5 star rating (+ optional text/photos) on a delivered order item; powers the public rating shown on a product page (§6.10) |
| SellerType | Whether a seller is **curated** (Solomon Bharat is the merchant) or a **marketplace brand** (the brand is the merchant). Chosen once at onboarding. |
| Brand | The public identity of a marketplace seller: name, logo, banner, story, verified badge, minimum order value (§17.4) |
| Minimum order value | A brand-set INR minimum on the total of that brand's items in one checkout (§17.7) |
| Commission | The platform's share of a brand order: 25% on each buyer's first paid order with the brand, 15% on that buyer's later orders, unless overridden for that brand (§17.9) |
| Split payment | At payment time, the platform keeps its commission and the brand receives the remainder; curated orders are not split (§17.9) |
| Net | A brand order item's gross minus commission; the amount paid to the brand |
| Checkout ID | The identifier shared by the sibling orders (one per brand, plus one curated) created by a single checkout |
| Brand's own buyer | A buyer who joined through a brand's invite link or was added by the brand by email. The brand pays **0% commission** on their orders and is paid out as soon as payment is confirmed (§18.4) |
| Custom request (RFQ) | A buyer's request for something not on a standard listing; always goes to the Solomon team (§18.6) |
| Sample order | A small order of a product that offers samples, within its sample limit; handled through the custom-request inbox (§18.6) |
| UTR | The bank transfer reference the admin records when confirming a manual payment (§18.5) |
| FX display currency | A buyer's chosen display currency for viewing prices, converted live from the platform's base INR price; does not affect checkout settlement, seller pricing, or agent pricing (§6.11) |


## 16.3 Key Design Decisions


| Decision | Rationale |
| --- | --- |
| No Shop / All Products page | Forces curated discovery. Keeps the experience editorial and premium. |
| Context-scoped search only | Buyers always have context. Prevents overwhelming global results. |
| No seller identity on curated products | Solomon Bharat is the brand for curated products. Buyers trust Solomon Bharat, not individual sellers. Marketplace brands are the deliberate exception (§17). |
| Admin sets buyer price independently | Enables full margin control without seller involvement. |
| No returns | Simplifies MVP operations. All sales final. **v3.9:** damage claims within 7 days with photos; cancelled paid orders are refunded by admin (§18.3). |
| Solomon collects every payment; sellers are paid on dispatch (v3.9) | Replaces the split-payment design. Solomon receives the buyer's money, pays the seller (net of commission for brands) when the order is dispatched, and pays a brand's own-buyer orders immediately (§18.4). |
| Manual bank transfer until a gateway is live (v3.9) | PayPal is not live; buyers pay by bank transfer and the admin confirms with the UTR (§18.5). |
| Seller stock self-declared | Reduces system complexity. Admin confirms availability during procurement. |
| 3-level category hierarchy | Enough depth for the catalog. All 3 levels filterable by buyers. |
| Archive blocked if active products exist | Prevents orphaned listings. Forces admin to reassign first. |
| 4 roles only (no sub-admin) | Simplest RBAC that still separates concerns. All admin power consolidated under SUPER_ADMIN; AGENT added as a 4th role rather than a BUYER variant because agents need dedicated pricing, catalogue, and sharing capability buyers must never see. |
| Agent price set independently of buyer price, on the same tiers | Lets admin approve a product for buyers without blocking on agent pricing (and vice versa), while reusing the exact tiered-pricing UI/data model already built for buyer pricing. |
| Agent orders reuse the buyer checkout pipeline | An approved agent's account gets a linked buyer-style purchasing identity under the hood, so agent checkout, order history, and fulfillment reuse the buyer flow's existing, tested code path rather than a parallel one. |
| Catalogue PDFs never show a price | The agent sets their own resale price with their own customer, outside the platform — showing a platform price in the PDF would leak Solomon Bharat's pricing to the agent's end customer. |
| Sharing scoped to the Agent Portal only | Preserves the "no share links" principle for the general marketplace (§1.2) while giving agents — whose entire value proposition is reselling to their own customers — the one tool that role actually needs. |
| Two seller types, chosen once at onboarding | Keeps the curated business untouched while allowing brands to sell directly; avoids mixed-model accounts (§17.2). |
| Brand data in its own model | A public whitelist keeps private seller data (legal name, tax ID, bank details) from ever reaching buyers (§17.4). |
| Commission locked per order item | Later changes to default or per-brand rates never rewrite history, and every payout is reconcilable (§17.9). |
| One checkout, one payment, one order per brand | Buyers pay once; each brand fulfils and is paid for its own order (§17.7). |
| Spreadsheet import, not a store connection | No stored credentials or background sync; sellers upload a Shopify or WooCommerce export and review it before anything is created (§17.14). |
| Monorepo, identical module names | Engineers instantly know which frontend module maps to which backend module. |


## 16.4 Out of Scope

- Global search
- ~~All Products / Shop page~~ (in scope as of v3.10 — `/products`, §18.7)
- Automated payout processing
- Returns or dispute resolution (damage claims with photos are in scope as of v3.9 — §18.3)
- Seller-to-buyer messaging
- Achievement system, buyer referral program
- General buyer-facing share links (product sharing exists only inside the Agent Portal — §9.7 — not on the public marketplace or in the Buyer Workspace)
- ~~All Products / Shop page~~ — **in scope as of v3.10:** `/products` (§18.7)
- ~~Drop-ship~~ — **in scope as of v3.9:** an agent can ship to a named end customer (§18.9)
- Sub-admin roles (Content Manager, Finance Manager, etc.)
- Mobile native apps (Phase 1)
- Multi-currency seller pricing
- ERP integrations (Phase 1)

---

## 17. Marketplace Brands, Split Payments & Product Import (added October 2026, v3.8)

> **v3.9:** parts of this section are superseded by §18 — notably payments (no split; Solomon collects and pays out on dispatch), the marketplace order lifecycle (24h acceptance, dispatch photos), commission (0% for a brand's own buyers) and import status (merged).

This section adds a second way to sell. It **supersedes** every earlier statement in this document that says Solomon Bharat is the *only* merchant, that sellers and buyers never interact, that sellers never see buyer data, or that no seller/brand identity is ever shown to buyers. Those statements remain true for **curated** sellers and products, which behave exactly as described in §1–§16.

### 17.1 Overview and goals

Solomon Bharat now supports two seller types, decided once by the admin when approving a seller application:

1. **Curated by Solomon Bharat** — the original model. The admin reviews and prices every product, Solomon Bharat is the merchant, and the buyer's contract is with Solomon Bharat.
2. **Sell on the marketplace** — the seller joins as a **brand**. The brand sets its own prices and its own minimum order value, publishes its own products, ships its own orders, and sells to the buyer directly under its own name. The platform takes a commission on each order.

Goals: (a) let established brands sell without admin pricing and review overhead; (b) give buyers a wider catalogue in one checkout; (c) earn commission on marketplace sales while keeping the curated business unchanged.

Non-goals: platform-handled returns, refunds or disputes; per-brand shipping fees or a shipping-rate engine; buyer–brand messaging; a separate checkout per brand.

### 17.2 Seller types compared

| | Curated | Marketplace brand |
|---|---|---|
| Merchant of record | Solomon Bharat | The brand (Solomon Bharat is the platform) |
| Onboarding | 4-step application → admin approval | Brand application → admin approval |
| Product review | Admin approves every product and sets the buyer price | None. Products publish immediately; admin can unpublish or suspend the brand |
| Buyer price | Set by admin (`admin_price`) | Set by the brand, including quantity tiers |
| Seller-declared price | `seller_price` (what Solomon pays the seller) | Same value as the buyer price (gross) |
| Platform earns | Margin (`admin_price − seller_price`) | Commission (25% on each buyer's first paid order with the brand, 15% on that buyer's later orders) |
| Payment | Received in full by Solomon Bharat — **no split** | **Split at payment**: commission to the platform, the rest to the brand (§17.9) |
| Fulfilment | Admin runs the full pipeline | Brand confirms, ships (tracking required) and marks delivered |
| Buyer data visible to seller | Never | Name, phone and shipping address of the brand's own orders only |
| Identity shown to buyers | None | Brand tag, logo, verified badge, storefront page |
| Minimum purchase | MOQ per product | MOQ per product **plus** a brand-level minimum order value |
| Returns | All sales final | All sales final on the platform; the brand may publish a display-only return policy |
| Agents (AGENT role) | Agent price set by admin, independent of the buyer price | **Agents never see or buy brand products.** The agent catalogue is Solomon-curated products only (§17.5) |

Existing sellers are all curated. One account has one type. Changing type later is an admin action, not self-service.

### 17.3 Onboarding: one application, admin decides the seller type

- The apply flow (`/apply`) is a single four-step application (seller details, products, export readiness, final details). The applicant is **not** asked how they want to sell and sees no seller-type or brand questions.
- The final step explains both commission structures (curated, and marketplace 25% on each buyer's first paid order with the brand / 15% on that buyer's later orders), states that the admin decides which applies at approval, and requires an agreement checkbox. A server-stamped timestamp records the agreement.
- The success screen never implies acceptance; a seller account exists only if the application is approved.
- The `/sell` landing page explains both ways to sell and that the team decides which fits.
- **Admin review:** at approval the admin chooses **Curated by Solomon Bharat** or **Marketplace brand** (required, set once). For a marketplace decision the admin can set the brand name (defaults to the business name) and the minimum order value in INR (defaults to 0); the brand then completes its logo, story and other profile fields in the brand portal. Approving creates the seller profile with that type and, for marketplace, the **Brand** with a unique public slug, then sends the in-app notification and the matching approval email. Rejection and "request more information" work as before. The API is `POST /sellers/applications/:id/approve` with `{ sellerType, brandName?, minOrderValueInr? }`; `POST /sellers/apply` no longer accepts a seller type or brand fields.
- Pre-approval rules unchanged: one open application per email; an email that already has an account cannot apply.

### 17.4 Brand identity and profile

Each brand has a public profile and a private one.

- **Public:** name, slug (URL), logo, banner, story, country, website, Instagram handle, return policy text, verified badge, minimum order value, product count, follower count.
- **Private (never exposed publicly):** legal name, tax identification number, commission overrides, status history, application answers, bank/payout details.
- The brand edits its profile in the Brand portal (logo and banner are uploaded, previewed, then saved with the profile). The brand's **name and slug are changed by admin only**.
- **Status:** `ACTIVE` or `SUSPENDED`. A suspended brand's products, storefront and follow list disappear from all public pages and APIs (404), and its products cannot be bought.
- **Verified badge:** set by admin; shown beside the brand tag.

### 17.5 Marketplace products and pricing

- A brand creates products with the same form and category rules as curated sellers (exactly one level-3 category, images, variants, eco attributes), with these differences:
  - The brand enters the **price buyers pay**, not a seller cost.
  - Products **publish immediately** on save; there is no review state. A brand can save a draft, publish, and unpublish its own products.
  - Edits to a live product apply immediately (no pricing-change request).
- **Quantity tiers.** A brand sets up to five price tiers per product (or per variant), e.g. 1–49 units ₹500, 50–199 ₹450, 200+ ₹400. Rules, enforced on the server and mirrored in the form:
  - the first tier starts at the product MOQ (which the brand sets);
  - quantities strictly increase and are whole numbers;
  - prices are positive and a higher quantity never costs more per unit;
  - the product's headline price is the cheapest tier;
  - for products with variants each variant has its own ladder, with an "apply to all options" shortcut.
- The checkout prices every line by tier on the server; client prices are never trusted.
- Storage: the buyer price is held in `admin_price` and the same gross value in `seller_price`, so existing pricing, tier and display code works unchanged.
- **Admin cannot change a brand's price**, create a product under a brand, or push a brand order through the curated pipeline. Admin can unpublish any product and suspend any brand.
- **Agents are excluded.** Marketplace brand products are not shown to agents anywhere (listings, search, product pages, related products, recommendations, wishlist, brand pages) and an agent cannot buy one: a direct request returns "not found" and a checkout containing one is rejected. The agent-price mechanism (§3.3, §9.5) therefore applies to curated products only, and brands never need an agent price.
- The price a guest can see is unchanged: guests never receive numeric prices from the API for either seller type.

### 17.6 Buyer experience

- **Brand tag.** Every marketplace product shows its brand (logo or initial, name, verified badge) on product cards, the product page, wishlist, cart and orders. The tag links to the brand storefront. Curated products show no tag.
- **Product page — "Buy more from this brand":** up to eight other published products of the same brand (excluding the current one), with a "View all" link. Hidden for curated products. The brand's return policy is shown in the product details.
- **Brand storefront `/brands/[slug]`:** banner, logo, name, verified badge, country, story, website and Instagram links, return policy, follower count, **Follow / Unfollow** (buyers and agents; guests are prompted to sign up), and the brand's product grid with the standard catalogue filters. Unknown or suspended brands return a 404 page.
- **Brands index `/brands`:** searchable, paginated list of active brands. A "Brands" link appears in the footer.
- **Search and filters:** the global search also matches brand names. The catalogue has a single-select **Brand** facet (name and product count) stored in the URL as `?brand=<slug>`. `brand` is a valid search scope, so a brand page is not an "unscoped listing".
- **Saved brands:** followed brands appear in a "Saved brands" tab in the wishlist area. Following brands is for buyers only; agents do not see brand pages, the Brands link, the brand filter or Saved brands.
- **"Curated by Solomon Bharat" button:** every product listing (category, collection and search pages) has a toggle button that shows only Solomon-curated products and hides marketplace brands' products. It is stored in the URL as `?curated=1`, shows as a removable filter chip, is cleared by "Reset filters", and is mutually exclusive with the Brand filter (choosing one turns off the other). It is not shown on a brand's own storefront or to agents (who only see curated products anyway). Like the other filters it narrows an existing scope; it does not create an unscoped "all curated products" listing.
- **Trust copy** is written for both seller types ("Curated products reviewed by Solomon Bharat; marketplace brands ship directly").

### 17.7 Cart, minimum order value and checkout

- The cart groups lines by brand, with one group for Solomon-curated products.
- **Minimum order value:** each brand sets a minimum (INR, shown in the buyer's currency) that applies to the **sum of that brand's items in one checkout**. The cart shows a progress notice per brand ("Add ₹X more to meet <Brand>'s minimum order of ₹Y") using text and an icon, not colour alone. The checkout button is disabled, with an explanation, while any brand is below its minimum.
- The server re-checks every minimum when the checkout is created. A shortfall returns a 422 error listing each brand, the required amount and the current amount. Items from suspended or unpublished products are rejected with a 400 and the buyer is offered "Remove unavailable items".
- **One checkout, one payment, many orders.** A single buyer payment creates one order per brand plus at most one curated order, all sharing a `checkoutId`. Buyers see them grouped as "Placed together" with a combined total, each labelled "Sold by <Brand>" or "Solomon Bharat".
- Shipping is included in the price; there is no shipping line at checkout.
- All sales are final; there is no return or refund flow.

### 17.8 Order fulfilment for marketplace orders

| Status | Who moves it | Notes |
|---|---|---|
| Pending payment | System | Hidden from buyers and brands |
| Payment received | System, when payment is confirmed | Brand is notified |
| Confirmed | Brand | |
| In transit | Brand | A tracking number (and optional carrier) is required |
| Delivered | Brand | Triggers the payout record (§17.10) |
| Cancelled | Admin | Only before shipment (payment received or confirmed) |

- The brand sees **only its own orders**, including the buyer's name, phone and full shipping address, tracking, and a per-item breakdown (gross, commission rate, commission, net). Another brand's order returns a permission error.
- Curated sellers' order views are unchanged and never include buyer data or brand orders.
- Each brand status change notifies the buyer in-app. The buyer's order view shows the brand-order progress (payment received → confirmed → shipped → delivered) and the tracking number. Steps that exist only in the curated pipeline (procuring, collected, expected collection date) are not shown for brand orders.
- **Invoices:** for a brand order the invoice names the brand (legal name if provided) as the seller and notes that payment was facilitated by Solomon Bharat Private Limited. Curated invoices are unchanged. Final wording needs legal review (§17.18).

### 17.9 Commission and split payments

**Settlement by seller type**

- **Curated orders — no split.** The buyer's payment is received in full by Solomon Bharat. The seller is later paid the agreed seller price through the existing manual payout process.
- **Marketplace orders — split.** When a buyer pays for a brand's items, the payment is divided at the moment it is confirmed: the **platform keeps its commission** and the **brand receives the remainder** (the net). The brand does not have to wait for a manual payout. In a mixed checkout, each brand's net is calculated and paid out separately and the curated portion stays with Solomon Bharat.

**Commission rule**

- **25%** of the order value on each **buyer's first paid order with that brand**; **15%** on **every later paid order from the same buyer** with that brand. A new buyer always starts at 25%.
- Rates are platform defaults, editable by admin. Admin can set a **different first/repeat rate for an individual brand**; an override wins over the default.
- Orders that are unpaid or cancelled never count as a buyer's first order with the brand.
- The rate that applied is fixed and stored on every order item (rate, commission amount and net), so later changes to defaults never alter past orders.
- Two orders for the same brand being paid at the same time must never both receive the first-order rate; the first/repeat decision is made atomically.
- The brand sees the rates and a worked example during onboarding and in its portal.

**Money model.** For each brand order item: *gross* = quantity × unit price; *commission* = gross × rate (rounded to two decimals); *net* = gross − commission. Order-level platform income for brand orders is the commission. All amounts are tracked in INR; the buyer pays in their chosen currency and the same conversion is applied to every payee share.

**Payout account.** To receive split payments a brand must connect a payout account. A brand may be approved without one, but **its products stay hidden and cannot be bought until the account is connected**. The brand portal shows a clear "connect your payout account" step.

**Delivery model (target design).**
1. The buyer pays once for the whole cart.
2. As soon as payment is confirmed, the platform's commission is retained and each brand's net share is released to that brand automatically.
3. The result is recorded per order item so that finance can reconcile every transfer.

**Required behaviours for the split**
- Transfers are idempotent: a repeated payment confirmation never pays a brand twice.
- Each transfer has a status (pending, completed, failed) and a visible failure reason; failed transfers are retried and can be re-run by admin.
- The commission rate must be known when the payment is created, so the first/repeat decision is made at checkout creation or at payment confirmation (design decision to be settled before build — see §17.18).
- Admin cancellation of a brand order before shipment must define what happens to funds already released (reversal from the brand or a platform-funded refund) — to be decided with finance.
- A webhook-style server confirmation (not only the buyer's browser returning to the site) must settle the payment, so closing the browser tab cannot leave a paid order stuck.
- The payment provider is an implementation detail and is deliberately not specified here.

**Current implementation status.** The order split by brand, minimum order value enforcement, commission calculation and storage (rate, commission and net on each item), server-side payment confirmation and the payout breakdown are built. The **automatic release of each brand's share at payment time and the brand payout-account connection are designed but not yet built**: until then brand payout records are created when the brand marks an order delivered and are marked paid manually by admin, as for curated sellers.

### 17.10 Payouts and statements

- **Curated:** unchanged — the seller's price × quantity, marked paid manually.
- **Marketplace:** each payout row records **gross, commission rate, commission amount and net**; the payout amount is the net. Until the automatic split is live, the payout record is created when the brand marks the order delivered and admin marks it paid manually, with notes.
- The brand's payouts page shows the full breakdown; the admin payouts page shows a seller-type badge and the breakdown columns. The seller summary (total earned, pending, last payout date and amount) works for both types.
- Payout notifications show amounts in ₹.

### 17.11 Brand portal

For marketplace sellers the Seller Portal becomes a Brand Portal. Curated sellers' portal is unchanged.

- **Dashboard:** orders, GMV, commission paid, net earned, pending payout, top five products, and a 30-day orders/GMV chart with a text alternative.
- **Brand profile:** edit public fields, upload logo/banner, set return policy, minimum order value, legal name and tax ID; see verified/suspended status, a link to the public page and the commission terms (including any override). A "connect payout account" card is shown (§17.9).
- **Products:** list with Published / Draft / Unpublished badges, tier-price editor, publish and unpublish actions.
- **Orders:** list with status filter; detail page with buyer and address (copy buttons), items, tracking and breakdown; actions Confirm, Ship (tracking dialog) and Mark delivered, offered only where valid.
- **Payouts:** gross / rate / commission / net per payout.
- **New-order alert:** on payment the brand gets an in-app notification and an email (items, quantities, order total and the buyer's city and country; full details in the portal).

### 17.12 Admin portal additions

- **Brands screen:** searchable, filterable list (status, search) with seller contact, verified flag, product count, order count and GMV, commission overrides. Actions: verify/unverify, suspend/reactivate (confirmation explains products are hidden), rename, set or clear per-brand first/repeat rates (validated 0–100). A **Commission defaults** card edits the platform first/repeat rates.
- Every brand change is audit-logged: verified, unverified, suspended, reactivated, renamed, commission overridden, commission defaults updated. A no-op change writes nothing.
- **Dashboard and reports:** new KPIs for commission earned and brand GMV; the revenue report adds a per-brand table (orders, GMV, commission).
- **Orders:** brand orders carry a "Marketplace · <Brand>" badge, the curated pipeline buttons are hidden, and cancel is allowed only before shipment. **Products** and **sellers** lists show brand and seller type; the price controls are hidden for brand products.
- Admin may also run product import on behalf of a seller (§17.14).

### 17.13 Notifications

| Event | Recipient | Channel |
|---|---|---|
| Brand application approved | Applicant | Email + in-app |
| New paid order | Brand | In-app + email |
| Brand order status change | Buyer | In-app |
| Payout marked paid | Seller | In-app (amount in ₹) |

### 17.14 Product import from Shopify / WooCommerce spreadsheets

Sellers can bring an existing catalogue in by uploading a store export instead of re-typing products. This is **file-based only** — there is no live connection to a Shopify or WooCommerce store, no stored store credentials and no background sync.

- **Who:** any approved seller from Portal → Import products; admin can import on behalf of a seller from the seller's page.
- **Formats:** Shopify product CSV export, WooCommerce product CSV export, or either saved as `.xlsx`. The format is detected from the column headers; an unknown format gets a clear error naming the supported ones. Limits: 5 MB per file, 1,000 products per file.
- **Flow:** (1) **Upload** the file, with on-page instructions for exporting from each platform. (2) **Review** — the detected source, file-level warnings, and a list of the products found, each with a thumbnail, name, variant count, price and any per-product issues (such as "No price found" or "No images"); the seller ticks the products to import and chooses one level-3 category for the batch. (3) **Result** — created products with links, and any failures with reasons.
- **Mapping (general):** name, description (HTML stripped to plain text), images (downloaded and re-hosted in the platform's image storage), price, variants and options, SKUs, and a materials value where the file has one. Rows sharing a Shopify handle (or a WooCommerce parent) become one product with variants.
- **WooCommerce mapping.** The WooCommerce reader follows the official *Product CSV Import Schema* (the documented column set, including the numbered `Attribute N …` groups and unit-suffixed headers such as `Weight (kg)` and `Length (cm)`):

  | WooCommerce column | Imported as |
  |---|---|
  | `Name`, `SKU`, `ID` | Product name; SKU on variants; `ID`/`SKU` identify a product and link variations |
  | `Type` (can be a comma list, e.g. `variable, downloadable, virtual`) | `simple`, `variable` and `variation` rows are imported. **`grouped`, `external`, `virtual` and `downloadable` rows are skipped** with a warning naming the row |
  | `Parent` (`id:100` or a SKU) | Attaches a variation to its parent; row order does not matter |
  | `Description` / `Short description` | Description (the long description wins; the short one is used if it is empty); HTML stripped |
  | `Regular price` | Seller price. `Sale price` and the sale dates are ignored |
  | `Images` | Comma-separated web addresses (a comma inside an address is handled); file names that are not web addresses are skipped with a note. A variation's image is added after its parent's |
  | `Attribute N name` / `value(s)` | Variation options; material-like attributes (and material-like `Meta:` columns) also fill the materials field |
  | `Weight (kg)` and other units | Product weight in **kilograms** (g, lb and oz are converted). A product with variations takes its first variation's weight; each variation also keeps its own |
  | `Length`, `Width`, `Height` (cm, mm, m, in, yd) | Dimensions stored as "L x W x H cm" (or inches) |
  | `Stock`, `In stock?` | Declared stock: a number is used as is (per variation, or the parent's number when the variation says `parent`); blank with `In stock?` = 0 gives 0; blank with `In stock?` = 1 is left for the seller to fill |
  | `Categories` (`A > B > C, D`) | Matched against our three-level category tree to **suggest a category for each product** (§ below); no confident match means no suggestion |
  | `Tags` | Product tags (up to 20, 50 characters each) |
  | `Published` (`1`, `0`, `-1`) | Products that are private (`0`) or draft (`-1`) in WooCommerce are still read but **start unticked** in the review step with a badge |
  | Everything else (featured flag, catalog visibility, tax, backorders, low-stock amount, sold individually, reviews, purchase note, shipping class, downloads, upsells, cross-sells, external URL, button text, position, attribute default/visible/global, other `Meta:` columns) | Ignored by design |

- **Category suggestion.** For each product the importer tries, in order, (1) an exact match of the full `Categories` path against our active category tree (names or slugs, ignoring case and spacing) and (2) a match of the last path segment to exactly one active level-3 category. Archived categories are never suggested. The review step preselects the suggestion for each product and the seller can change it; a **default category** chosen for the whole file covers products without a suggestion. A ticked product with neither cannot be imported.
- **Shopify mapping.** The Shopify reader accepts both the **older** column names (`Handle`, `Body (HTML)`, `Variant SKU`, `Variant Grams`, `Variant Inventory Qty`, `Variant Price`, `Image Src`, …) and the **current** official names (`URL handle`, `Description`, `SKU`, `Weight value (grams)`, `Inventory quantity`, `Price`, `Product image URL`, …):

  | Shopify column | Imported as |
  |---|---|
  | `Handle` / `URL handle` | Groups rows into one product (first row has the details, later rows add variants or images) |
  | `Title`, `Body (HTML)` / `Description` | Name and description (HTML stripped) |
  | `Option1–3 name / value` | Variant options; a single "Default Title" variant becomes a plain product |
  | `Variant SKU` / `SKU`, `Variant Price` / `Price` | Variant SKU and seller price |
  | `Variant Grams` / `Weight value (grams)` | Weight in **kilograms** (the column is always grams; the unit column is display-only; 0 or blank = not stated) |
  | `Variant Inventory Qty` / `Inventory quantity` | Declared stock per variant (summed for the product); blank = left for the seller |
  | `Packed product length / width / height / dimension unit` | Dimensions (cm or in) when all three sides and the unit are given |
  | `Product Category` | Category path (`A > B > C`) matched to our tree to suggest a category; a numeric taxonomy ID is ignored. `Type` is used as a second, lower-priority hint |
  | `Tags` | Product tags |
  | `Status`, `Published` | `active` is published, `draft` is draft, `archived` is private (flagged "Archived in Shopify"); `active` with Published FALSE is private. Draft, archived and private products start unticked in the review step |
  | `Image Src` / `Product image URL`, `Image Position`, `Variant Image` | Images in position order; variant images added after |
  | `Vendor` | **Never imported** — it is supplier identity, which buyers must not see |
  | Cost per item, compare-at price, SEO, Google Shopping, barcodes, collection, market-specific price/inclusion columns | Ignored by design |

  Real Shopify files are often messy, so the reader also ignores a stray note line that has only a handle (with a file warning) and collapses exact duplicate variant rows (same options and SKU) with a note on the product.
- **Templates:** the import page offers a downloadable template for each platform with the official column headings and example rows.
- **Created as drafts** with MOQ 0 and declared stock 0, so the seller completes MOQ, stock and tiers before submitting (curated) or publishing (brand). Imported prices are the seller's own store prices and become the seller price on the draft (curated) or the starting buyer price (brand). The admin price is never set by an import.
- **Safety and quality rules:** products whose SKU already exists are rejected (so importing the same file twice does not create duplicates); a failed image is skipped and the rest of the product still imports; one failing product never stops the others; field lengths follow the product form (name 60, description 1,000, materials 500) with a note when something is shortened; image links are fetched only from public web addresses, with limits on size, redirects and time.
- **Not imported from Shopify files:** stock quantities, weights and dimensions (WooCommerce files carry them — see above).
- **Publish-readiness hints:** the review step flags products that still lack what publishing needs, for example "No weight" or fewer than two images. A draft can be saved without them; publishing needs a description, materials, a weight above zero, a MOQ of at least 1, declared stock, a price and between 2 and 10 images.
- **Known limits:** a CSV that was opened and re-saved in Excel may already have damaged long SKUs or fractions; only the first sheet of an `.xlsx` is read; WooCommerce headings are matched in English only. A spreadsheet in any other layout (for example a custom catalogue sheet) is rejected with a message naming the supported formats.
- **Status:** merged and live (v3.9).

### 17.15 Roles and permissions

| Capability | Curated seller | Marketplace brand | Buyer / Agent | Admin |
|---|---|---|---|---|
| Submit products | For review | Publish directly | — | Create/edit (not under a brand) |
| Set buyer price | — | Yes | — | Curated only |
| See buyer name/address | No | Own orders only | — | Yes |
| Move order status | No | Own order (confirm, ship, deliver) | — | Curated pipeline; cancel before shipment |
| Edit brand profile | — | Yes (not name/slug) | — | Yes |
| Follow a brand | — | — | Yes | — |
| Verify / suspend / set rates | — | — | — | Yes |

Seller-type checks are enforced in middleware on every brand route, never in controllers.

### 17.16 Data model additions

- `SellerType` (curated | marketplace) on the seller application and seller profile; existing rows default to curated.
- `Brand` (one per marketplace seller): name, slug, logo, banner, story, country, website, Instagram, return policy, minimum order value, verified flag, status, commission overrides, legal name, tax ID.
- `BrandFollow` (buyer, brand), unique per pair.
- Seller application: brand fields, commission-terms version and acceptance timestamp.
- Product: link to its brand (null for curated).
- Order: seller (set for brand orders) and a shared `checkoutId`. Payment: the same `checkoutId`, one payment record per sibling order whose amounts sum to the buyer's total.
- Order item: commission rate and commission amount; the stored seller price and line total become the net.
- Payout: gross amount, commission rate and commission amount.
- Platform settings: default first/repeat commission rates.
- New notification types: new order received, brand application approved.
- Changes ship as additive, backwards-compatible database migrations.

### 17.17 API summary (base `/api/v1`)

| Area | Endpoints |
|---|---|
| Brands (public) | `GET /brands`, `GET /brands/:slug` |
| Brands (buyer/agent) | `POST` / `DELETE /brands/:slug/follow`, `GET /brands/following` |
| Brands (brand seller) | `GET`/`PATCH /brands/me`, `POST /brands/me/logo`, `POST /brands/me/banner`, `GET /brands/me/stats` |
| Brands (admin) | `GET /brands/admin`, `PATCH /brands/admin/:id`, `GET`/`PUT /brands/admin/commission-defaults` |
| Products | `GET /products?brand=<slug>`; `GET /products/:slug` also returns `moreFromBrand`; `GET /products/facets/brands`; `POST /products/me/:id/publish`, `/unpublish` |
| Applications | `POST /sellers/apply` takes the single application (no seller type); `POST /sellers/applications/:id/approve` takes the admin's `sellerType` decision |
| Brand orders | `GET /orders/brand`, `GET /orders/brand/:id`, `POST /orders/brand/:id/confirm`, `/ship`, `/deliver` |
| Checkout | `POST /payments/checkout` returns the checkout id and the sibling orders; capture settles every sibling order; a public server-to-server payment confirmation endpoint settles payments idempotently |
| Product import | `POST /product-import/preview`, `POST /product-import/import`, plus admin variants under `/product-import/sellers/:sellerProfileId/…` |

### 17.18 Open items and risks

1. **Legal and tax review (blocking for launch):** the platform handling money that belongs to brands; the split-payment arrangement and any licensing it requires; brand-issued invoices and the platform's commission invoice; GST/TCS and export-proceeds rules; revised terms of sale, brand agreement and privacy policy (brands now see buyer personal data); whether Solomon Bharat's role as "facilitator" is correctly worded.
2. **Split-payment design decisions:** when the first/repeat rate is decided (checkout creation or payment confirmation); treatment of funds already released when an order is cancelled; transfer failure handling; reconciliation reports; payment currency versus INR settlement.
3. **Agents and brand products (decided):** agents are limited to Solomon-curated products and cannot see or buy brand products (§17.5). Agents' catalogue PDFs and resale pricing are unaffected. If brand products should ever be offered to agents, a pricing rule (and a decision on what the brand sees about agent orders) would be needed first.
4. **No pre-moderation of brand products:** products go live immediately. Mitigations are admin unpublish/suspend; consider holding a brand's first products for review.
5. **No dispute or refund path** for either seller type; with brands as merchants this risk increases. Display-only return policies do not resolve buyer–brand disputes.
6. **Curated price visibility:** curated sellers currently receive admin and agent price tiers inside their own product data, which contradicts "sellers never see the admin price" (§1.2). This predates the marketplace work and needs its own fix.
7. ~~Product import is not yet merged~~ — merged (v3.9).
8. **Shipping** is included in price; per-brand shipping fees are deferred.
9. **Environment safety:** the payment integration must refuse to run (not fall back to a simulated provider) in production when its credentials are missing.
10. **Wording awaiting owner approval:** commission terms text and terms version, the homepage trust bar, About page and cart/checkout trust lines (all marked for confirmation in the code).

---

## 18. Owner Decisions & October 2026 Build (v3.9)

This section records the owner-confirmed decisions (October 2026) and what has been built from them. **Where it disagrees with any earlier section, this section wins.** The short owner decision list is kept in `docs/BUSINESS_DECISIONS.md`.

### 18.1 Market and launch
- First target market: **United Kingdom**. The homepage, copy and default currency lead with the UK (GBP); other countries can still buy.
- Currency is detected automatically and buyers can switch. Exchange rates update daily. Prices are shown **and charged** in the buyer's currency; agent prices are converted the same way. FX risk sits with the seller.
- Legal entity: **Solomon Bharat Private Limited, Jaipur, India**.
- Benchmarks: Faire and Ankorstore.

### 18.2 The two seller models (final)

| Topic | Curated by Solomon | Marketplace brand |
|---|---|---|
| Merchant of record | Solomon Bharat | The brand; Solomon is the marketplace and collects payment |
| Seller type chosen by | **Admin, at approval.** The applicant never sees the choice | Same |
| Buyer price | Admin sets it, per product and tier | The brand |
| Agent price | Admin sets it, per product | N/A — agents only buy curated products |
| Product approval | Required; every edit goes back for review | Not required, including edits |
| Name shown to buyers | "Solomon" | Brand name |
| What the seller sees | Only the items ordered from them; **no buyer details** | Full buyer and order details for its own orders |
| Messaging | Buyer ↔ Solomon team only | None on-platform |
| Minimum order | MOQ per product | **Shop minimum order value (required)** + MOQ per product |
| Shipping | Solomon collects at the seller's door → Jaipur warehouse → consolidated DDP to the buyer | Brand ships direct to the buyer |
| Dispatch proof | Solomon attaches QC photos (seller may add) | **Brand must upload photos** before shipping |
| Export documents | Generated by Solomon | Generated in the brand portal |
| Seller payout | On dispatch | On dispatch; **instant** for the brand's own buyers |
| Commission | None (Solomon earns the margin) | 25% first order per buyer, 15% repeat, **0% for the brand's own buyers**; goods only, never shipping |

Other seller rules:
- One seller account = one brand. Individual artisans without GST can sell only as Curated.
- Verification covers product quality, online and offline presence, and sometimes a physical visit.
- Applicants accept the versioned **Seller Agreement** in the application.
- Both types can switch products on/off and turn on **vacation mode** without approval.
- Admin keeps a private **internal rating (1–5)** per seller; it is never shown to the seller (`PATCH /sellers/:id/internal-rating`).
- **Seller Applications list (v3.14):** the default "All open" tab shows pending, more-info and rejected applications; **approved applications move to Sellers** (still visible under the Approved tab). Search is server-side across every application (business, founder or email).
- **Import applications from Excel (v3.14, admin only):** Seller Applications → **Import from Excel** (`POST /sellers/applications/import`, .xlsx or .csv, 5 MB). Built for the old backend's export (columns brand, founder, email, phone, city, country, instagram, followers, website, categories, product_desc, gi, monthly_volume, business_type, shipped, intl_orders, intl_countries, amazon, has_iec, brand_story, heard_from, accepted_terms, created_at). Each row becomes a **Pending, Curated** application with the original `created_at`, emails lower-cased, phone decimals stripped, Seller Agreement version `2026-10-13` recorded as accepted at import time. Old answer buckets (monthly volume, international orders, heard-from) are kept verbatim since they do not match the new form's buckets; categories outside the current list are noted in the application message; fields the old form never asked (GST, incorporation, other platforms) stay empty. Rows whose email already has an application or account are skipped (never overwritten), as are in-file duplicates and the "Unnamed Brand" row; the admin sees inserted / skipped (with brand names) / failed (with reasons). Insert-only; audit-logged as `SELLER_APPLICATIONS_IMPORTED`.
- **Deleting applications (v3.13, admin only):** Admin → Seller Applications → **Delete** on any pending, more-info-requested or rejected application (spam, tests, duplicates), with a confirmation (`DELETE /sellers/applications/:id`). Permanent and audit-logged (`SELLER_APPLICATION_DELETED`). Approved applications are tied to a live seller account and cannot be deleted.
- **Switching the selling model (v3.12, admin only):** Admin → Sellers → seller page → **Selling model** card → "Switch to Marketplace brand / Curated by Solomon" (`PATCH /sellers/:id/seller-type` with `{ sellerType, brandName? }`). Blocked while the seller has any order in progress (awaiting payment through dispatched). Audit-logged (`SELLER_TYPE_SWITCHED`); the seller gets an in-app notice and email.
  - *Curated → Marketplace:* a brand is created (or the seller's earlier brand is reactivated) with the admin-chosen name; every product moves to the brand; the admin's buyer price becomes the brand's price (seller price where a tier was never priced); agent prices are removed; products keep their live/draft state; the brand must then set its minimum order value (pop-up).
  - *Marketplace → Curated:* the brand page is suspended (kept for history and switching back); every product leaves the brand, is unpublished and returns to **Pending review** with the brand's price kept as the seller price; the admin sets buyer/agent prices and approves again.

### 18.3 Order lifecycle (as built)

**Curated:** Awaiting payment → Payment received → Confirmed → Procuring → Collected (at Jaipur warehouse) → **Quality checked** (photos required) → Dispatched (In transit) → Delivered. The seller payout is created on dispatch.

**Marketplace:** Awaiting payment → Payment received (**brand must accept within 24 hours**, or the order is auto-cancelled by a sweep every 10 minutes) → Accepted (Confirmed) → Dispatched (photos + tracking required; payout created) → Delivered. The brand can also **decline**. Orders from the brand's own buyers are paid out as soon as payment is confirmed.

**Cancellation and refunds**
- The buyer can cancel until the order is Confirmed (curated) or Accepted (brand) — `POST /orders/me/:id/cancel`.
- A cancelled **paid** order is marked **Refunded** by the admin with a refund reference (`POST /orders/admin/:id/refund`). Refunds after a brand declines or misses the 24h window also wait for admin approval.
- Damage claims: reported within 7 days of delivery, with photos; decided on the photo evidence. There is still no general returns policy.

New order fields: `paidAt`, `dispatchPhotos`, `brandOwnBuyer`, `refundedAt`, `refundReference`. New statuses: `QUALITY_CHECKED`, `REFUNDED`.

### 18.4 Payments and payouts
- **Solomon collects every payment**, for both seller types, and pays the seller. This **replaces the split-payment design in §17.9**; there is no automatic split and no brand payout-account connection.
- Payment is 100% in advance.
- Payout = order value minus commission (brand) or the seller price (curated), created on dispatch. Admin marks payouts paid.
- **Brand's own buyers** (§18.8): 0% commission and immediate payout.

### 18.5 Manual bank transfer (live payment method)
- Until a payment gateway is live, checkout uses **manual bank transfer** (`PAYMENT_MODE=manual`). The buyer sees the bank details and a reference; one checkout can contain several orders (one per brand plus one curated).
- The admin confirms receipt with the bank **UTR** — `POST /payments/admin/checkouts/:checkoutId/mark-paid`. This moves every order in the checkout to Payment received, records `paidAt`, and is audit-logged.
- The admin dashboard shows a "checkouts awaiting payment" counter.
- **Not built:** online payment gateway (waiting on the provider).

### 18.6 Custom requests (RFQ) and samples
- Every product page has a **"Custom requirement"** button, and there is a site-wide form at `/custom-requirement`. Requests always go to the Solomon team.
- Fields: description, quantity, target price and currency, destination country, deadline, reference images. Statuses: New → In progress → Quoted → Closed, with admin notes.
- Buyers see their own requests under Account → **Custom requests** (`/requests`). Admin works them in the Custom Requirements inbox.
- API: `POST /rfqs`, `GET /rfqs/me`, `GET /rfqs/admin`, `PATCH /rfqs/admin/:id`.
- **Samples:** a product can offer samples (`offersSamples`, `sampleMaxQty`, `samplePrice` per unit in INR). Brands must say on every product whether they offer samples; admin sets this for curated products. Buyers see "Samples available" (price only after sign-up) and use **"Order a sample"**, which creates an RFQ marked as a sample order (`isSample`). The team emails the total with shipping and bank details.

### 18.7 Products and catalogue
- **Craft category tree:** a curated Indian-craft taxonomy (based on iTokri and Amazon) is seeded automatically at server start; missing categories are added and the category cache is cleared.
- **Mandatory product fields:** title, description, material, **craft technique**, **region**, dimensions, weight, colour, variants (each with its own price/MOQ/stock), MOQ, HSN code, **lead time**, **made-to-order or ready stock**, SKU, inventory, **care instructions**, and at least 2 photos. Recommended: video and the story of the craft.
- No customisation on standard listings; customisation goes through a custom request.
- **"Draft with AI"** writes product description drafts for sellers (`POST /products/description-draft`, needs `ANTHROPIC_API_KEY`).
- **Admin price editor (curated):** the admin product page always shows editable **Buyer Price** and **Agent Price (optional)** for every tier and variant tier. A product with no tiers shows one base row built from its MOQ and seller price; saving creates that tier. During review the admin uses **"Approve & publish with these prices"** or **Reject**; after approval, **"Save prices"** updates them.
- **Brand shop minimum:** a brand cannot add or publish products until its shop minimum order value is set (above 0). As soon as a marketplace brand signs in to the portal without one, a **pop-up that cannot be dismissed** asks for it (v3.10); the dashboard also shows a banner, and checkout below the minimum is refused.
- **Price privacy:** guests never receive prices from the API, including the **sample price**.
- One-time Shopify/WooCommerce import is merged and live (§17.14).
- **Product page shows everything the seller entered** (v3.10), as a bordered spec table grouped into *Specifications* (materials, product type, dimensions, weight, each option list, care), *Craft & origin* (technique, region, handmade, GI tag, maker name for brands only), *Ordering & shipping* (MOQ, availability, lead time, samples, HS code, brand return policy) and *Sustainability & packaging* (eco materials, packaging, production — each its own row). Products with options also get an **"Options at a glance"** table (SKU, weight, size, HS code, stock per option). The seller's craft story shows as **"The story behind this product"**, and a brand product shows **"About <brand>"** with the brand's story.
- **Sample or wholesale on the product page** (v3.10): when a product offers samples, signed-in buyers get a *Wholesale order / Order a sample* switch in the price panel. Sample mode shows the sample price, a quantity picker up to the sample limit, and **"Add N samples to cart"** (v3.11): samples are bought through the normal cart and checkout like a wholesale order. A sample line is charged the product's sample price, is **exempt from the MOQ and from the brand's shop minimum** (a samples-only brand order has no minimum; in a mixed order only wholesale lines count toward it), and is capped at the product's sample limit — all enforced by the server at quote and checkout (`isSample` on each cart item; `OrderItem.isSample`). A sample and a wholesale order of the same product are separate cart lines. The cart, checkout, buyer orders and brand order pages label sample lines. A brand is paid its own sample price (commission applies as usual); a curated seller is paid its usual unit cost. "Or ask our team" still opens a sample request, and is the only option when no sample price is set.
- **All products page** `/products` (v3.10): every published product with the full catalogue filters. The homepage hero and About page "Browse products" buttons go here (previously Collections). This replaces the old "no all-products page" rule (§16.4).

### 18.8 Brand invites and own buyers
- Each brand has a **personal invite link** (`/invite/<code>`; `GET /brands/me/invite`, `GET /brands/invites/:code`, `POST /brands/invites/:code/accept`).
- A brand can also **add customers by email** (`POST /brands/me/own-buyers`): an existing buyer is linked immediately; a new email is linked when that person signs up (`BrandEmailInvite`).
- Only buyers with no earlier paid order from that brand can be claimed. Links are stored in `BrandOwnBuyer`.
- Orders from own buyers: 0% commission, flagged `brandOwnBuyer`, paid out immediately.

### 18.9 Buyers and agents
- Prices are visible after sign-up. **Sign-up signs the buyer in immediately** (the API returns a session), so a new buyer sees admin-set prices straight away (v3.10 fix: new buyers previously saw ₹0). An expired or invalid login token on a public page now returns 401 so the site refreshes the session instead of quietly showing the guest (price-less) view; if the session cannot be refreshed the page reloads as a guest. Cached pages are refetched whenever the signed-in user changes.
- The sign-up page shows a designed panel (faded block-print pattern, map grid and trade routes from Jaipur to London, New York, Dubai, Singapore, Tokyo and Sydney) instead of a photo.
- Business verification is deferred.
- Team accounts and multiple addresses are allowed; no VIP or custom price lists.
- **Agents** buy curated products only, at the admin-set agent price, and can ship to a named end customer. The catalogue PDF is **white-label**: no Solomon Bharat branding, no prices, and it carries the agent's company name, phone and email (required before creating a catalogue). No referral commission for now.

### 18.10 Admin, audit and documents
- Single admin role; all pricing, approvals, payments, refunds and payouts are admin-only. Admin can place orders on behalf of buyers.
- **Admin dashboard to-dos:** checkouts awaiting payment, new custom requests, refunds to approve, plus the existing KPIs.
- **Audit log page** (`/admin/audit-log`) shows sensitive actions, e.g. product approvals, manual payment confirmations, refunds, seller-type decisions, and brand changes.
- **Export documents:** commercial invoice and packing list PDFs per order (`GET /orders/admin/:id/documents/:type` for all orders; `GET /orders/brand/:id/documents/:type` for the brand's own).

### 18.11 Notifications, legal and content
- Notifications by **email** and **WhatsApp** (Twilio: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM`; WhatsApp is skipped when these are unset). English only.
- Published pages: **Terms**, **Privacy**, **Cookie Policy**, **Seller Agreement** (versioned), plus a GDPR **cookie consent banner**.
- Help, FAQs and Export guide have real content.
- **Analytics:** Google Analytics (when `NEXT_PUBLIC_GA_ID` is set) and **Microsoft Clarity** (project `yy0gg7k3v8`, overridable with `NEXT_PUBLIC_CLARITY_ID`; heatmaps and session recordings). Both load **only after the visitor accepts analytics cookies** in the cookie banner (UK GDPR/PECR); the Cookie Policy lists the Clarity cookies. Site runs on free hosting tiers for now.

### 18.12 Mobile
- All admin, brand, buyer and public pages fit a 390px phone screen.
- Known gap: the brand **Sales** table (`/portal/orders`) is wider than the screen; a card layout for phones is planned.

### 18.13 Launch data
- A one-time purge (`launch_purge_v1_done`) removed all demo/fake data from production — products, orders, users and sellers — keeping only the admin account and the audit log.

### 18.14 New and changed API (base `/api/v1`)

| Area | Endpoints |
|---|---|
| Payments | `POST /payments/admin/checkouts/:checkoutId/mark-paid` |
| Orders (buyer) | `POST /orders/me/:id/cancel`, `POST /orders/quote` |
| Orders (brand) | `POST /orders/brand/:id/decline`; `ship` now requires photos; `GET /orders/brand/:id/documents/:type` |
| Orders (admin) | `POST /orders/admin/:id/quality-check`, `POST /orders/admin/:id/refund`, `GET /orders/admin/:id/documents/:type` |
| RFQ | `POST /rfqs`, `GET /rfqs/me`, `GET /rfqs/admin`, `PATCH /rfqs/admin/:id` |
| Brands | `GET /brands/me/invite`, `GET /brands/invites/:code`, `POST /brands/invites/:code/accept`, `POST /brands/me/own-buyers` |
| Sellers | `PATCH /sellers/:id/internal-rating` |
| Products | `POST /products/description-draft`; `POST /products/admin/:id/approve` accepts per-tier buyer/agent prices, including a `base` tier for products with no tiers |

Data model additions: `Rfq` (+ `RfqStatus`), `BrandOwnBuyer`, `BrandEmailInvite`; Product `craftTechnique`, `careInstructions`, `leadTime`, made-to-order flag, `offersSamples`, `sampleMaxQty`, `samplePrice`, `craftImageUrl`; SellerProfile `isOnVacation`, `internalRating`; Order fields in §18.3.

### 18.14a Solomon AI (v3.15)

A public AI business guide for people abroad (often NRIs and first-time importers) who want to source Indian handmade products and start selling in their country.

- **Visitor chat, `/guide`:** open to everyone with no account. Before chatting, the visitor must give **name, email and phone** (country optional). The browser keeps a private chat token so the visitor can come back to the same chat; "New chat" starts again. Up to 60 visitor messages per chat, 2,000 characters each. Linked from the top menu ("Solomon AI") and a homepage section under the hero.
- **AI connection (v3.17):** Admin → Solomon AI → **AI connection** lets the admin paste a Google Gemini key without server access. It is checked with Google before saving, stored encrypted (AES-256-GCM, key derived from `JWT_SECRET`; changing that secret means re-entering the key), shown only as its last 4 characters, removable, and audit-logged. The admin-entered key takes priority over a `GEMINI_API_KEY` on the server (v3.18).
- **AI provider (v3.16):** when `GEMINI_API_KEY` is set, Solomon AI uses **Google Gemini** (models tried in turn: `GEMINI_MODEL` if set, then gemini-3.5-flash, gemini-2.5-flash, gemini-3.5-flash-lite; free tier) for replies, reading PDFs/images (PDF up to 18 MB) and upload suggestions, with Google Search grounding as the web search; otherwise it uses Claude via `ANTHROPIC_API_KEY`. Free-tier note: Google may use free-tier prompts to improve its products, and daily/minute limits apply (a busy message is shown when hit).
- **How it answers:** each reply is written by Claude (`claude-opus-5-5`, medium effort, server-side refusal fallback) from the **Solomon knowledge** the admin uploaded. The knowledge is the AI's foundation: it understands it and applies it to the visitor's situation in its own words (it does not paste passages or name files), explains jargon for beginners, shows cost breakdowns, and suggests Solomon's sourcing service as a next step. It stays on the topic of sourcing, importing and selling Indian handmade products. **Web search** (up to 5 searches per reply) fills gaps and fetches current figures; it is on by default, can be turned off in admin, and the AI says which points came from the web. The knowledge block is prompt-cached.
- **Admin → Solomon AI → Teach Solomon AI:** upload PDFs, images, spreadsheets (.xlsx/.csv) and text files (25 MB each; Word: save as PDF), by drag-and-drop or picker, or write/paste text. PDFs and images are read by the AI once at upload and stored as text (original kept in file storage); spreadsheets and text are read directly. Each item shows how much was learned with a "See what it learned" preview, and can be removed (takes effect immediately). Audit-logged.
- **"What to upload next":** after every change the AI reviews the knowledge against what the guide must cover (9 countries × 12 categories: trends/HS export data, India costs and MOQ, shipping, duty and VAT, marketplaces, buyers, marketing, suppliers, registration, licences, documents, payments, competitors, Solomon's own services) and lists the 6–8 most valuable uploads next, with where to get them. "Check again" refreshes on demand.
- **Visitor chats tab:** every chat with name, email, phone, country, message count and last activity; open one to read the full conversation. These are the leads.
- No model fine-tuning: the AI reads the uploaded knowledge on every answer, so new material counts immediately.
- API: public `POST /guide/start`, `GET /guide/history`, `POST /guide/chat`; admin `/guide/admin/knowledge` (+ `/text`, `/file`, `DELETE /:id`), `/guide/admin/suggestions` (+ `/refresh`), `/guide/admin/settings`, `/guide/admin/conversations` (+ `/:id`). Tables `guide_knowledge`, `guide_conversations`. Needs `ANTHROPIC_API_KEY`.

### 18.15 Not built yet (waiting on owner input or a provider)
1. Online payment gateway (manual bank transfer is live meanwhile).
2. Shipping rates: curated needs the shipping partner's API; marketplace brands choosing their own rates vs Solomon's shipping service.
3. Seller team members (several logins per seller).
4. Buyer business verification (deferred).
5. GST TCS / TDS (194-O) for marketplace sellers.
6. Mobile card layout for the brand Sales table (§18.12).

### 18.16 Change log (keep adding a line for every change)

| Date | Change |
|---|---|
| 16 Oct 2026 | Admin → Solomon AI: **Remove all** button clears every knowledge item and the old upload suggestions (visitor chats kept; audit-logged `GUIDE_KNOWLEDGE_CLEARED`; `DELETE /guide/admin/knowledge`). |
| 16 Oct 2026 | Admin → Solomon AI: **Remove all** is now always shown (greyed out when the list is empty) so admins can always find it. |
| 16 Oct 2026 | Solomon AI uploads read faster: files are marked **Learned** as soon as their text is read; the AI summary (“See what it learned”) and upload suggestions now run on a separate background line, so a slow summary no longer holds up the next file. Files removed while waiting are skipped. |
| 16 Oct 2026 | **Set your own password on first login:** approved sellers, brands and agents (who get a temporary password by email) see a “Set your own password” window right after their first sign-in and must pick a new password (or sign out) before continuing. New `users.mustChangePassword` flag (set on approval, cleared on change or reset) and `POST /auth/change-password` (current password required except while on the temporary one). Seller portal → Settings → Security now has a Change password form, with the reset-link option kept for forgotten passwords. |
| 16 Oct 2026 | **Solomon AI is now conversational:** it first gets to know the visitor (background, experience, budget, goals) one question at a time, replies in short chat-style messages, and suggests next steps only once it understands them; it no longer promotes Solomon Bharat. Each reply shows 2–3 tappable follow-up replies. When the visitor shows buying or sourcing intent, the reply shows a **Chat with Pranjal on WhatsApp** button (wa.me/919588007925) with one line about Solomon Bharat (sourcing from 5 pieces, door delivery in about 7 days). Opening message and starter buttons rewritten to ask about the visitor. |
| 16 Oct 2026 | v3.20: Solomon AI supports **OpenRouter free models** (Nemotron 3 Super → Dots3-Note Preview → Gemma 4 31B for text; Dots3-Note → Gemma 4 → Nemotron Nano Omni for images; tried in order; `OPENROUTER_MODELS` overrides. Inkling's free tier is limited to agent apps and is not used. Dots3-Note Preview is withdrawn on 31 Dec 2026 and must be replaced before then). Admin → Solomon AI → AI connection takes an OpenRouter key and a Gemini key (verified, encrypted). OpenRouter answers chats, summaries, suggestions and images first; Gemini (then Claude) is the automatic backup and reads scanned PDFs. OpenRouter free models have no web search. Free limit ~50 requests/day, ~1,000/day after a one-time $10 credit. |
| 16 Oct 2026 | v3.19: Solomon AI uploads return at once and files are read in the background one at a time (status Reading / Learned / Failed with reason; fixes "network error" on batches); each item gets an AI summary of key points plus the full text in "See what it learned"; better scanned-PDF detection; "What to upload next" runs once per batch. Gemini now tries several models in turn (each has its own free daily allowance: gemini-3.5-flash, gemini-2.5-flash, gemini-3.5-flash-lite; `GEMINI_MODEL` first if set) and answers without web search when Google refuses the search quota. Homepage hero fills the screen. |
| 15 Oct 2026 | v3.18: PDFs with a text layer are read on the server with no AI (fast, free, no quota); only scanned PDFs and images go to the AI. Gemini calls retry when Google is busy (15/30/45 s) and skip thinking when reading files; clearer errors. Admin-entered Gemini key now overrides an old server key. |
| 15 Oct 2026 | v3.17: admin can connect Solomon AI by pasting a Gemini key in Admin → Solomon AI (verified, encrypted), no server access needed. |
| 15 Oct 2026 | v3.16: Solomon AI can run on Google Gemini (free tier) when `GEMINI_API_KEY` is set; Claude remains the fallback. |
| 15 Oct 2026 | v3.15: Solomon AI: public `/guide` chat (name/email/phone required), admin Teach Solomon AI (upload PDF/image/spreadsheet/text, upload suggestions, web-search switch) and Visitor chats; homepage section and menu link. |
| 15 Oct 2026 | Rate limits: removed the site-wide limit and the limits on sign-up, check-email and seller/agent applications (they counted every visitor as one IP behind Render's proxy, so busy moments blocked everyone with "Too many requests"). Login, forgot-password and reset-password keep a 20-per-15-minutes limit, now per real visitor IP (`trust proxy`). |
| 15 Oct 2026 | v3.14: Import seller applications from the old backend's Excel export (insert-only, duplicates skipped, report shown); approved applications leave the open list (they are in Sellers); server-side application search. |
| 15 Oct 2026 | Fix: public forms (e.g. seller apply) no longer fail with "Invalid or missing CSRF token" for logged-out visitors with a stale cookie; the CSRF check now applies only to signed-in (Bearer) requests. |
| 15 Oct 2026 | v3.13: admin can permanently delete non-approved seller applications (audit-logged). |
| 15 Oct 2026 | v3.12: admin can switch an approved seller between Curated and Marketplace (Selling model card), with products, prices and brand page handled automatically; blocked while orders are in progress. |
| 15 Oct 2026 | v3.11: samples can be ordered directly through cart and checkout, at the sample price, exempt from MOQ and the brand minimum, capped at the sample limit. |
| 15 Oct 2026 | Microsoft Clarity tracking added, loaded only after analytics-cookie consent; Cookie Policy updated. |
| 15 Oct 2026 | v3.10: fixed new buyers seeing ₹0 (sign-up now signs in; expired tokens refresh instead of silently showing guest data); designed sign-up panel replaces the photo; full product spec table, options table, craft story and brand story on the product page; Wholesale/Sample switch; mandatory minimum-order pop-up for brands; `/products` all-products page as the "Browse products" target. |
| 14 Oct 2026 | Admin price editor on every curated product (base tier); brand shop minimum required before listing; sample price hidden from guests. |
| Oct 2026 | Demo data purge; mobile responsiveness; UK-first homepage; help content. |
| Oct 2026 | Admin-assigned seller type; Seller Agreement; craft fields; vacation mode; internal rating; export documents; WhatsApp; Draft with AI; samples. |
| Oct 2026 | Order lifecycle (QC, refunds, 24h acceptance, photos, payout on dispatch); manual bank transfer; brand invites at 0% commission; custom requests; craft categories; audit log page; legal pages and cookie consent. |
