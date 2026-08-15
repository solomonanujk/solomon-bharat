'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '@/lib/api'
import { getApiError } from '@/lib/getApiError'
import type { Collection, CollectionStatus, PaginatedResult, Product } from '@/types'

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

// ─── Public ────────────────────────────────────────────────────────────────────

export function useCollections(params?: { page?: number; limit?: number }) {
  return useQuery<PaginatedResult<Collection>>({
    queryKey: ['collections', params],
    queryFn: async () => toPaginated<Collection>(await api.get('/collections', { params })),
    staleTime: 5 * 60 * 1000,
  })
}

/** Homepage-featured collections — this is the closest thing to a CMS "hero content" endpoint. */
export function useFeaturedCollections() {
  return useQuery<Collection[]>({
    queryKey: ['collections', 'featured'],
    queryFn: async () => (await api.get('/collections/featured')).data.data ?? [],
    staleTime: 5 * 60 * 1000,
  })
}

export interface CollectionDetail extends Collection {
  products: Product[]
  total: number
  related: Collection[]
}

/**
 * GET /collections/:slug returns { collection, products, total, related } —
 * NOT the collection's fields flattened at the top level. Unwrap here so
 * callers can treat the result as a normal Collection plus its product page.
 */
export function useCollection(slug: string | null, params?: { page?: number; limit?: number }) {
  return useQuery<CollectionDetail>({
    queryKey: ['collection', slug, params],
    queryFn: async () => {
      const res = await api.get(`/collections/${slug}`, { params })
      const { collection, products, total, related } = res.data.data
      return { ...collection, products, total, related }
    },
    enabled: !!slug,
    staleTime: 2 * 60 * 1000,
  })
}

// ─── Admin management ─────────────────────────────────────────────────────────

export function useAdminCollections(params?: { status?: CollectionStatus; page?: number; limit?: number }) {
  return useQuery<PaginatedResult<Collection>>({
    queryKey: ['admin-collections', params],
    queryFn: async () => toPaginated<Collection>(await api.get('/collections/admin', { params })),
  })
}

export function useAdminCollection(id: string | null) {
  return useQuery<Collection>({
    queryKey: ['admin-collection', id],
    queryFn: async () => (await api.get(`/collections/admin/${id}`)).data.data,
    enabled: !!id,
  })
}

function invalidateCollection(qc: ReturnType<typeof useQueryClient>, id?: string) {
  qc.invalidateQueries({ queryKey: ['admin-collections'] })
  qc.invalidateQueries({ queryKey: ['collections'] })
  if (id) qc.invalidateQueries({ queryKey: ['admin-collection', id] })
}

export interface CreateCollectionInput {
  name: string
  heroImage?: File
  editorialIntro?: string
  isFeatured?: boolean
  status?: CollectionStatus
  publishAt?: string
}

function toFormData(input: object): FormData {
  const fd = new FormData()
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || value === null) continue
    fd.append(key, value instanceof File ? value : String(value))
  }
  return fd
}

export function useCreateCollection() {
  const qc = useQueryClient()
  return useMutation<Collection, Error, CreateCollectionInput>({
    mutationFn: async (body) =>
      (await api.post('/collections', toFormData(body), { headers: { 'Content-Type': 'multipart/form-data' } })).data.data,
    onSuccess: () => {
      invalidateCollection(qc)
      toast.success('Collection created.')
    },
    onError: (err) => toast.error(getApiError(err)),
  })
}

export interface UpdateCollectionInput extends Partial<Omit<CreateCollectionInput, 'heroImage'>> {
  slug?: string
  heroImage?: File
  /** Clears the hero image without uploading a replacement. */
  removeHeroImage?: boolean
}

export function useUpdateCollection() {
  const qc = useQueryClient()
  return useMutation<Collection, Error, { id: string; data: UpdateCollectionInput }>({
    mutationFn: async ({ id, data }) =>
      (await api.patch(`/collections/${id}`, toFormData(data), { headers: { 'Content-Type': 'multipart/form-data' } })).data.data,
    onSuccess: (_, vars) => {
      invalidateCollection(qc, vars.id)
      toast.success('Collection updated.')
    },
    onError: (err) => toast.error(getApiError(err)),
  })
}

function useAdminCollectionAction(action: 'publish' | 'unpublish' | 'archive' | 'feature' | 'unfeature', successMessage: string) {
  const qc = useQueryClient()
  return useMutation<unknown, Error, string>({
    mutationFn: (id) => api.post(`/collections/${id}/${action}`),
    onSuccess: (_, id) => {
      invalidateCollection(qc, id)
      toast.success(successMessage)
    },
    onError: (err) => toast.error(getApiError(err)),
  })
}

export const usePublishCollection = () => useAdminCollectionAction('publish', 'Collection published.')
export const useUnpublishCollection = () => useAdminCollectionAction('unpublish', 'Collection moved back to draft.')
export const useArchiveCollection = () => useAdminCollectionAction('archive', 'Collection archived.')
export const useFeatureCollection = () => useAdminCollectionAction('feature', 'Collection featured on homepage.')
export const useUnfeatureCollection = () => useAdminCollectionAction('unfeature', 'Collection unfeatured.')

export function useAddProductToCollection() {
  const qc = useQueryClient()
  return useMutation<unknown, Error, { collectionId: string; productId: string; sortOrder?: number }>({
    mutationFn: ({ collectionId, productId, sortOrder }) =>
      api.post(`/collections/${collectionId}/products`, { productId, sortOrder }),
    onSuccess: (_, vars) => {
      invalidateCollection(qc, vars.collectionId)
      toast.success('Product added to collection.')
    },
    onError: (err) => toast.error(getApiError(err)),
  })
}

export function useReorderCollectionProducts() {
  const qc = useQueryClient()
  return useMutation<unknown, Error, { collectionId: string; order: { productId: string; sortOrder: number }[] }>({
    mutationFn: ({ collectionId, order }) => api.patch(`/collections/${collectionId}/products/reorder`, order),
    onSuccess: (_, vars) => invalidateCollection(qc, vars.collectionId),
    onError: (err) => toast.error(getApiError(err)),
  })
}

export function useRemoveProductFromCollection() {
  const qc = useQueryClient()
  return useMutation<unknown, Error, { collectionId: string; productId: string }>({
    mutationFn: ({ collectionId, productId }) =>
      api.delete(`/collections/${collectionId}/products/${productId}`),
    onSuccess: (_, vars) => {
      invalidateCollection(qc, vars.collectionId)
      toast.success('Product removed from collection.')
    },
    onError: (err) => toast.error(getApiError(err)),
  })
}
