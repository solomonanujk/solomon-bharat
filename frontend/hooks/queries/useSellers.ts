'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '@/lib/api'
import { getApiError } from '@/lib/getApiError'
import type { PaginatedResult, SellerApplication, SellerApplicationStatus, SellerApplyInput, SellerProfile } from '@/types'

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

// ─── Public: the only path to a SELLER account ───────────────────────────────

export function useApplyAsSeller() {
  return useMutation<SellerApplication, Error, SellerApplyInput>({
    mutationFn: async (body) => (await api.post('/sellers/apply', body)).data.data,
    onSuccess: () => toast.success("Application received — we'll be in touch shortly."),
    onError: (err) => toast.error(getApiError(err)),
  })
}

// ─── Seller: own profile ──────────────────────────────────────────────────────

export function useMySellerProfile() {
  return useQuery<SellerProfile>({
    queryKey: ['my-seller-profile'],
    queryFn: async () => (await api.get('/sellers/me')).data.data,
    staleTime: 5 * 60 * 1000,
  })
}

export function useUpdateMySellerProfile() {
  const qc = useQueryClient()
  return useMutation<SellerProfile, Error, Partial<Pick<SellerProfile, 'businessName' | 'contactName' | 'phone' | 'businessAddress' | 'bankDetails' | 'notificationPrefs'>>>({
    mutationFn: async (body) => (await api.patch('/sellers/me', body)).data.data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-seller-profile'] })
      toast.success('Settings saved.')
    },
    onError: (err) => toast.error(getApiError(err)),
  })
}

// ─── Admin: seller applications ───────────────────────────────────────────────

export function useSellerApplications(params?: { status?: SellerApplicationStatus; page?: number; limit?: number }) {
  return useQuery<PaginatedResult<SellerApplication>>({
    queryKey: ['seller-applications', params],
    queryFn: async () => toPaginated<SellerApplication>(await api.get('/sellers/applications', { params })),
  })
}

export function useSellerApplication(id: string | null) {
  return useQuery<SellerApplication>({
    queryKey: ['seller-application', id],
    queryFn: async () => (await api.get(`/sellers/applications/${id}`)).data.data,
    enabled: !!id,
  })
}

function invalidateApplication(qc: ReturnType<typeof useQueryClient>, id: string) {
  qc.invalidateQueries({ queryKey: ['seller-applications'] })
  qc.invalidateQueries({ queryKey: ['seller-application', id] })
}

export function useApproveSellerApplication() {
  const qc = useQueryClient()
  return useMutation<unknown, Error, string>({
    mutationFn: (id) => api.post(`/sellers/applications/${id}/approve`),
    onSuccess: (_, id) => {
      invalidateApplication(qc, id)
      toast.success('Seller approved — account credentials sent.')
    },
    onError: (err) => toast.error(getApiError(err)),
  })
}

export function useRejectSellerApplication() {
  const qc = useQueryClient()
  return useMutation<unknown, Error, { id: string; reason: string }>({
    mutationFn: ({ id, reason }) => api.post(`/sellers/applications/${id}/reject`, { reason }),
    onSuccess: (_, vars) => {
      invalidateApplication(qc, vars.id)
      toast.success('Application rejected.')
    },
    onError: (err) => toast.error(getApiError(err)),
  })
}

export function useRequestMoreInfo() {
  const qc = useQueryClient()
  return useMutation<unknown, Error, { id: string; message: string }>({
    mutationFn: ({ id, message }) => api.post(`/sellers/applications/${id}/request-info`, { message }),
    onSuccess: (_, vars) => {
      invalidateApplication(qc, vars.id)
      toast.success('More information requested from applicant.')
    },
    onError: (err) => toast.error(getApiError(err)),
  })
}

export function useAddApplicationNote() {
  const qc = useQueryClient()
  return useMutation<unknown, Error, { id: string; note: string }>({
    mutationFn: ({ id, note }) => api.post(`/sellers/applications/${id}/notes`, { note }),
    onSuccess: (_, vars) => invalidateApplication(qc, vars.id),
    onError: (err) => toast.error(getApiError(err)),
  })
}

// ─── Admin: approved sellers directory ───────────────────────────────────────

export function useAdminSellers(params?: { page?: number; limit?: number }) {
  return useQuery<PaginatedResult<SellerProfile>>({
    queryKey: ['admin-sellers', params],
    queryFn: async () => toPaginated<SellerProfile>(await api.get('/sellers', { params })),
  })
}

export function useAdminSeller(id: string | null) {
  return useQuery<SellerProfile>({
    queryKey: ['admin-seller', id],
    queryFn: async () => (await api.get(`/sellers/${id}`)).data.data,
    enabled: !!id,
  })
}
