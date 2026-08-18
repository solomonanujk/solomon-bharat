'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '@/lib/api'
import { getApiError } from '@/lib/getApiError'
import type { AgentProfile, PaginatedResult } from '@/types'

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

// ─── Agent: PDF catalogue builder ─────────────────────────────────────────────
// The backend generates the PDF (pdfkit) and uploads it — this only posts the
// product selection and gets back a persisted, already-hosted fileUrl to open.

export interface AgentCatalogue {
  id: string
  title: string
  fileUrl: string
  createdAt: string
}

export interface GenerateCatalogueInput {
  productIds: string[]
  title?: string
}

export function useGenerateCatalogue() {
  const qc = useQueryClient()
  return useMutation<AgentCatalogue, Error, GenerateCatalogueInput>({
    mutationFn: async (body) => (await api.post('/agent/catalogues', body)).data.data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-catalogues'] })
      toast.success('Catalogue generated.')
    },
    onError: (err) => toast.error(getApiError(err, 'Could not generate the catalogue — try again.')),
  })
}

export function useMyCatalogues(params?: { page?: number; limit?: number }) {
  return useQuery<PaginatedResult<AgentCatalogue>>({
    queryKey: ['my-catalogues', params],
    queryFn: async () => toPaginated<AgentCatalogue>(await api.get('/agent/catalogues', { params })),
    staleTime: 60 * 1000,
  })
}

export function useMyCatalogue(id: string | null) {
  return useQuery<AgentCatalogue>({
    queryKey: ['my-catalogue', id],
    queryFn: async () => (await api.get(`/agent/catalogues/${id}`)).data.data,
    enabled: !!id,
  })
}

// ─── Agent: own profile ───────────────────────────────────────────────────────
// Deliberate small duplicate of the GET /agents/me call — a concurrently-running
// agent owns `hooks/queries/useAgents.ts` (which will likely grow its own
// `useMyAgentProfile`), so this hook is kept local and distinctly named here to
// avoid a file-ownership conflict / naming collision.

export function useMyAgentProfileForPortal() {
  return useQuery<AgentProfile>({
    queryKey: ['my-agent-profile-portal'],
    queryFn: async () => (await api.get('/agents/me')).data.data,
    staleTime: 5 * 60 * 1000,
  })
}
