import { apiClient } from '@/lib/axios';
import { ApiResponse } from '@/types/api';
import { CaptureResult, CheckoutInput, CheckoutResult } from '../types';

export const paymentsService = {
  async checkout(input: CheckoutInput): Promise<CheckoutResult> {
    const { data } = await apiClient.post<ApiResponse<CheckoutResult>>('/payments/checkout', input);
    return data.data;
  },

  async capture(paymentId: string): Promise<CaptureResult> {
    const { data } = await apiClient.post<ApiResponse<CaptureResult>>(`/payments/${paymentId}/capture`);
    return data.data;
  },
};
