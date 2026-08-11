import { z } from 'zod';
import { paginationQuerySchema } from '../../utils/pagination';

export const updateBuyerProfileSchema = z.object({
  companyName: z.string().max(200).optional(),
  contactName: z.string().min(1).max(200).optional(),
  phone: z.string().max(30).optional(),
  country: z.string().min(1).max(100).optional(),
});
export type UpdateBuyerProfileDto = z.infer<typeof updateBuyerProfileSchema>;

export const createAddressSchema = z.object({
  label: z.string().max(100).optional(),
  line1: z.string().min(1).max(300),
  line2: z.string().max(300).optional(),
  city: z.string().min(1).max(150),
  state: z.string().max(150).optional(),
  postalCode: z.string().min(1).max(30),
  country: z.string().min(1).max(100),
  isDefault: z.boolean().optional(),
});
export type CreateAddressDto = z.infer<typeof createAddressSchema>;

export const updateAddressSchema = createAddressSchema.partial();
export type UpdateAddressDto = z.infer<typeof updateAddressSchema>;

export const addWishlistItemSchema = z.object({
  productId: z.string().uuid(),
});
export type AddWishlistItemDto = z.infer<typeof addWishlistItemSchema>;

export const sendMessageSchema = z.object({
  body: z.string().min(1).max(4000),
});
export type SendMessageDto = z.infer<typeof sendMessageSchema>;

export const idParamSchema = z.object({
  id: z.string().uuid(),
});

export const productIdParamSchema = z.object({
  productId: z.string().uuid(),
});

export const adminListQuerySchema = paginationQuerySchema;
export type AdminListQueryDto = z.infer<typeof adminListQuerySchema>;
