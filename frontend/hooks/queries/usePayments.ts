'use client'

import { useMutation, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '@/lib/api'
import { getApiError } from '@/lib/getApiError'
import type { CheckoutItemInput, CheckoutResult, Invoice, Payment } from '@/types'

export function useCheckout() {
  return useMutation<CheckoutResult, Error, { items: CheckoutItemInput[]; shippingAddressId?: string; currency?: string }>({
    mutationFn: async (body) => (await api.post('/payments/checkout', body)).data.data,
    onError: (err) => toast.error(getApiError(err)),
  })
}

export function useCapturePayment() {
  return useMutation<{ payment: Payment; orderId: string; status: string }, Error, string>({
    mutationFn: async (paymentId) => (await api.post(`/payments/${paymentId}/capture`)).data.data,
    onError: (err) => toast.error(getApiError(err)),
  })
}

export function usePaymentStatus(paymentId: string | null) {
  return useQuery<Payment>({
    queryKey: ['payment', paymentId],
    queryFn: async () => (await api.get(`/payments/${paymentId}`)).data.data,
    enabled: !!paymentId,
    refetchInterval: (query) => (query.state.data?.status === 'PENDING' ? 3000 : false),
  })
}

export function useInvoice(orderId: string | null) {
  return useQuery<Invoice>({
    queryKey: ['invoice', orderId],
    queryFn: async () => (await api.get(`/payments/orders/${orderId}/invoice`)).data.data,
    enabled: !!orderId,
  })
}

/**
 * Server-authoritative INR→currency rate, consulted right before checkout so the
 * buyer sees the exact rate about to be charged. Browse-time display conversion
 * uses the separate Next.js /api/fx-rates proxy (see lib/store/useCurrencyStore) —
 * this endpoint exists so the checkout total matches what PayPal will actually charge.
 */
export function useCheckoutFxRate(currency: string) {
  return useQuery<{ base: string; currency: string; rate: number; date: string }>({
    queryKey: ['checkout-fx-rate', currency],
    queryFn: async () => (await api.get('/payments/fx-rates', { params: { currency } })).data.data,
    enabled: !!currency && currency !== 'INR',
    staleTime: 5 * 60 * 1000,
  })
}
