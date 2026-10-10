import type { SellerType } from '@/types'

export interface ApplyWizardState {
  /** Chosen on the first screen ("How do you want to sell?"); null until chosen. */
  sellerType: SellerType | null
  // Marketplace — Brand step
  brandName: string
  /** Logo URL (optional) — the public form has no upload endpoint; logos can be uploaded later in the brand portal. */
  brandLogoUrl: string
  brandStory: string
  brandWebsite: string
  /** INR, kept as a string in form state, parsed at submit time. */
  minOrderValueInr: string
  // Step 1 — Seller
  businessName: string
  contactName: string
  email: string
  phone: string
  city: string
  country: string
  instagramHandle: string
  /** Kept as a string in form state (plain number input), parsed at submit time. */
  instagramFollowers: string
  websiteOrSocialLink: string
  // Step 2 — Products
  craftCategories: string[]
  productDescription: string
  giTaggedProducts: string
  monthlySalesVolume: string
  // Step 3 — Export readiness
  shippedInternationally: boolean | null
  approxExportOrders: string
  exportCountries: string
  sellingOnAmazon: string
  otherPlatforms: string[]
  gstRegistration: string
  companyIncorporation: string
  iecStatus: string
  // Step 4 — Final details
  businessType: string
  hearAboutUs: string
  message: string
  agreedToCommissionTerms: boolean
}

export const INITIAL_APPLY_WIZARD_STATE: ApplyWizardState = {
  sellerType: null,
  brandName: '',
  brandLogoUrl: '',
  brandStory: '',
  brandWebsite: '',
  minOrderValueInr: '',
  businessName: '',
  contactName: '',
  email: '',
  phone: '',
  city: '',
  country: 'India',
  instagramHandle: '',
  instagramFollowers: '',
  websiteOrSocialLink: '',
  craftCategories: [],
  productDescription: '',
  giTaggedProducts: '',
  monthlySalesVolume: '',
  shippedInternationally: null,
  approxExportOrders: '',
  exportCountries: '',
  sellingOnAmazon: '',
  otherPlatforms: [],
  gstRegistration: '',
  companyIncorporation: '',
  iecStatus: '',
  businessType: '',
  hearAboutUs: '',
  message: '',
  agreedToCommissionTerms: false,
}

export interface StepProps {
  data: ApplyWizardState
  patch: (fields: Partial<ApplyWizardState>) => void
}

/** Field id -> message. Ids match the DOM ids of the inputs so errors can be linked and focused. */
export type FieldErrors = Record<string, string>

export interface MarketplaceStepProps extends StepProps {
  errors: FieldErrors
}
