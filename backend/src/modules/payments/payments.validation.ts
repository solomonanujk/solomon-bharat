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
});
export type CheckoutDto = z.infer<typeof checkoutSchema>;

export const idParamSchema = z.object({
  id: z.string().uuid(),
});

export const orderIdParamSchema = z.object({
  orderId: z.string().uuid(),
});
