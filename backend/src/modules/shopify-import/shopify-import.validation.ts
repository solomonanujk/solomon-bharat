import { z } from 'zod';

export const connectShopifySchema = z.object({
  shopDomain: z
    .string()
    .min(1)
    .refine((v) => v.endsWith('.myshopify.com'), 'Shop domain must end in .myshopify.com'),
  accessToken: z.string().min(1),
});
export type ConnectShopifyDto = z.infer<typeof connectShopifySchema>;

export const listShopifyProductsQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type ListShopifyProductsQueryDto = z.infer<typeof listShopifyProductsQuerySchema>;

export const importShopifyProductsSchema = z.object({
  shopifyProductIds: z.array(z.string().min(1)).min(1).max(25),
  categoryId: z.string().uuid(),
});
export type ImportShopifyProductsDto = z.infer<typeof importShopifyProductsSchema>;

export const toggleShopifySyncSchema = z.object({
  syncEnabled: z.boolean(),
});
export type ToggleShopifySyncDto = z.infer<typeof toggleShopifySyncSchema>;

export const sellerIdParamSchema = z.object({
  sellerId: z.string().uuid(),
});
export type SellerIdParamDto = z.infer<typeof sellerIdParamSchema>;
