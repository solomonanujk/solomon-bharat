export type Role = 'SUPER_ADMIN' | 'SELLER' | 'BUYER';
export type UserStatus = 'ACTIVE' | 'SUSPENDED';

export interface SafeUser {
  id: string;
  email: string;
  role: Role;
  status: UserStatus;
  emailVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface SignupInput {
  email: string;
  password: string;
  contactName: string;
  country: string;
  companyName?: string;
  phone?: string;
}

export interface AuthResult {
  user: SafeUser;
  accessToken: string;
}
