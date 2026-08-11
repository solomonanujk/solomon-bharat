import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiClient } from '@/lib/axios';
import { paymentsService } from './payments.service';

vi.mock('@/lib/axios', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

describe('paymentsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('checkout posts cart items and shipping address', async () => {
    const checkoutResult = { orderId: 'o1', paymentId: 'pay1', approveUrl: null, adminPriceTotal: '100.00' };
    vi.mocked(apiClient.post).mockResolvedValue({ data: { data: checkoutResult } });

    const input = { items: [{ productId: 'p1', quantity: 5 }], shippingAddressId: 'addr-1' };
    const result = await paymentsService.checkout(input);

    expect(apiClient.post).toHaveBeenCalledWith('/payments/checkout', input);
    expect(result).toEqual(checkoutResult);
  });

  it('capture posts to the capture endpoint for a payment id', async () => {
    const captureResult = {
      payment: { id: 'pay1', orderId: 'o1', status: 'COMPLETED' },
      orderId: 'o1',
      status: 'COMPLETED',
    };
    vi.mocked(apiClient.post).mockResolvedValue({ data: { data: captureResult } });

    const result = await paymentsService.capture('pay1');

    expect(apiClient.post).toHaveBeenCalledWith('/payments/pay1/capture');
    expect(result).toEqual(captureResult);
  });
});
