'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '@/lib/api'
import { getApiError } from '@/lib/getApiError'
import type { AdminProduct, ApprovalStatus, PaginatedResult } from '@/types'

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

// ─── Admin: the WhatsApp tab ────────────────────────────────────────────────────

export interface WhatsAppAdminSummary {
  pendingProducts: number
  liveListings: number
  linkedSellers: number
}

export type WhatsAppSessionState = 'COLLECTING' | 'AWAITING_ANSWERS' | 'AWAITING_CONFIRM'

export interface WhatsAppLiveListing {
  sellerId: string
  businessName: string
  phone: string
  state: WhatsAppSessionState
  language: string
  productName: string | null
  categoryPath: string | null
  missing: string[]
  photoCount: number
  videoCount: number
  aiCalls: number
  startedAt: string
  lastMessageAt: string
  expiresAt: string
}

export interface WhatsAppLinkedSeller {
  sellerId: string
  businessName: string
  whatsappNumber: string
  linkedAt: string | null
  productsByChat: number
  aiCallsToday: number
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

/** Counts for the tab and the sidebar badge; refreshed every minute. */
export function useWhatsAppAdminSummary() {
  return useQuery<WhatsAppAdminSummary>({
    queryKey: ['whatsapp-admin-summary'],
    queryFn: async () => (await api.get('/whatsapp/admin/summary')).data.data,
    refetchInterval: 60_000,
  })
}

export function useWhatsAppAdminProducts(params: { approvalStatus?: ApprovalStatus; page?: number; limit?: number }) {
  return useQuery<PaginatedResult<AdminProduct>>({
    queryKey: ['whatsapp-admin-products', params],
    queryFn: async () => toPaginated<AdminProduct>(await api.get('/whatsapp/admin/products', { params })),
  })
}

/** Listings sellers are in the middle of; refreshed every 30 seconds. */
export function useWhatsAppAdminSessions(params: { page?: number; limit?: number }) {
  return useQuery<PaginatedResult<WhatsAppLiveListing>>({
    queryKey: ['whatsapp-admin-sessions', params],
    queryFn: async () => toPaginated<WhatsAppLiveListing>(await api.get('/whatsapp/admin/sessions', { params })),
    refetchInterval: 30_000,
  })
}

export function useWhatsAppAdminSellers(params: { search?: string; page?: number; limit?: number }) {
  return useQuery<PaginatedResult<WhatsAppLinkedSeller>>({
    queryKey: ['whatsapp-admin-sellers', params],
    queryFn: async () => toPaginated<WhatsAppLinkedSeller>(await api.get('/whatsapp/admin/sellers', { params })),
  })
}
