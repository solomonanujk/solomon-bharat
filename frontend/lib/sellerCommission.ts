// Single source of truth for the commission figures quoted on /sell and in the
// /apply wizard. Backend defaults live in PlatformSetting
// (marketplace_commission_first / marketplace_commission_repeat); these are copy only.

// CONFIRM: curated-path commission figures (owner to confirm before launch).
export const CURATED_COMMISSION = { first: 23, repeat: 14 } as const

// CONFIRM: marketplace-brand commission figures (25% first paid order, 15% after).
export const MARKETPLACE_COMMISSION = { first: 25, repeat: 15 } as const

// CONFIRM: version string of the marketplace commission terms wording. Owner / legal
// must approve the wording shown in MarketplaceStepTerms before this goes live; bump
// this whenever the wording or figures change.
export const MARKETPLACE_COMMISSION_TERMS_VERSION = 'marketplace-2026-10'

// CONFIRM: worked example order value (INR) shown on the marketplace terms step.
export const MARKETPLACE_EXAMPLE_ORDER_INR = 10000
