'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '@/lib/api'
import { getApiError } from '@/lib/getApiError'
import type { PaginatedResult } from '@/types'
import type {
  AdminBrand,
  AdminBrandListParams,
  AdminBrandUpdateInput,
  CommissionDefaults,
} from '@/types/brand-admin'

export function useAdminBrands(params: AdminBrandListParams) {
  return useQuery<PaginatedResult<AdminBrand>>({
    queryKey: ['admin-brands', params],
    queryFn: async () => {
      const res = await api.get('/brands/admin', { params })
      const items = (res.data.data ?? []) as AdminBrand[]
      const meta = res.data.meta ?? {}
      return {
        items,
        total: meta.total ?? items.length,
        page: meta.page ?? 1,
        limit: meta.limit ?? items.length,
        totalPages: meta.totalPages ?? 1,
      }
    },
    placeholderData: (prev) => prev,
  })
}

export function useUpdateAdminBrand() {
  const qc = useQueryClient()
  return useMutation<unknown, Error, { id: string; input: AdminBrandUpdateInput; successMessage?: string }>({
    mutationFn: async ({ id, input }) => (await api.patch(`/brands/admin/${id}`, input)).data.data,
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['admin-brands'] })
      qc.invalidateQueries({ queryKey: ['admin-products'] })
      toast.success(vars.successMessage ?? 'Brand updated')
    },
    onError: (err) => toast.error(getApiError(err)),
  })
}

export function useCommissionDefaults() {
  return useQuery<CommissionDefaults>({
    queryKey: ['admin-brand-commission-defaults'],
    queryFn: async () => (await api.get('/brands/admin/commission-defaults')).data.data,
  })
}

export function useUpdateCommissionDefaults() {
  const qc = useQueryClient()
  return useMutation<CommissionDefaults, Error, CommissionDefaults>({
    mutationFn: async (input) => (await api.put('/brands/admin/commission-defaults', input)).data.data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-brand-commission-defaults'] })
      qc.invalidateQueries({ queryKey: ['admin-brands'] })
      toast.success('Commission defaults updated')
    },
    onError: (err) => toast.error(getApiError(err)),
  })
}
