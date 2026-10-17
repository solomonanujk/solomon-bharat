// ─── Guest homepage copy that states a business promise ───────────────────────
// Every line here is a claim made to buyers on the marketing homepage. Each one
// is grounded in docs/BUSINESS_DECISIONS.md: Curated by Solomon (Solomon is
// the merchant), 100% advance payment, wholesale MOQs, and DDP delivery.
// The marketplace (brand) model was removed in Oct 2026. Nothing here is a delivery time, fee or count.

/** Trust bar directly under the hero: exactly four short promises. */
// CONFIRM: owner to approve all four trust-bar promises .
export const TRUST_BAR_PROMISES: readonly string[] = [
  'Delivered duty paid to the UK',
  'Pay in your own currency',
  'Quality-checked in Jaipur',
  'Verified Indian makers',
]

/** About-preview band: three promise rows under the "We're Solomon Bharat" story. */
// CONFIRM: owner to approve these three rows. The previous homepage copy also
// claimed "lower MOQs", "delivered to your doorstep within 7–10 days" and "all
// customs and duties cleared". Those were dropped because nothing in the business
// rules backs them. Add them back here only once they're confirmed.
export const ABOUT_PROMISES: readonly string[] = [
  'Every product reviewed and priced by our team',
  'Orders are quality-checked in Jaipur and delivered duty paid to your door',
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
    title: 'Curated by Solomon',
    body: 'Buy curated products directly from Solomon Bharat. We collect, quality-check and ship them duty paid to your door.',
  },
  {
    title: 'Verified Indian makers',
    body: 'Every supplier is reviewed by our team, and every product is checked and priced before it is published.',
  },
  {
    title: 'Wholesale quantities',
    body: 'Each product shows its minimum order quantity up front, so you know what you are committing to.',
  },
  {
    title: 'Your currency, one checkout',
    body: 'See prices in your local currency and pay for your whole order in one checkout.',
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
    body: 'Order each product at or above its minimum order quantity and pay in advance in your local currency.',
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
