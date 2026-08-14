import { z } from 'zod';

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
  /** ISO 4217 code the buyer chose to pay in — the platform's own prices are always stored in INR. */
  currency: z
    .string()
    .length(3)
    .transform((v) => v.toUpperCase())
    .default('USD'),
});
export type CheckoutDto = z.infer<typeof checkoutSchema>;

export const fxRateQuerySchema = z.object({
  currency: z
    .string()
    .length(3)
    .transform((v) => v.toUpperCase()),
});
export type FxRateQueryDto = z.infer<typeof fxRateQuerySchema>;

export const idParamSchema = z.object({
  id: z.string().uuid(),
});

export const orderIdParamSchema = z.object({
  orderId: z.string().uuid(),
});
