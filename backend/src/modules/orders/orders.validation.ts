import { z } from 'zod';
import { OrderStatus } from '@prisma/client';
import { paginationQuerySchema } from '../../utils/pagination';

export const checkoutSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        quantity: z.coerce.number().int().min(1),
      }),
    )
    .min(1),
  shippingAddressId: z.string().uuid().optional(),
});
export type CheckoutDto = z.infer<typeof checkoutSchema>;

export const quoteSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        variantId: z.string().uuid().optional(),
        isSample: z.boolean().optional(),
        quantity: z.coerce.number().int().min(1),
      }),
    )
    .min(1)
    .max(100),
});
export type QuoteDto = z.infer<typeof quoteSchema>;

export const procureSchema = z.object({
  expectedCollectionDate: z.coerce.date().optional(),
});
export type ProcureDto = z.infer<typeof procureSchema>;

export const shipSchema = z.object({
  trackingNumber: z.string().min(1).max(200).optional(),
});
export type ShipDto = z.infer<typeof shipSchema>;

export const cancelOrderSchema = z.object({
  reason: z.string().min(1).max(1000),
});
export type CancelOrderDto = z.infer<typeof cancelOrderSchema>;

export const trackingSchema = z.object({
  trackingNumber: z.string().min(1).max(200),
});
export type TrackingDto = z.infer<typeof trackingSchema>;

export const exportDocumentsSchema = z.object({
  documents: z.array(z.string().url()).min(1),
});
export type ExportDocumentsDto = z.infer<typeof exportDocumentsSchema>;

export const adminOrderListQuerySchema = paginationQuerySchema.extend({
  status: z.nativeEnum(OrderStatus).optional(),
  buyerId: z.string().uuid().optional(),
});
export type AdminOrderListQueryDto = z.infer<typeof adminOrderListQuerySchema>;

export const idParamSchema = z.object({
  id: z.string().uuid(),
});

export const documentParamSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(['commercial-invoice', 'packing-list']),
});

export const buyerCancelSchema = z.object({
  reason: z.string().trim().max(1000).optional(),
});
export type BuyerCancelDto = z.infer<typeof buyerCancelSchema>;

export const refundSchema = z.object({
  reference: z.string().trim().min(1).max(200),
});
export type RefundDto = z.infer<typeof refundSchema>;
