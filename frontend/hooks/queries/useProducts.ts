'use client'

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '@/lib/api'
import { getApiError } from '@/lib/getApiError'
import type {
  AdminProduct,
  ApprovalStatus,
  MyProduct,
  PaginatedResult,
  Product,
  ProductPriceTier,
  ProductsParams,
  VariantAttribute,
  VariantStatus,
} from '@/types'

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

// ─── Public / buyer-facing ─────────────────────────────────────────────────────
// Every list call MUST carry categoryId or collectionId — the API 400s otherwise,
// even for a bare `search` term. There is no unscoped/global product listing.

export function useProducts(params: ProductsParams) {
  const scoped = !!(params.categoryId || params.collectionId)
  return useQuery<PaginatedResult<Product>>({
    queryKey: ['products', params],
    queryFn: async () => toPaginated<Product>(await api.get('/products', { params })),
    enabled: scoped,
    staleTime: 2 * 60 * 1000,
  })
}

/** Infinite-scroll variant — same scope rule (categoryId or collectionId required). */
export function useInfiniteProducts(params: Omit<ProductsParams, 'page'>) {
  const scoped = !!(params.categoryId || params.collectionId)
  return useInfiniteQuery<PaginatedResult<Product>>({
    queryKey: ['products', 'infinite', params],
    queryFn: async ({ pageParam }) =>
      toPaginated<Product>(await api.get('/products', { params: { ...params, page: pageParam } })),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => (lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined),
    enabled: scoped,
    staleTime: 2 * 60 * 1000,
  })
}

/**
 * Authenticated buyer's personalized feed — the one deliberate exception to the
 * "categoryId or collectionId required" scope rule (backend: GET /products/recommendations).
 */
export function useInfiniteRecommendations(enabled: boolean) {
  return useInfiniteQuery<PaginatedResult<Product>>({
    queryKey: ['products', 'recommendations'],
    queryFn: async ({ pageParam }) =>
      toPaginated<Product>(await api.get('/products/recommendations', { params: { page: pageParam, limit: 24 } })),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => (lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined),
    enabled,
    staleTime: 60 * 1000,
  })
}

/**
 * GET /products/:slug returns { product, related } — NOT the product's fields
 * flattened at the top level (same shape pattern as GET /collections/:slug).
 * Unwrap here so callers can treat the result as a normal Product plus related items.
 */
export function useProduct(slug: string | null) {
  return useQuery<Product & { related: Product[] }>({
    queryKey: ['product', slug],
    queryFn: async () => {
      const res = await api.get(`/products/${slug}`)
      const { product, related } = res.data.data
      return { ...product, related }
    },
    enabled: !!slug,
    staleTime: 2 * 60 * 1000,
  })
}

// ─── Agent: agent-priced browsing ──────────────────────────────────────────────
// GET /products/agent (+ /products/agent/:slug) mirror the public /products
// shape but come back with `agentPrice` populated for an authenticated AGENT
// session. Unlike the public list, browsing here is not scoped to a single
// category/collection (there is no per-category agent page), so these are
// always enabled.

export function useAgentProducts(params?: ProductsParams) {
  return useQuery<PaginatedResult<Product>>({
    queryKey: ['agent-products', params],
    queryFn: async () => toPaginated<Product>(await api.get('/products/agent', { params })),
    staleTime: 60 * 1000,
  })
}

/** Infinite-scroll variant used by the agent product browsing & catalogue-builder pages. */
export function useInfiniteAgentProducts(params: Omit<ProductsParams, 'page'>) {
  return useInfiniteQuery<PaginatedResult<Product>>({
    queryKey: ['agent-products', 'infinite', params],
    queryFn: async ({ pageParam }) =>
      toPaginated<Product>(await api.get('/products/agent', { params: { ...params, page: pageParam } })),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => (lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined),
    staleTime: 60 * 1000,
  })
}

/** Same { product, related } unwrap as useProduct — see comment there. */
export function useAgentProduct(slug: string | null) {
  return useQuery<Product & { related: Product[] }>({
    queryKey: ['agent-product', slug],
    queryFn: async () => {
      const res = await api.get(`/products/agent/${slug}`)
      const { product, related } = res.data.data
      return { ...product, related }
    },
    enabled: !!slug,
    staleTime: 2 * 60 * 1000,
  })
}

// ─── Seller: own products ──────────────────────────────────────────────────────

export function useMyProducts(params?: { approvalStatus?: ApprovalStatus; page?: number; limit?: number }) {
  return useQuery<PaginatedResult<MyProduct>>({
    queryKey: ['my-products', params],
    queryFn: async () => toPaginated<MyProduct>(await api.get('/products/me', { params })),
    staleTime: 60 * 1000,
  })
}

export function useMyProduct(id: string | null) {
  return useQuery<MyProduct>({
    queryKey: ['my-product', id],
    queryFn: async () => (await api.get(`/products/me/${id}`)).data.data,
    enabled: !!id,
  })
}

export interface SubmitVariantInput {
  type: string
  value: string
  sku?: string
  status?: VariantStatus
  imageUrl?: string
  attributes?: VariantAttribute[]
  priceTiers?: ProductPriceTier[]
}

export interface SubmitProductInput {
  name: string
  description: string
  categoryId: string
  materials: string
  dimensions?: string
  weight?: number
  moq: number
  declaredStock: number
  sellerPrice: number
  leadTime?: string
  variants?: SubmitVariantInput[]
  images: File[]
  tags?: string[]
  stepQty?: number
  isHandmade?: boolean
  placeOfOrigin?: string
  isGITagged?: boolean
  howItIsMade?: string
  artisanName?: string
  priceTiers?: ProductPriceTier[]
}

const JSON_FIELDS = new Set(['variants', 'tags', 'priceTiers'])

function toFormData(input: object): FormData {
  const fd = new FormData()
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || value === null) continue
    if (key === 'images' && Array.isArray(value)) {
      value.forEach((file) => fd.append('images', file as File))
    } else if (JSON_FIELDS.has(key)) {
      fd.append(key, JSON.stringify(value))
    } else {
      fd.append(key, String(value))
    }
  }
  return fd
}

export function usePolishField() {
  return useMutation<string, Error, { field: 'name' | 'description' | 'tags'; value: string }>({
    mutationFn: async ({ field, value }) => (await api.post('/products/ai/polish', { field, value })).data.data.cleaned,
    onError: (err) => toast.error(getApiError(err, 'AI polish failed — try again.')),
  })
}

export function useSubmitProduct() {
  const qc = useQueryClient()
  return useMutation<MyProduct, Error, SubmitProductInput>({
    mutationFn: async (input) => {
      const res = await api.post('/products', toFormData(input), {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return res.data.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-products'] })
      toast.success('Product submitted for review.')
    },
    onError: (err) => toast.error(getApiError(err)),
  })
}

export interface UpdateMyProductInput {
  id: string
  data: Partial<Omit<SubmitProductInput, 'images' | 'categoryId'>> & { removeImageIds?: string[]; images?: File[] }
}

export function useUpdateMyProduct() {
  const qc = useQueryClient()
  return useMutation<MyProduct, Error, UpdateMyProductInput>({
    mutationFn: async ({ id, data }) => {
      const res = await api.patch(`/products/me/${id}`, toFormData(data), {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return res.data.data
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['my-products'] })
      qc.invalidateQueries({ queryKey: ['my-product', vars.id] })
      toast.success('Product updated.')
    },
    onError: (err) => toast.error(getApiError(err)),
  })
}

export function useResubmitProduct() {
  const qc = useQueryClient()
  return useMutation<unknown, Error, string>({
    mutationFn: (id) => api.post(`/products/me/${id}/resubmit`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-products'] })
      toast.success('Product resubmitted for review.')
    },
    onError: (err) => toast.error(getApiError(err)),
  })
}

export function useDeleteMyProduct() {
  const qc = useQueryClient()
  return useMutation<unknown, Error, string>({
    mutationFn: (id) => api.delete(`/products/me/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-products'] })
      toast.success('Product removed.')
    },
    onError: (err) => toast.error(getApiError(err)),
  })
}

// ─── Admin: product review, pricing, publishing ───────────────────────────────

export function useAdminProducts(params?: { approvalStatus?: ApprovalStatus; sellerId?: string; categoryId?: string; page?: number; limit?: number }) {
  return useQuery<PaginatedResult<AdminProduct>>({
    queryKey: ['admin-products', params],
    queryFn: async () => toPaginated<AdminProduct>(await api.get('/products/admin', { params })),
  })
}

export function useAdminProduct(id: string | null) {
  return useQuery<AdminProduct>({
    queryKey: ['admin-product', id],
    queryFn: async () => (await api.get(`/products/admin/${id}`)).data.data,
    enabled: !!id,
  })
}

function invalidateProduct(qc: ReturnType<typeof useQueryClient>, id: string) {
  qc.invalidateQueries({ queryKey: ['admin-products'] })
  qc.invalidateQueries({ queryKey: ['admin-product', id] })
}

export interface TierAdminPriceInput {
  id: string
  adminPrice?: number
  agentPrice?: number
}

export interface TierAdminPricingPayload {
  id: string
  priceTiers?: TierAdminPriceInput[]
  variantPriceTiers?: TierAdminPriceInput[]
}

export function useApproveProduct() {
  const qc = useQueryClient()
  return useMutation<unknown, Error, TierAdminPricingPayload>({
    mutationFn: ({ id, priceTiers, variantPriceTiers }) =>
      api.post(`/products/admin/${id}/approve`, { priceTiers, variantPriceTiers }),
    onSuccess: (_, vars) => {
      invalidateProduct(qc, vars.id)
      toast.success('Product approved and published.')
    },
    onError: (err) => toast.error(getApiError(err)),
  })
}

export function useRejectProduct() {
  const qc = useQueryClient()
  return useMutation<unknown, Error, { id: string; reason: string }>({
    mutationFn: ({ id, reason }) => api.post(`/products/admin/${id}/reject`, { reason }),
    onSuccess: (_, vars) => {
      invalidateProduct(qc, vars.id)
      toast.success('Product rejected.')
    },
    onError: (err) => toast.error(getApiError(err)),
  })
}

export function useSetAdminPrice() {
  const qc = useQueryClient()
  return useMutation<unknown, Error, TierAdminPricingPayload>({
    mutationFn: ({ id, priceTiers, variantPriceTiers }) =>
      api.patch(`/products/admin/${id}/price`, { priceTiers, variantPriceTiers }),
    onSuccess: (_, vars) => {
      invalidateProduct(qc, vars.id)
      toast.success('Selling price updated.')
    },
    onError: (err) => toast.error(getApiError(err)),
  })
}

export function useReassignProductCategory() {
  const qc = useQueryClient()
  return useMutation<unknown, Error, { id: string; categoryId: string }>({
    mutationFn: ({ id, categoryId }) => api.patch(`/products/admin/${id}/category`, { categoryId }),
    onSuccess: (_, vars) => {
      invalidateProduct(qc, vars.id)
      toast.success('Category reassigned.')
    },
    onError: (err) => toast.error(getApiError(err)),
  })
}

function useAdminProductAction(action: 'publish' | 'unpublish' | 'feature' | 'unfeature', successMessage: string) {
  const qc = useQueryClient()
  return useMutation<unknown, Error, string>({
    mutationFn: (id) => api.post(`/products/admin/${id}/${action}`),
    onSuccess: (_, id) => {
      invalidateProduct(qc, id)
      toast.success(successMessage)
    },
    onError: (err) => toast.error(getApiError(err)),
  })
}

export const usePublishProduct = () => useAdminProductAction('publish', 'Product published.')
export const useUnpublishProduct = () => useAdminProductAction('unpublish', 'Product unpublished.')
export const useFeatureProduct = () => useAdminProductAction('feature', 'Product featured.')
export const useUnfeatureProduct = () => useAdminProductAction('unfeature', 'Product unfeatured.')
