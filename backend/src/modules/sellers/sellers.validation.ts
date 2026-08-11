import { z } from 'zod';
import { SellerApplicationStatus } from '@prisma/client';
import { paginationQuerySchema } from '../../utils/pagination';

export const submitApplicationSchema = z.object({
  businessName: z.string().min(1).max(200),
  contactName: z.string().min(1).max(200),
  email: z.string().email(),
  phone: z.string().min(1).max(30),
  businessAddress: z.string().min(1).max(500),
  message: z.string().max(2000).optional(),
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
