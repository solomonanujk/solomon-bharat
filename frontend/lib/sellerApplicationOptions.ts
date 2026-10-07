/** Fixed vocab for the "Apply to list your brand" wizard — mirrored on the backend in
 *  `backend/src/modules/sellers/sellerApplicationOptions.constants.ts`; keep both in sync. */
export const CRAFT_CATEGORIES = [
  'Block Print', 'Crochet', 'Banana Fibre', 'Kauna Grass', 'Leather', 'Embroidery',
  'Woodware', 'Metal Craft', 'Pottery / Ceramics', 'Jewellery', 'Agarbatti / Candles',
  'Handmade Paper', 'Handloom Textiles', 'Other',
] as const

export const GI_TAGGED_OPTIONS = ['Yes', 'No', 'Not sure'] as const

export const MONTHLY_SALES_VOLUME_OPTIONS = [
  'Not selling yet', 'Under ₹50K/mo', '₹50K–2L/mo', '₹2L–5L/mo', '₹5L–10L/mo', '₹10L+/mo',
] as const

export const EXPORT_ORDER_RANGE_OPTIONS = ['1–5', '6–20', '21–50', '50+'] as const

export const AMAZON_SELLING_OPTIONS = ['Yes — Amazon India', 'Yes — Global Selling', 'No'] as const

export const OTHER_PLATFORM_OPTIONS = ['Etsy', 'Faire', 'Shopify', 'IndiaMART', 'Other'] as const

export const GST_REGISTRATION_OPTIONS = ['Yes — I have GST', 'No — below threshold', 'In process'] as const

export const COMPANY_INCORPORATION_OPTIONS = ['Pvt Ltd', 'Proprietorship', 'Partnership', 'Not yet'] as const

export const IEC_STATUS_OPTIONS = ['Yes, I have IEC', 'No — need help', 'In process'] as const

export const BUSINESS_TYPE_OPTIONS = ['Manufacturer', 'Trader', 'Retailer', 'Wholesaler'] as const

export const HEAR_ABOUT_US_OPTIONS = [
  'Instagram', 'Google Search', 'Referral / Friend', 'LinkedIn', 'WhatsApp', 'Event', 'Other',
] as const

/** Frontend-only dropdown convenience — the backend's `country` field is a free
 *  string (`z.string().min(1).max(100)`), not an enum, so this list isn't mirrored
 *  on the backend. */
export const COUNTRY_OPTIONS = [
  'India', 'United States', 'United Kingdom', 'United Arab Emirates', 'Australia',
  'Canada', 'Singapore', 'Germany', 'France', 'Other',
] as const
