// ─── Guest homepage copy that states a business promise ───────────────────────
// Every line here is a claim made to buyers on the marketing homepage. Each one
// is grounded only in the business rules in AGENTS.md (Solomon Bharat is the
// sole merchant, every product is admin-reviewed before publishing, PayPal-only
// checkout, wholesale MOQs). Nothing here is a delivery time, fee, count or
// customs promise. The owner must confirm each line before launch.

/** Trust bar directly under the hero: exactly four short promises. */
// CONFIRM: owner to approve all four trust-bar promises (the first now covers both seller types).
export const TRUST_BAR_PROMISES: readonly string[] = [
  'Curated and marketplace brands, one checkout',
  'Every product reviewed before listing',
  'Secure checkout with PayPal',
  'Wholesale minimum order quantities',
]

/** About-preview band: three promise rows under the "We're Solomon Bharat" story. */
// CONFIRM: owner to approve these three rows. The previous homepage copy also
// claimed "lower MOQs", "delivered to your doorstep within 7–10 days" and "all
// customs and duties cleared". Those were dropped because nothing in the business
// rules backs them. Add them back here only once they're confirmed.
export const ABOUT_PROMISES: readonly string[] = [
  'You buy from Solomon Bharat: one merchant and one checkout for every order',
  'Products from Indian makers, each reviewed by our team before it is listed',
  'Sign up to unlock wholesale pricing on the full catalogue',
]

export interface Benefit {
  title: string
  body: string
}

/** Benefits grid: four white bordered cards (2x2 desktop). */
// CONFIRM: owner to approve all four benefit titles and descriptions.
export const BENEFITS: readonly Benefit[] = [
  {
    title: 'One trusted merchant',
    body: 'Every order is placed with Solomon Bharat, so you have a single point of contact from checkout to delivery.',
  },
  {
    title: 'A reviewed catalogue',
    body: 'Our team reviews every product before it is published to the marketplace.',
  },
  {
    title: 'Wholesale quantities',
    body: 'Each product shows its minimum order quantity up front, so you know what you are committing to.',
  },
  {
    title: 'Secure PayPal checkout',
    body: 'Pay for every order through PayPal.',
  },
]

export interface ProcessStep {
  number: string
  title: string
  body: string
}

/** How it works: three steps. Titles are the existing homepage copy. */
// CONFIRM: owner to approve the step descriptions (the titles are unchanged).
export const PROCESS_STEPS: readonly ProcessStep[] = [
  {
    number: '01',
    title: 'Browse categories and collections',
    body: 'Explore Indian-made products, organised by category and curated collection.',
  },
  {
    number: '02',
    title: 'Add to cart and check out',
    body: 'Order each product at or above its minimum order quantity and pay with PayPal.',
  },
  {
    number: '03',
    title: 'Track and receive your order',
    body: 'Follow your order’s status from your account until it arrives.',
  },
]

/** Seller strip above the final CTA. */
// CONFIRM: owner to approve the seller-strip wording.
export const SELLER_STRIP = {
  lead: 'Are you an Indian maker or supplier?',
  accent: 'Sell to international retailers',
  tail: 'through Solomon Bharat.',
} as const
