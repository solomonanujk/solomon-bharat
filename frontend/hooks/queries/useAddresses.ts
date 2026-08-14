'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '@/lib/api'
import { getApiError } from '@/lib/getApiError'
import type { Address } from '@/types'

export function useAddresses() {
  return useQuery<Address[]>({
    queryKey: ['addresses'],
    queryFn: async () => (await api.get('/buyers/me/addresses')).data.data ?? [],
    staleTime: 5 * 60 * 1000,
  })
}

export type AddressInput = Omit<Address, 'id' | 'isDefault'> & { isDefault?: boolean }

export function useCreateAddress() {
  const qc = useQueryClient()
  return useMutation<Address, Error, AddressInput>({
    mutationFn: async (body) => (await api.post('/buyers/me/addresses', body)).data.data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['addresses'] })
      toast.success('Address added.')
    },
    onError: (err) => toast.error(getApiError(err)),
  })
}

export function useUpdateAddress() {
  const qc = useQueryClient()
  return useMutation<Address, Error, { id: string; data: Partial<AddressInput> }>({
    mutationFn: async ({ id, data }) => (await api.patch(`/buyers/me/addresses/${id}`, data)).data.data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['addresses'] })
      toast.success('Address updated.')
    },
    onError: (err) => toast.error(getApiError(err)),
  })
}

export function useDeleteAddress() {
  const qc = useQueryClient()
  return useMutation<unknown, Error, string>({
    mutationFn: (id) => api.delete(`/buyers/me/addresses/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['addresses'] })
      toast.success('Address removed.')
    },
    onError: (err) => toast.error(getApiError(err)),
  })
}

export function useSetDefaultAddress() {
  const qc = useQueryClient()
  return useMutation<unknown, Error, string>({
    mutationFn: (id) => api.post(`/buyers/me/addresses/${id}/default`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['addresses'] }),
    onError: (err) => toast.error(getApiError(err)),
  })
}
