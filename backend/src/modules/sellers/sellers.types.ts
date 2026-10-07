import { SellerApplicationStatus } from '@prisma/client';

export interface SubmitApplicationInput {
  businessName: string;
  contactName: string;
  email: string;
  phone: string;
  // Service-computed from city + country before this reaches the repository —
  // never sent directly by the client. See SellersService.submitApplication.
  businessAddress: string;
  message?: string;
  city: string;
  country: string;
  instagramHandle: string;
  instagramFollowers: number;
  websiteOrSocialLink?: string;
  craftCategories?: string[];
  productDescription?: string;
  giTaggedProducts?: string;
  monthlySalesVolume?: string;
  shippedInternationally?: boolean;
  approxExportOrders?: string;
  exportCountries?: string;
  sellingOnAmazon?: string;
  otherPlatforms?: string[];
  gstRegistration?: string;
  companyIncorporation?: string;
  iecStatus?: string;
  businessType: string;
  hearAboutUs?: string;
  agreedToCommissionTerms: boolean;
}

export interface UpdateSellerProfileInput {
  businessName?: string;
  contactName?: string;
  phone?: string;
  businessAddress?: string;
  bankDetails?: string;
  notificationPrefs?: Record<string, unknown>;
}

export interface ApplicationListFilter {
  status?: SellerApplicationStatus;
}

export { SellerApplicationStatus };
