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

export function useAuditLog(params?: { entityType?: string; adminId?: string; page?: number; limit?: number }) {
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
  createdAt: string
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
