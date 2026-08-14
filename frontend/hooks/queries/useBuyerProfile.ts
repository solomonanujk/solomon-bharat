'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '@/lib/api'
import { getApiError } from '@/lib/getApiError'
import type { BuyerProfile, PaginatedResult } from '@/types'

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

export function useBuyerProfile() {
  return useQuery<BuyerProfile>({
    queryKey: ['buyer-profile'],
    queryFn: async () => (await api.get('/buyers/me')).data.data,
    staleTime: 5 * 60 * 1000,
  })
}

export type UpdateBuyerProfileInput = Partial<Pick<BuyerProfile, 'companyName' | 'contactName' | 'phone' | 'country'>>

export function useUpdateBuyerProfile() {
  const queryClient = useQueryClient()

  return useMutation<BuyerProfile, Error, UpdateBuyerProfileInput>({
    mutationFn: async (body) => (await api.patch('/buyers/me', body)).data.data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['buyer-profile'] })
      toast.success('Profile updated successfully.')
    },
    onError: (err) => toast.error(getApiError(err)),
  })
}

// ─── Admin: buyers directory ───────────────────────────────────────────────────

export function useAdminBuyers(params?: { page?: number; limit?: number }) {
  return useQuery<PaginatedResult<BuyerProfile>>({
    queryKey: ['admin-buyers', params],
    queryFn: async () => toPaginated<BuyerProfile>(await api.get('/buyers/admin', { params })),
  })
}

export function useAdminBuyer(id: string | null) {
  return useQuery<BuyerProfile>({
    queryKey: ['admin-buyer', id],
    queryFn: async () => (await api.get(`/buyers/admin/${id}`)).data.data,
    enabled: !!id,
  })
}
