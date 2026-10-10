'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '@/lib/api'
import { getApiError } from '@/lib/getApiError'
import { useMySellerProfile } from '@/hooks/queries/useSellers'
import type { OrderStatus, PaginatedResult } from '@/types'
import type {
  BrandOrderView,
  BrandSalesStats,
  BrandShipInput,
  OwnBrand,
  UpdateOwnBrandInput,
} from '@/types/brand-portal'

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

/** Seller type of the signed-in seller. `ready` is false until the profile has loaded. */
export function useSellerType(): { isMarketplace: boolean; ready: boolean } {
  const { data, isLoading } = useMySellerProfile()
  return { isMarketplace: data?.sellerType === 'MARKETPLACE', ready: !isLoading }
}

// ─── Brand profile ────────────────────────────────────────────────────────────

export function useMyBrand(enabled = true) {
  return useQuery<OwnBrand>({
    queryKey: ['my-brand'],
    queryFn: async () => (await api.get('/brands/me')).data.data,
    enabled,
  })
}

export function useUpdateMyBrand() {
  const qc = useQueryClient()
  return useMutation<OwnBrand, Error, UpdateOwnBrandInput>({
    mutationFn: async (body) => (await api.patch('/brands/me', body)).data.data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-brand'] })
      qc.invalidateQueries({ queryKey: ['my-seller-profile'] })
      toast.success('Brand profile saved.')
    },
    onError: (err) => toast.error(getApiError(err)),
  })
}

/** Uploads only — returns the hosted URL, which must then be saved with PATCH /brands/me. */
export function useUploadBrandImage(kind: 'logo' | 'banner') {
  return useMutation<string, Error, File>({
    mutationFn: async (file) => {
      const fd = new FormData()
      fd.append('file', file)
      const res = await api.post(`/brands/me/${kind}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      return (res.data.data as { url: string }).url
    },
    onError: (err) => toast.error(getApiError(err)),
  })
}

export function useMyBrandStats(enabled = true) {
  return useQuery<BrandSalesStats>({
    queryKey: ['my-brand-stats'],
    queryFn: async () => (await api.get('/brands/me/stats')).data.data,
    enabled,
    staleTime: 60 * 1000,
  })
}

// ─── Brand orders ─────────────────────────────────────────────────────────────

export function useBrandOrders(params?: { status?: OrderStatus; page?: number; limit?: number }, enabled = true) {
  return useQuery<PaginatedResult<BrandOrderView>>({
    queryKey: ['brand-orders', params],
    queryFn: async () => toPaginated<BrandOrderView>(await api.get('/orders/brand', { params })),
    enabled,
  })
}

export function useBrandOrder(id: string | null) {
  return useQuery<BrandOrderView>({
    queryKey: ['brand-order', id],
    queryFn: async () => (await api.get(`/orders/brand/${id}`)).data.data,
    enabled: !!id,
  })
}

function useBrandOrderAction<V extends { id: string }>(
  path: (vars: V) => string,
  body: (vars: V) => unknown,
  successMessage: string,
) {
  const qc = useQueryClient()
  return useMutation<BrandOrderView, Error, V>({
    mutationFn: async (vars) => (await api.post(path(vars), body(vars))).data.data,
    onSuccess: (order, vars) => {
      qc.setQueryData(['brand-order', vars.id], order)
      qc.invalidateQueries({ queryKey: ['brand-orders'] })
      qc.invalidateQueries({ queryKey: ['my-brand-stats'] })
      qc.invalidateQueries({ queryKey: ['my-payouts'] })
      qc.invalidateQueries({ queryKey: ['my-payout-summary'] })
      toast.success(successMessage)
    },
    onError: (err) => toast.error(getApiError(err)),
  })
}

export function useConfirmBrandOrder() {
  return useBrandOrderAction<{ id: string }>((v) => `/orders/brand/${v.id}/confirm`, () => undefined, 'Order confirmed.')
}

export function useShipBrandOrder() {
  return useBrandOrderAction<{ id: string } & BrandShipInput>(
    (v) => `/orders/brand/${v.id}/ship`,
    (v) => ({ trackingNumber: v.trackingNumber, ...(v.carrier ? { carrier: v.carrier } : {}) }),
    'Order marked as shipped.',
  )
}

export function useDeliverBrandOrder() {
  return useBrandOrderAction<{ id: string }>((v) => `/orders/brand/${v.id}/deliver`, () => undefined, 'Order marked as delivered.')
}

// ─── Brand product publish state ──────────────────────────────────────────────

export function useSetMyProductPublished() {
  const qc = useQueryClient()
  return useMutation<unknown, Error, { id: string; publish: boolean }>({
    mutationFn: ({ id, publish }) => api.post(`/products/me/${id}/${publish ? 'publish' : 'unpublish'}`),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['my-products'] })
      qc.invalidateQueries({ queryKey: ['my-product', vars.id] })
      toast.success(vars.publish ? 'Product published.' : 'Product unpublished.')
    },
    onError: (err) => toast.error(getApiError(err)),
  })
}
