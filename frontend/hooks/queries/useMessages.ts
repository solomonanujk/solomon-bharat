'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '@/lib/api'
import { getApiError } from '@/lib/getApiError'
import type { BuyerMessage } from '@/types'

// Messages are buyer ↔ Solomon Bharat admin only — never buyer-to-seller or
// seller-to-anyone. A buyer has exactly one conversation (with admin), so
// there's no conversation list on the buyer side, unlike solomon-bharat2's
// buyer↔brand inbox.

export function useMyMessages() {
  return useQuery<BuyerMessage[]>({
    queryKey: ['my-messages'],
    queryFn: async () => (await api.get('/buyers/me/messages')).data.data ?? [],
    staleTime: 10 * 1000,
    refetchInterval: 15 * 1000,
  })
}

export function useSendMyMessage() {
  const qc = useQueryClient()
  return useMutation<BuyerMessage, Error, string>({
    mutationFn: async (body) => (await api.post('/buyers/me/messages', { body })).data.data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-messages'] }),
    onError: (err) => toast.error(getApiError(err)),
  })
}

// ─── Admin: view/reply to a specific buyer's conversation ────────────────────

export function useBuyerMessages(buyerId: string | null) {
  return useQuery<BuyerMessage[]>({
    queryKey: ['buyer-messages', buyerId],
    queryFn: async () => (await api.get(`/buyers/admin/${buyerId}/messages`)).data.data ?? [],
    enabled: !!buyerId,
    staleTime: 10 * 1000,
    refetchInterval: 15 * 1000,
  })
}

export function useSendAdminMessage() {
  const qc = useQueryClient()
  return useMutation<BuyerMessage, Error, { buyerId: string; body: string }>({
    mutationFn: async ({ buyerId, body }) =>
      (await api.post(`/buyers/admin/${buyerId}/messages`, { body })).data.data,
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['buyer-messages', vars.buyerId] }),
    onError: (err) => toast.error(getApiError(err)),
  })
}
