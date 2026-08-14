'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '@/lib/api'
import { getApiError } from '@/lib/getApiError'
import type { Category, CategoryDetail, CategoryNode } from '@/types'

/** Public active 3-level tree with productCount per node — for NavBar + Categories listing. */
export function useCategoryTree() {
  return useQuery<CategoryNode[]>({
    queryKey: ['categories', 'tree'],
    queryFn: async () => {
      const res = await api.get('/categories')
      return res.data.data ?? []
    },
    staleTime: 15 * 60 * 1000,
  })
}

/** Category detail (any level) + breadcrumb + children — for Category Detail pages. */
export function useCategory(slug: string | null) {
  return useQuery<CategoryDetail>({
    queryKey: ['category', slug],
    queryFn: async () => {
      const res = await api.get(`/categories/${slug}`)
      return res.data.data
    },
    enabled: !!slug,
    staleTime: 5 * 60 * 1000,
  })
}

// ─── Admin category management ────────────────────────────────────────────────

export function useAdminCategoryTree() {
  return useQuery<CategoryNode[]>({
    queryKey: ['admin-category-tree'],
    queryFn: async () => {
      const res = await api.get('/categories/admin/tree')
      return res.data.data ?? []
    },
  })
}

export interface CreateCategoryInput {
  name: string
  level: 1 | 2 | 3
  parentId?: string
  description?: string
  heroImage?: string
  sortOrder?: number
}

export function useCreateCategory() {
  const qc = useQueryClient()
  return useMutation<Category, Error, CreateCategoryInput>({
    mutationFn: async (body) => (await api.post('/categories', body)).data.data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-category-tree'] })
      toast.success('Category created.')
    },
    onError: (err) => toast.error(getApiError(err)),
  })
}

export function useUpdateCategory() {
  const qc = useQueryClient()
  return useMutation<Category, Error, { id: string; data: Partial<CreateCategoryInput & { slug: string }> }>({
    mutationFn: async ({ id, data }) => (await api.patch(`/categories/${id}`, data)).data.data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-category-tree'] })
      toast.success('Category updated.')
    },
    onError: (err) => toast.error(getApiError(err)),
  })
}

export function useReorderCategories() {
  const qc = useQueryClient()
  return useMutation<unknown, Error, { id: string; sortOrder: number }[]>({
    mutationFn: (body) => api.patch('/categories/reorder', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-category-tree'] }),
    onError: (err) => toast.error(getApiError(err)),
  })
}

export function useArchiveCategory() {
  const qc = useQueryClient()
  return useMutation<unknown, Error, string>({
    mutationFn: (id) => api.post(`/categories/${id}/archive`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-category-tree'] })
      toast.success('Category archived.')
    },
    onError: (err) =>
      toast.error(getApiError(err, 'Cannot archive — active products are still assigned to this category.')),
  })
}

export function useRestoreCategory() {
  const qc = useQueryClient()
  return useMutation<unknown, Error, string>({
    mutationFn: (id) => api.post(`/categories/${id}/restore`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-category-tree'] })
      toast.success('Category restored.')
    },
    onError: (err) => toast.error(getApiError(err)),
  })
}
