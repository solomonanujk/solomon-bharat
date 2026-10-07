import { SafeUser } from '../../utils/safeUser';

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

export interface AuthResult {
  user: SafeUser;
  tokens: TokenPair;
}
