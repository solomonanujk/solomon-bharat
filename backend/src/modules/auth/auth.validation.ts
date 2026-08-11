import { z } from 'zod';

export const signupBuyerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  contactName: z.string().min(1).max(200),
  country: z.string().min(1).max(100),
  companyName: z.string().max(200).optional(),
  phone: z.string().max(30).optional(),
});
export type SignupBuyerDto = z.infer<typeof signupBuyerSchema>;

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
