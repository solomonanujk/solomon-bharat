'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '@/lib/api'
import { getApiError } from '@/lib/getApiError'
import type { WishlistEntry } from '@/types'

export function useWishlist(enabled = true) {
  return useQuery<WishlistEntry[]>({
    queryKey: ['wishlist'],
    queryFn: async () => (await api.get('/buyers/me/wishlist')).data.data ?? [],
    enabled,
    staleTime: 60 * 1000,
  })
}

export function useAddToWishlist() {
  const qc = useQueryClient()
  return useMutation<unknown, Error, string>({
    mutationFn: (productId) => api.post('/buyers/me/wishlist', { productId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wishlist'] })
      toast.success('Saved to wishlist.')
    },
    onError: (err) => toast.error(getApiError(err)),
  })
}

export function useRemoveFromWishlist() {
  const qc = useQueryClient()
  return useMutation<unknown, Error, string>({
    mutationFn: (productId) => api.delete(`/buyers/me/wishlist/${productId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wishlist'] }),
    onError: (err) => toast.error(getApiError(err)),
  })
}
