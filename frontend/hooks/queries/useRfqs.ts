'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '@/lib/api'
import { getApiError } from '@/lib/getApiError'

export type RfqStatus = 'NEW' | 'IN_PROGRESS' | 'QUOTED' | 'CLOSED'

export interface Rfq {
  id: string
  productId: string | null
  description: string
  quantity: number
  targetPrice: string | null
  currency: string | null
  destinationCountry: string
  deadline: string | null
  referenceImages: string[] | null
  status: RfqStatus
  isSample?: boolean
  adminNotes: string | null
  createdAt: string
  user?: { id: string; email: string; role: string }
  product?: { id: string; name: string; slug: string } | null
}

export interface CreateRfqInput {
  productId?: string
  description: string
  quantity: number
  targetPrice?: number
  currency?: string
  destinationCountry: string
  deadline?: string
  isSample?: boolean
  images: File[]
}

export function useCreateRfq() {
  return useMutation<Rfq, Error, CreateRfqInput>({
    mutationFn: async ({ images, ...fields }) => {
      const form = new FormData()
      Object.entries(fields).forEach(([k, v]) => {
        if (v !== undefined && v !== '') form.append(k, String(v))
      })
      images.forEach((file) => form.append('images', file))
      return (await api.post('/rfqs', form, { headers: { 'Content-Type': 'multipart/form-data' } })).data.data
    },
    onError: (err) => toast.error(getApiError(err)),
  })
}

export function useMyRfqs() {
  return useQuery<Rfq[]>({
    queryKey: ['my-rfqs'],
    queryFn: async () => (await api.get('/rfqs/me', { params: { limit: 100 } })).data.data ?? [],
  })
}

export function useAdminRfqs(status?: RfqStatus) {
  return useQuery<Rfq[]>({
    queryKey: ['admin-rfqs', status],
    queryFn: async () => (await api.get('/rfqs/admin', { params: { status, limit: 100 } })).data.data ?? [],
  })
}

export function useUpdateRfq() {
  const qc = useQueryClient()
  return useMutation<Rfq, Error, { id: string; status?: RfqStatus; adminNotes?: string }>({
    mutationFn: async ({ id, ...body }) => (await api.patch(`/rfqs/admin/${id}`, body)).data.data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-rfqs'] })
      toast.success('Request updated.')
    },
    onError: (err) => toast.error(getApiError(err)),
  })
}
