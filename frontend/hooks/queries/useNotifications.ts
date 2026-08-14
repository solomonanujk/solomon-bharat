'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import type { AppNotification, PaginatedResult } from '@/types'

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

export function useNotifications(params?: { unreadOnly?: boolean; page?: number; limit?: number }) {
  return useQuery<PaginatedResult<AppNotification>>({
    queryKey: ['notifications', params],
    queryFn: async () => toPaginated<AppNotification>(await api.get('/notifications', { params })),
    staleTime: 30 * 1000,
  })
}

export function useUnreadNotificationCount() {
  return useQuery<number>({
    queryKey: ['notifications', 'unread-count'],
    queryFn: async () => (await api.get('/notifications/unread-count')).data.data.count,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  })
}

export function useMarkNotificationRead() {
  const qc = useQueryClient()
  return useMutation<unknown, Error, string>({
    mutationFn: (id) => api.post(`/notifications/${id}/read`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient()
  return useMutation<unknown, Error, void>({
    mutationFn: () => api.post('/notifications/read-all'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })
}
