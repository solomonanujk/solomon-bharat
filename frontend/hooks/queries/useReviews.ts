'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '@/lib/api'
import { getApiError } from '@/lib/getApiError'
import type { PaginatedResult, Review } from '@/types'

interface ProductReviews extends PaginatedResult<Review> {
  avgRating: number | null
  reviewCount: number
}

export function useProductReviews(productId: string | null, params?: { page?: number; limit?: number }) {
  return useQuery<ProductReviews>({
    queryKey: ['reviews', productId, params],
    queryFn: async () => {
      const res = await api.get('/reviews', { params: { productId, ...params } })
      const { items, avgRating, reviewCount } = res.data.data
      const meta = res.data.meta ?? {}
      return {
        items,
        avgRating,
        reviewCount,
        total: meta.total ?? reviewCount,
        page: meta.page ?? 1,
        limit: meta.limit ?? items.length,
        totalPages: meta.totalPages ?? 1,
      }
    },
    enabled: !!productId,
    staleTime: 60 * 1000,
  })
}

export interface SubmitReviewInput {
  orderItemId: string
  rating: number
  comment?: string
  /** Optional — up to 5 photos, matches the backend's uploadImages(images, 5) limit. */
  images?: File[]
}

function toReviewFormData(input: SubmitReviewInput): FormData {
  const fd = new FormData()
  fd.append('orderItemId', input.orderItemId)
  fd.append('rating', String(input.rating))
  if (input.comment) fd.append('comment', input.comment)
  input.images?.forEach((file) => fd.append('images', file))
  return fd
}

export function useSubmitReview() {
  const qc = useQueryClient()
  return useMutation<Review, Error, SubmitReviewInput>({
    mutationFn: async (input) =>
      (
        await api.post('/reviews', toReviewFormData(input), {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
      ).data.data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reviews'] })
      qc.invalidateQueries({ queryKey: ['my-orders'] })
      qc.invalidateQueries({ queryKey: ['my-order'] })
      toast.success('Thanks for your review!')
    },
    onError: (err) => toast.error(getApiError(err)),
  })
}
