import { useMutation } from '@tanstack/react-query';
import { paymentsService } from '../services/payments.service';
import { CheckoutInput } from '../types';

export function useCheckout() {
  return useMutation({
    mutationFn: (input: CheckoutInput) => paymentsService.checkout(input),
  });
}

export function useCapturePayment() {
  return useMutation({
    mutationFn: (paymentId: string) => paymentsService.capture(paymentId),
  });
}
