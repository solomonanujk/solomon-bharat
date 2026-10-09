'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '@/lib/api'
import { getApiError } from '@/lib/getApiError'
import type { BrandFacet, BrandListItem, PaginatedResult, PublicBrand } from '@/types'

interface BrandListParams {
  search?: string
  page?: number
  limit?: number
}

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

/** Public brand storefront. 404 (unknown or suspended) surfaces as a query error. */
export function useBrand(slug: string | null | undefined, enabled = true) {
  return useQuery<PublicBrand>({
    queryKey: ['brand', slug],
    queryFn: async () => (await api.get(`/brands/${slug}`)).data.data,
    enabled: !!slug && enabled,
    staleTime: 2 * 60 * 1000,
    retry: false,
  })
}

export function useBrands(params: BrandListParams = {}) {
  return useQuery<PaginatedResult<BrandListItem>>({
    queryKey: ['brands', params],
    queryFn: async () => toPaginated<BrandListItem>(await api.get('/brands', { params })),
    staleTime: 2 * 60 * 1000,
  })
}

/** Active brands with their published product count — powers the catalogue Brand filter. */
export function useBrandFacets() {
  return useQuery<BrandFacet[]>({
    queryKey: ['products', 'facets', 'brands'],
    queryFn: async () => (await api.get('/products/facets/brands')).data.data ?? [],
    staleTime: 15 * 60 * 1000,
  })
}

export function useFollowedBrands(enabled = true) {
  return useQuery<PaginatedResult<BrandListItem>>({
    queryKey: ['brands', 'following'],
    queryFn: async () => toPaginated<BrandListItem>(await api.get('/brands/following', { params: { limit: 50 } })),
    enabled,
    staleTime: 60 * 1000,
  })
}

function useFollowToggle(follow: boolean) {
  const qc = useQueryClient()
  return useMutation<unknown, Error, string>({
    mutationFn: (slug) => (follow ? api.post(`/brands/${slug}/follow`) : api.delete(`/brands/${slug}/follow`)),
    onSuccess: (_, slug) => {
      qc.invalidateQueries({ queryKey: ['brand', slug] })
      qc.invalidateQueries({ queryKey: ['brands', 'following'] })
      toast.success(follow ? 'You are now following this brand.' : 'Brand unfollowed.')
    },
    onError: (err) => toast.error(getApiError(err)),
  })
}

export const useFollowBrand = () => useFollowToggle(true)
export const useUnfollowBrand = () => useFollowToggle(false)
