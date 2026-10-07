import { z } from 'zod';

export const signupBuyerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  contactName: z.string().min(1).max(200),
  country: z.string().min(1).max(100),
  companyName: z.string().max(200).optional(),
  phone: z.string().max(30).optional(),
  // Faire-style onboarding wizard fields — all optional, collected progressively.
  businessType: z.string().max(50).optional(),
  businessOpenedYear: z.string().max(20).optional(),
  website: z.string().max(300).optional(),
  hearAboutUs: z.array(z.string().max(50)).max(20).optional(),
  marketingOptOut: z.boolean().optional(),
  preferredLanguage: z.string().max(50).optional(),
});
export type SignupBuyerDto = z.infer<typeof signupBuyerSchema>;

export const checkEmailQuerySchema = z.object({
  email: z.string().email(),
});
export type CheckEmailQueryDto = z.infer<typeof checkEmailQuerySchema>;

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginDto = z.infer<typeof loginSchema>;

export const verifyEmailQuerySchema = z.object({
  id: z.string().uuid(),
  token: z.string().min(1),
});
export type VerifyEmailQueryDto = z.infer<typeof verifyEmailQuerySchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});
export type ForgotPasswordDto = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  id: z.string().uuid(),
  token: z.string().min(1),
  password: z.string().min(8).max(128),
});
export type ResetPasswordDto = z.infer<typeof resetPasswordSchema>;
