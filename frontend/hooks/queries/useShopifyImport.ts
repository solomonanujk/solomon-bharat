'use client'

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '@/lib/api'
import { getApiError } from '@/lib/getApiError'

// ─── Shopify product import — seller self-service and admin on-behalf-of ──────
// `basePath` lets the same hooks drive both /sellers/me/shopify (self-service)
// and /admin/sellers/:sellerId/shopify (admin) — undefined sellerId means the
// former, a given sellerId means the latter. Mirrors ShopifyProductPicker's
// own sellerIdOverride prop.

export interface ShopifyConnectionStatus {
  connected: boolean
  shopDomain?: string
  syncEnabled?: boolean
  lastSyncedAt?: string | null
  lastSyncError?: string | null
}

export interface ShopifyProductPreview {
  shopifyProductId: string
  title: string
  thumbnail: string | null
  variantCount: number
  minPrice: number
  maxPrice: number
}

export interface ConnectShopifyInput {
  shopDomain: string
  accessToken: string
}

export interface ImportShopifyProductsInput {
  shopifyProductIds: string[]
  categoryId: string
}

export interface ShopifyImportResult {
  imported: { shopifyProductId: string; productId: string }[]
  failed: { shopifyProductId: string; reason: string }[]
}

function basePath(sellerId?: string): string {
  return sellerId ? `/admin/sellers/${sellerId}/shopify` : '/sellers/me/shopify'
}

export function useShopifyConnectionStatus(sellerId?: string) {
  return useQuery<ShopifyConnectionStatus>({
    queryKey: ['shopify-connection', sellerId ?? 'me'],
    queryFn: async () => (await api.get(`${basePath(sellerId)}/connection`)).data.data,
  })
}

export function useConnectShopify(sellerId?: string) {
  const qc = useQueryClient()
  return useMutation<ShopifyConnectionStatus, Error, ConnectShopifyInput>({
    mutationFn: async (body) => (await api.post(`${basePath(sellerId)}/connect`, body)).data.data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shopify-connection', sellerId ?? 'me'] })
      toast.success('Shopify store connected.')
    },
    onError: (err) => toast.error(getApiError(err, 'Could not connect — check your shop domain and access token.')),
  })
}

export function useDisconnectShopify(sellerId?: string) {
  const qc = useQueryClient()
  return useMutation<unknown, Error, void>({
    mutationFn: () => api.delete(`${basePath(sellerId)}/connection`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shopify-connection', sellerId ?? 'me'] })
      toast.success('Shopify store disconnected.')
    },
    onError: (err) => toast.error(getApiError(err)),
  })
}

export function useToggleShopifySync(sellerId?: string) {
  const qc = useQueryClient()
  return useMutation<ShopifyConnectionStatus, Error, boolean>({
    mutationFn: async (syncEnabled) =>
      (await api.patch(`${basePath(sellerId)}/connection`, { syncEnabled })).data.data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shopify-connection', sellerId ?? 'me'] }),
    onError: (err) => toast.error(getApiError(err)),
  })
}

export function useSyncShopifyNow(sellerId?: string) {
  const qc = useQueryClient()
  return useMutation<unknown, Error, void>({
    mutationFn: () => api.post(`${basePath(sellerId)}/sync`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shopify-connection', sellerId ?? 'me'] })
      toast.success('Sync started — this can take a few minutes.')
    },
    onError: (err) => toast.error(getApiError(err)),
  })
}

const PRODUCTS_PAGE_LIMIT = 20

export function useShopifyProducts(sellerId?: string, enabled = true) {
  return useInfiniteQuery<{ items: ShopifyProductPreview[]; nextCursor: string | null }>({
    queryKey: ['shopify-products', sellerId ?? 'me'],
    queryFn: async ({ pageParam }) => {
      const res = await api.get(`${basePath(sellerId)}/products`, {
        params: { limit: PRODUCTS_PAGE_LIMIT, cursor: pageParam || undefined },
      })
      return { items: res.data.data as ShopifyProductPreview[], nextCursor: res.data.meta?.nextCursor ?? null }
    },
    initialPageParam: '',
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled,
  })
}

export function useImportShopifyProducts(sellerId?: string) {
  const qc = useQueryClient()
  return useMutation<ShopifyImportResult, Error, ImportShopifyProductsInput>({
    mutationFn: async (body) => (await api.post(`${basePath(sellerId)}/import`, body)).data.data,
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: sellerId ? ['admin-products'] : ['my-products'] })
      if (result.failed.length === 0) {
        toast.success(`Imported ${result.imported.length} product${result.imported.length === 1 ? '' : 's'}.`)
      } else {
        toast.warning(`Imported ${result.imported.length}, ${result.failed.length} failed — see details below.`)
      }
    },
    onError: (err) => toast.error(getApiError(err)),
  })
}
