'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '@/lib/api'
import { getApiError } from '@/lib/getApiError'
import type { AdminDashboardSummary, AuditLogEntry, PaginatedResult, PlatformSetting, ReportType, Role } from '@/types'

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

// ─── Dashboard ─────────────────────────────────────────────────────────────────

export function useAdminDashboard() {
  return useQuery<AdminDashboardSummary>({
    queryKey: ['admin-dashboard'],
    queryFn: async () => (await api.get('/admin/dashboard')).data.data,
    staleTime: 60 * 1000,
  })
}

// ─── Reports & analytics ───────────────────────────────────────────────────────

export interface ReportsParams {
  type: ReportType
  from?: string
  to?: string
}

export function useAdminReport(params: ReportsParams) {
  return useQuery<Record<string, unknown>[]>({
    queryKey: ['admin-report', params],
    queryFn: async () => (await api.get('/admin/reports', { params: { ...params, format: 'json' } })).data.data,
    staleTime: 5 * 60 * 1000,
  })
}

/** Streams the CSV export for the same report type/date-range and triggers a browser download. */
export async function downloadAdminReportCsv(params: ReportsParams, filename = 'report.csv') {
  const res = await api.get('/admin/reports', { params: { ...params, format: 'csv' }, responseType: 'blob' })
  const url = URL.createObjectURL(res.data as Blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

// ─── Audit log ─────────────────────────────────────────────────────────────────

export function useAuditLog(params?: { entityType?: string; adminId?: string; entityId?: string; page?: number; limit?: number }) {
  return useQuery<PaginatedResult<AuditLogEntry>>({
    queryKey: ['audit-log', params],
    queryFn: async () => toPaginated<AuditLogEntry>(await api.get('/admin/audit-log', { params })),
  })
}

// ─── Platform settings (key/value — the closest thing to a CMS store) ────────

export function usePlatformSettings() {
  return useQuery<PlatformSetting[]>({
    queryKey: ['platform-settings'],
    queryFn: async () => (await api.get('/admin/settings')).data.data ?? [],
  })
}

export function useUpdatePlatformSetting() {
  const qc = useQueryClient()
  return useMutation<unknown, Error, { key: string; value: unknown }>({
    mutationFn: ({ key, value }) => api.put(`/admin/settings/${key}`, { value }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platform-settings'] })
      toast.success('Setting saved.')
    },
    onError: (err) => toast.error(getApiError(err)),
  })
}

// ─── Cross-role user management ───────────────────────────────────────────────

export interface AdminUser {
  id: string
  email: string
  role: Role
  status: 'ACTIVE' | 'SUSPENDED'
  /** True while the account is still on an admin-issued temporary password. */
  mustChangePassword?: boolean
  createdAt: string
  updatedAt?: string
}

export function useAdminUsers(params?: { role?: Role; page?: number; limit?: number }) {
  return useQuery<PaginatedResult<AdminUser>>({
    queryKey: ['admin-users', params],
    queryFn: async () => toPaginated<AdminUser>(await api.get('/admin/users', { params })),
  })
}

export function useSuspendUser() {
  const qc = useQueryClient()
  return useMutation<unknown, Error, string>({
    mutationFn: (id) => api.post(`/admin/users/${id}/suspend`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] })
      toast.success('User suspended.')
    },
    onError: (err) => toast.error(getApiError(err)),
  })
}

export function useReactivateUser() {
  const qc = useQueryClient()
  return useMutation<unknown, Error, string>({
    mutationFn: (id) => api.post(`/admin/users/${id}/reactivate`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] })
      toast.success('User reactivated.')
    },
    onError: (err) => toast.error(getApiError(err)),
  })
}

// ─── Seller / agent sign-in access (Admin → Sellers "Seller access" card) ─────
//
// Passwords are bcrypt hashes server-side and are never readable. These two actions
// are the safe equivalent of "show me their password": issue a fresh one-time
// set-password link, or mint a new temporary password that the API returns exactly
// once, in the mutation result, for the admin to copy and share.

export interface SignInLink {
  email: string
  url: string
  expiresInDays: number
}

/** Creates a fresh one-time, 7-day set-password link the admin can re-share. */
export function useCreateSignInLink() {
  return useMutation<SignInLink, Error, string>({
    mutationFn: async (userId) => (await api.post(`/admin/users/${userId}/sign-in-link`)).data.data,
    onError: (err) => toast.error(getApiError(err)),
  })
}

export interface TempPasswordReset {
  email: string
  /** Shown to the admin ONCE. Never persisted here, never re-fetchable. */
  tempPassword: string
  emailSent: boolean
}

/**
 * Resets the account to a new temporary password and emails the seller. The plaintext
 * comes back in this one response only — the caller must show it immediately and must
 * not write it to storage.
 */
export function useResetTempPassword() {
  const qc = useQueryClient()
  return useMutation<TempPasswordReset, Error, string>({
    mutationFn: async (userId) => (await api.post(`/admin/users/${userId}/reset-temp-password`)).data.data,
    onSuccess: () => {
      // mustChangePassword / updatedAt just changed on the account.
      qc.invalidateQueries({ queryKey: ['admin-users'] })
      qc.invalidateQueries({ queryKey: ['admin-sellers'] })
      qc.invalidateQueries({ queryKey: ['admin-seller'] })
    },
    onError: (err) => toast.error(getApiError(err)),
  })
}

export function usePromoteToAdmin() {
  const qc = useQueryClient()
  return useMutation<unknown, Error, string>({
    mutationFn: (id) => api.post(`/admin/users/${id}/promote`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] })
      toast.success('User promoted to Super Admin.')
    },
    onError: (err) => toast.error(getApiError(err)),
  })
}
