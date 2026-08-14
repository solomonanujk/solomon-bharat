'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '@/lib/api'
import { getApiError } from '@/lib/getApiError'
import type { PaginatedResult, Payout, PayoutStatus, PayoutSummary } from '@/types'

function toPaginated<T>(res: { data: { data: unknown; meta?: { total?: number; page?: number; limit?: number; totalPages?: number } } }): PaginatedResult<T> {
  const items = (res.data.data ?? []) as T[]
  const meta = res.data.meta ?? {}
  return {
    items,
    total: meta.total ?? items.length,
    page: meta.page ?? 1,
    limit: meta.limit ?? items.length,
    totalPages: meta.totalPages ?? 1,
  }
}

// ─── Seller: own payouts ───────────────────────────────────────────────────────

export function useMyPayouts(params?: { status?: PayoutStatus; page?: number; limit?: number }) {
  return useQuery<PaginatedResult<Payout>>({
    queryKey: ['my-payouts', params],
    queryFn: async () => toPaginated<Payout>(await api.get('/payouts/me', { params })),
  })
}

export function useMyPayoutSummary() {
  return useQuery<PayoutSummary>({
    queryKey: ['my-payout-summary'],
    queryFn: async () => (await api.get('/payouts/me/summary')).data.data,
    staleTime: 60 * 1000,
  })
}

// ─── Admin: all payouts ────────────────────────────────────────────────────────

export function useAdminPayouts(params?: { status?: PayoutStatus; sellerId?: string; page?: number; limit?: number }) {
  return useQuery<PaginatedResult<Payout>>({
    queryKey: ['admin-payouts', params],
    queryFn: async () => toPaginated<Payout>(await api.get('/payouts/admin', { params })),
  })
}

export function useAdminPayout(id: string | null) {
  return useQuery<Payout>({
    queryKey: ['admin-payout', id],
    queryFn: async () => (await api.get(`/payouts/admin/${id}`)).data.data,
    enabled: !!id,
  })
}

export function useMarkPayoutPaid() {
  const qc = useQueryClient()
  return useMutation<unknown, Error, { id: string; notes?: string }>({
    mutationFn: ({ id, notes }) => api.post(`/payouts/admin/${id}/mark-paid`, { notes }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['admin-payouts'] })
      qc.invalidateQueries({ queryKey: ['admin-payout', vars.id] })
      toast.success('Payout marked as paid.')
    },
    onError: (err) => toast.error(getApiError(err)),
  })
}

export function useUpdatePayoutNotes() {
  const qc = useQueryClient()
  return useMutation<unknown, Error, { id: string; notes: string }>({
    mutationFn: ({ id, notes }) => api.patch(`/payouts/admin/${id}/notes`, { notes }),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['admin-payout', vars.id] }),
    onError: (err) => toast.error(getApiError(err)),
  })
}

/** No bulk endpoint exists server-side — this fires the single mark-paid mutation per id. */
export function useBulkMarkPayoutsPaid() {
  const qc = useQueryClient()
  return useMutation<unknown, Error, string[]>({
    mutationFn: async (ids) => {
      await Promise.all(ids.map((id) => api.post(`/payouts/admin/${id}/mark-paid`)))
    },
    onSuccess: (_, ids) => {
      qc.invalidateQueries({ queryKey: ['admin-payouts'] })
      toast.success(`${ids.length} payouts marked as paid.`)
    },
    onError: (err) => toast.error(getApiError(err)),
  })
}
