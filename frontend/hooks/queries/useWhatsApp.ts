'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '@/lib/api'
import { getApiError } from '@/lib/getApiError'

export interface WhatsAppLinkStatus {
  linked: boolean
  number: string | null
  verifiedAt: string | null
}

const KEY = ['whatsapp-link']

export function useWhatsAppLink() {
  return useQuery<WhatsAppLinkStatus>({
    queryKey: KEY,
    queryFn: async () => (await api.get('/whatsapp/link')).data.data,
  })
}

export function useRequestWhatsAppCode() {
  return useMutation<{ expiresAt: string }, Error, { phone: string }>({
    mutationFn: async (body) => (await api.post('/whatsapp/link', body)).data.data,
    onSuccess: () => toast.success('Code sent. Check WhatsApp.'),
    onError: (err) => toast.error(getApiError(err)),
  })
}

export function useVerifyWhatsAppCode() {
  const qc = useQueryClient()
  return useMutation<WhatsAppLinkStatus, Error, { code: string }>({
    mutationFn: async (body) => (await api.post('/whatsapp/link/verify', body)).data.data,
    onSuccess: (status) => {
      qc.setQueryData(KEY, status)
      toast.success('WhatsApp number linked.')
    },
    onError: (err) => toast.error(getApiError(err)),
  })
}

export function useUnlinkWhatsApp() {
  const qc = useQueryClient()
  return useMutation<WhatsAppLinkStatus, Error, void>({
    mutationFn: async () => (await api.delete('/whatsapp/link')).data.data,
    onSuccess: (status) => {
      qc.setQueryData(KEY, status)
      toast.success('WhatsApp number unlinked.')
    },
    onError: (err) => toast.error(getApiError(err)),
  })
}
