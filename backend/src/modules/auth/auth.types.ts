import { SellerType } from '@prisma/client';
import { SafeUser } from '../../utils/safeUser';
import { BrandSummaryDto } from '../../utils/brandSummary';

export type { SafeUser };

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  csrfToken: string;
}

export interface SignupBuyerInput {
  email: string;
  password: string;
  contactName: string;
  country: string;
  companyName?: string;
  phone?: string;
  businessType?: string;
  businessOpenedYear?: string;
  website?: string;
  hearAboutUs?: string[];
  marketingOptOut?: boolean;
  preferredLanguage?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

/** SafeUser plus, for SELLER accounts, the seller type and (marketplace) brand summary. */
export interface SessionUser extends SafeUser {
  sellerType?: SellerType;
  brand?: BrandSummaryDto | null;
}

export interface AuthResult {
  user: SessionUser;
  tokens: TokenPair;
}
