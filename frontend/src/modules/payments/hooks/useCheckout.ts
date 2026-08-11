import { useMutation, useQueryClient } from '@tanstack/react-query';
import { paymentsService } from '../services/payments.service';
import { CheckoutInput } from '../types';

export function useCheckout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CheckoutInput) => paymentsService.checkout(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['orders', 'mine'] }),
  });
}

export function useCapturePayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (paymentId: string) => paymentsService.capture(paymentId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['orders', 'mine'] }),
  });
}
