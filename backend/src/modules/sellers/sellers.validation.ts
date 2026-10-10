import { z } from 'zod';
import { SellerApplicationStatus, SellerType } from '@prisma/client';
import { paginationQuerySchema } from '../../utils/pagination';
import {
  AMAZON_SELLING_OPTIONS,
  BUSINESS_TYPE_OPTIONS,
  COMPANY_INCORPORATION_OPTIONS,
  CRAFT_CATEGORIES,
  EXPORT_ORDER_RANGE_OPTIONS,
  GI_TAGGED_OPTIONS,
  GST_REGISTRATION_OPTIONS,
  HEAR_ABOUT_US_OPTIONS,
  IEC_STATUS_OPTIONS,
  MONTHLY_SALES_VOLUME_OPTIONS,
  OTHER_PLATFORM_OPTIONS,
} from './sellerApplicationOptions.constants';

// businessAddress is deliberately absent — the wizard only collects city +
// country; the service synthesizes businessAddress from those before calling
// the repository (see SellersService.submitApplication).
const submitApplicationBaseSchema = z.object({
  // Chosen on the first onboarding step. Existing clients omit it => CURATED.
  sellerType: z.nativeEnum(SellerType).default(SellerType.CURATED),
  businessName: z.string().min(1).max(200),
  contactName: z.string().min(1).max(200),
  email: z.string().email(),
  phone: z.string().min(1).max(30),
  message: z.string().max(2000).optional(),
  // Brand step
  city: z.string().min(1).max(200),
  country: z.string().min(1).max(100),
  // Required for CURATED, optional for MARKETPLACE (enforced in superRefine below).
  instagramHandle: z.string().min(1).max(100).optional(),
  instagramFollowers: z.coerce.number().int().min(0).optional(),
  websiteOrSocialLink: z.string().max(500).optional(),
  // Products step — nothing here is required (no asterisk in the reference design)
  craftCategories: z.array(z.enum(CRAFT_CATEGORIES)).optional(),
  productDescription: z.string().max(2000).optional(),
  giTaggedProducts: z.enum(GI_TAGGED_OPTIONS).optional(),
  monthlySalesVolume: z.enum(MONTHLY_SALES_VOLUME_OPTIONS).optional(),
  // Export readiness step — also all optional
  shippedInternationally: z.boolean().optional(),
  approxExportOrders: z.enum(EXPORT_ORDER_RANGE_OPTIONS).optional(),
  exportCountries: z.string().max(300).optional(),
  sellingOnAmazon: z.enum(AMAZON_SELLING_OPTIONS).optional(),
  otherPlatforms: z.array(z.enum(OTHER_PLATFORM_OPTIONS)).optional(),
  gstRegistration: z.enum(GST_REGISTRATION_OPTIONS).optional(),
  companyIncorporation: z.enum(COMPANY_INCORPORATION_OPTIONS).optional(),
  iecStatus: z.enum(IEC_STATUS_OPTIONS).optional(),
  // Final details step
  businessType: z.enum(BUSINESS_TYPE_OPTIONS),
  hearAboutUs: z.enum(HEAR_ABOUT_US_OPTIONS).optional(),
  agreedToCommissionTerms: z.literal(true),
  // Marketplace brand answers — required when sellerType = MARKETPLACE.
  brandName: z.string().trim().min(2).max(60).optional(),
  brandStory: z.string().max(1000).optional(),
  brandLogoUrl: z.string().url().max(500).optional(),
  brandBannerUrl: z.string().url().max(500).optional(),
  brandWebsite: z.string().max(500).optional(),
  minOrderValueInr: z.coerce.number().min(0).max(100000000).optional(),
  commissionTermsVersion: z.string().min(1).max(50).optional(),
});

export const submitApplicationSchema = submitApplicationBaseSchema.superRefine((value, ctx) => {
  if (value.sellerType === SellerType.MARKETPLACE) {
    if (!value.brandName) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['brandName'], message: 'Brand name is required' });
    }
    if (value.minOrderValueInr === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['minOrderValueInr'],
        message: 'Minimum order value is required',
      });
    }
    if (!value.commissionTermsVersion) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['commissionTermsVersion'],
        message: 'Commission terms version is required',
      });
    }
    return;
  }
  if (!value.instagramHandle) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['instagramHandle'], message: 'Required' });
  }
  if (value.instagramFollowers === undefined) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['instagramFollowers'], message: 'Required' });
  }
});
export type SubmitApplicationDto = z.infer<typeof submitApplicationSchema>;

export const applicationListQuerySchema = paginationQuerySchema.extend({
  status: z.nativeEnum(SellerApplicationStatus).optional(),
});
export type ApplicationListQueryDto = z.infer<typeof applicationListQuerySchema>;

export const rejectApplicationSchema = z.object({
  reason: z.string().min(1).max(1000),
});
export type RejectApplicationDto = z.infer<typeof rejectApplicationSchema>;

export const requestMoreInfoSchema = z.object({
  message: z.string().min(1).max(1000),
});
export type RequestMoreInfoDto = z.infer<typeof requestMoreInfoSchema>;

export const addNoteSchema = z.object({
  note: z.string().min(1).max(1000),
});
export type AddNoteDto = z.infer<typeof addNoteSchema>;

export const updateSellerProfileSchema = z.object({
  businessName: z.string().min(1).max(200).optional(),
  contactName: z.string().min(1).max(200).optional(),
  phone: z.string().min(1).max(30).optional(),
  businessAddress: z.string().min(1).max(500).optional(),
  bankDetails: z.string().max(1000).optional(),
  notificationPrefs: z.record(z.unknown()).optional(),
});
export type UpdateSellerProfileDto = z.infer<typeof updateSellerProfileSchema>;

export const idParamSchema = z.object({
  id: z.string().uuid(),
});
