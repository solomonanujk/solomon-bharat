'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '@/lib/api'
import { getApiError } from '@/lib/getApiError'
import type { Order, OrderStatus, PaginatedResult, SellerOrderItem } from '@/types'

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

// ─── Buyer: own orders ─────────────────────────────────────────────────────────

export function useMyOrders(params?: { page?: number; limit?: number }) {
  return useQuery<PaginatedResult<Order>>({
    queryKey: ['my-orders', params],
    queryFn: async () => toPaginated<Order>(await api.get('/orders/me', { params })),
    staleTime: 60 * 1000,
  })
}

export function useMyOrder(id: string | null) {
  return useQuery<Order>({
    queryKey: ['my-order', id],
    queryFn: async () => (await api.get(`/orders/me/${id}`)).data.data,
    enabled: !!id,
  })
}

// ─── Seller: order items linked to their own products — never buyer identity ─

export function useSellerOrderItems(params?: { page?: number; limit?: number }) {
  return useQuery<PaginatedResult<SellerOrderItem>>({
    queryKey: ['seller-order-items', params],
    queryFn: async () => toPaginated<SellerOrderItem>(await api.get('/orders/seller/items', { params })),
    staleTime: 60 * 1000,
  })
}

// ─── Admin: full order lifecycle ──────────────────────────────────────────────

export function useAdminOrders(params?: { status?: OrderStatus; buyerId?: string; page?: number; limit?: number }) {
  return useQuery<PaginatedResult<Order>>({
    queryKey: ['admin-orders', params],
    queryFn: async () => toPaginated<Order>(await api.get('/orders/admin', { params })),
  })
}

export function useAdminOrder(id: string | null) {
  return useQuery<Order>({
    queryKey: ['admin-order', id],
    queryFn: async () => (await api.get(`/orders/admin/${id}`)).data.data,
    enabled: !!id,
  })
}

function invalidateOrder(qc: ReturnType<typeof useQueryClient>, id: string) {
  qc.invalidateQueries({ queryKey: ['admin-orders'] })
  qc.invalidateQueries({ queryKey: ['admin-order', id] })
}

function useAdminOrderAction<TBody = void>(action: string, successMessage: string) {
  const qc = useQueryClient()
  return useMutation<unknown, Error, { id: string; body?: TBody }>({
    mutationFn: ({ id, body }) => api.post(`/orders/admin/${id}/${action}`, body ?? {}),
    onSuccess: (_, vars) => {
      invalidateOrder(qc, vars.id)
      toast.success(successMessage)
    },
    onError: (err) => toast.error(getApiError(err)),
  })
}

export const useConfirmOrder = () => useAdminOrderAction('confirm', 'Order confirmed.')
export const useProcureOrder = () => useAdminOrderAction<{ expectedCollectionDate?: string }>('procure', 'Procurement started.')
export const useCollectOrder = () => useAdminOrderAction('collect', 'Goods marked as collected.')
export const useShipOrder = () => useAdminOrderAction<{ trackingNumber?: string }>('ship', 'Order marked in transit.')
export const useDeliverOrder = () => useAdminOrderAction('deliver', 'Order marked delivered.')
export const useCancelOrder = () => useAdminOrderAction<{ reason: string }>('cancel', 'Order cancelled.')

export function useUpdateTracking() {
  const qc = useQueryClient()
  return useMutation<unknown, Error, { id: string; trackingNumber: string }>({
    mutationFn: ({ id, trackingNumber }) => api.patch(`/orders/admin/${id}/tracking`, { trackingNumber }),
    onSuccess: (_, vars) => {
      invalidateOrder(qc, vars.id)
      toast.success('Tracking number updated.')
    },
    onError: (err) => toast.error(getApiError(err)),
  })
}

export function useAttachExportDocuments() {
  const qc = useQueryClient()
  return useMutation<unknown, Error, { id: string; documents: string[] }>({
    mutationFn: ({ id, documents }) => api.post(`/orders/admin/${id}/export-documents`, { documents }),
    onSuccess: (_, vars) => {
      invalidateOrder(qc, vars.id)
      toast.success('Export documents attached.')
    },
    onError: (err) => toast.error(getApiError(err)),
  })
}
