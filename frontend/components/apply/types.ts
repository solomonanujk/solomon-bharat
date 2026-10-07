export interface ApplyWizardState {
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
