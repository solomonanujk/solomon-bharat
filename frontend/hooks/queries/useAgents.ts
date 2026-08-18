'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '@/lib/api'
import { getApiError } from '@/lib/getApiError'
import type { AgentApplication, AgentApplicationStatus, AgentApplyInput, AgentProfile, PaginatedResult } from '@/types'

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

// ─── Public: the only path to an AGENT account ───────────────────────────────

export function useApplyAsAgent() {
  return useMutation<AgentApplication, Error, AgentApplyInput>({
    mutationFn: async (body) => (await api.post('/agents/apply', body)).data.data,
    onSuccess: () => toast.success("Application received — we'll be in touch shortly."),
    onError: (err) => toast.error(getApiError(err)),
  })
}

// ─── Agent: own profile ───────────────────────────────────────────────────────

export function useMyAgentProfile() {
  return useQuery<AgentProfile>({
    queryKey: ['my-agent-profile'],
    queryFn: async () => (await api.get('/agents/me')).data.data,
    staleTime: 5 * 60 * 1000,
  })
}

export function useUpdateMyAgentProfile() {
  const qc = useQueryClient()
  return useMutation<AgentProfile, Error, Partial<Pick<AgentProfile, 'businessName' | 'contactName' | 'phone' | 'businessAddress'>>>({
    mutationFn: async (body) => (await api.patch('/agents/me', body)).data.data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-agent-profile'] })
      toast.success('Settings saved.')
    },
    onError: (err) => toast.error(getApiError(err)),
  })
}

// ─── Admin: agent applications ────────────────────────────────────────────────

export function useAgentApplications(params?: { status?: AgentApplicationStatus; page?: number; limit?: number }) {
  return useQuery<PaginatedResult<AgentApplication>>({
    queryKey: ['agent-applications', params],
    queryFn: async () => toPaginated<AgentApplication>(await api.get('/agents/applications', { params })),
  })
}

export function useAgentApplication(id: string | null) {
  return useQuery<AgentApplication>({
    queryKey: ['agent-application', id],
    queryFn: async () => (await api.get(`/agents/applications/${id}`)).data.data,
    enabled: !!id,
  })
}

function invalidateApplication(qc: ReturnType<typeof useQueryClient>, id: string) {
  qc.invalidateQueries({ queryKey: ['agent-applications'] })
  qc.invalidateQueries({ queryKey: ['agent-application', id] })
}

export function useApproveAgentApplication() {
  const qc = useQueryClient()
  return useMutation<unknown, Error, string>({
    mutationFn: (id) => api.post(`/agents/applications/${id}/approve`),
    onSuccess: (_, id) => {
      invalidateApplication(qc, id)
      toast.success('Agent approved — account credentials sent.')
    },
    onError: (err) => toast.error(getApiError(err)),
  })
}

export function useRejectAgentApplication() {
  const qc = useQueryClient()
  return useMutation<unknown, Error, { id: string; reason: string }>({
    mutationFn: ({ id, reason }) => api.post(`/agents/applications/${id}/reject`, { reason }),
    onSuccess: (_, vars) => {
      invalidateApplication(qc, vars.id)
      toast.success('Application rejected.')
    },
    onError: (err) => toast.error(getApiError(err)),
  })
}

export function useRequestAgentMoreInfo() {
  const qc = useQueryClient()
  return useMutation<unknown, Error, { id: string; message: string }>({
    mutationFn: ({ id, message }) => api.post(`/agents/applications/${id}/request-info`, { message }),
    onSuccess: (_, vars) => {
      invalidateApplication(qc, vars.id)
      toast.success('More information requested from applicant.')
    },
    onError: (err) => toast.error(getApiError(err)),
  })
}

export function useAddAgentApplicationNote() {
  const qc = useQueryClient()
  return useMutation<unknown, Error, { id: string; note: string }>({
    mutationFn: ({ id, note }) => api.post(`/agents/applications/${id}/notes`, { note }),
    onSuccess: (_, vars) => invalidateApplication(qc, vars.id),
    onError: (err) => toast.error(getApiError(err)),
  })
}
