import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '@/lib/api'
import { getApiError } from '@/lib/getApiError'

export type GuideKnowledgeKind = 'TEXT' | 'PDF' | 'IMAGE' | 'SPREADSHEET'

export interface GuideKnowledgeItem {
  id: string
  title: string
  kind: GuideKnowledgeKind
  fileUrl: string | null
  fileName: string | null
  sizeBytes: number | null
  createdAt: string
  characters: number
  status: 'PROCESSING' | 'READY' | 'FAILED'
  error: string | null
  /** AI summary of the key points learned. */
  summary: string | null
}

export interface GuideTurn {
  role: 'user' | 'assistant'
  content: string
  at: string
}

export interface GuideConversationRow {
  id: string
  name: string
  email: string
  phone: string
  country: string | null
  messageCount: number
  createdAt: string
  updatedAt: string
}

// ─── Admin ───────────────────────────────────────────────────────────────────

export function useGuideKnowledge() {
  return useQuery<GuideKnowledgeItem[]>({
    queryKey: ['guide-knowledge'],
    queryFn: async () => (await api.get('/guide/admin/knowledge')).data.data,
    // While files are being read (or summaries written), check again every 5 seconds.
    refetchInterval: (q) =>
      q.state.data?.some((i) => i.status === 'PROCESSING' || (i.status === 'READY' && !i.summary)) ? 5000 : false,
  })
}

/** Full text of one item, loaded when the admin opens "See what it learned". */
export function useGuideKnowledgeItem(id: string | null) {
  return useQuery<{ id: string; content: string; summary: string | null }>({
    queryKey: ['guide-knowledge-item', id],
    queryFn: async () => (await api.get(`/guide/admin/knowledge/${id}`)).data.data,
    enabled: !!id,
  })
}

function useInvalidateKnowledge() {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({ queryKey: ['guide-knowledge'] })
    // Suggestions refresh in the background on the server; check again shortly.
    setTimeout(() => qc.invalidateQueries({ queryKey: ['guide-suggestions'] }), 20_000)
  }
}

export function useAddGuideText() {
  const done = useInvalidateKnowledge()
  return useMutation<unknown, Error, { title: string; text: string }>({
    mutationFn: async (body) => api.post('/guide/admin/knowledge/text', body),
    onSuccess: () => {
      done()
      toast.success('Added. Solomon AI will use it from the next answer.')
    },
    onError: (err) => toast.error(getApiError(err)),
  })
}

export function useUploadGuideFile() {
  const done = useInvalidateKnowledge()
  return useMutation<unknown, Error, { file: File; title?: string }>({
    mutationFn: async ({ file, title }) => {
      const fd = new FormData()
      fd.append('file', file)
      if (title) fd.append('title', title)
      return api.post('/guide/admin/knowledge/file', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 3 * 60 * 1000,
      })
    },
    onSuccess: () => done(),
    onError: (err, { file }) => toast.error(`${file.name}: ${getApiError(err)}`),
  })
}

export function useDeleteGuideKnowledge() {
  const done = useInvalidateKnowledge()
  return useMutation<unknown, Error, string>({
    mutationFn: async (id) => api.delete(`/guide/admin/knowledge/${id}`),
    onSuccess: () => {
      done()
      toast.success('Removed. Solomon AI no longer uses it.')
    },
    onError: (err) => toast.error(getApiError(err)),
  })
}

export function useDeleteAllGuideKnowledge() {
  const qc = useQueryClient()
  return useMutation<{ removed: number }, Error, void>({
    mutationFn: async () => (await api.delete('/guide/admin/knowledge')).data.data,
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['guide-knowledge'] })
      qc.invalidateQueries({ queryKey: ['guide-suggestions'] })
      toast.success(`Removed ${r.removed} item${r.removed === 1 ? '' : 's'}. Solomon AI no longer uses them.`)
    },
    onError: (err) => toast.error(getApiError(err)),
  })
}

export function useGuideSuggestions() {
  return useQuery<{ text: string; updatedAt: string | null }>({
    queryKey: ['guide-suggestions'],
    queryFn: async () => (await api.get('/guide/admin/suggestions')).data.data,
  })
}

export function useRefreshGuideSuggestions() {
  const qc = useQueryClient()
  return useMutation<{ text: string; updatedAt: string | null }, Error, void>({
    mutationFn: async () => (await api.post('/guide/admin/suggestions/refresh', {}, { timeout: 2 * 60 * 1000 })).data.data,
    onSuccess: (data) => qc.setQueryData(['guide-suggestions'], data),
    onError: (err) => toast.error(getApiError(err)),
  })
}

export function useGuideSettings() {
  return useQuery<{ allowWebSearch: boolean }>({
    queryKey: ['guide-settings'],
    queryFn: async () => (await api.get('/guide/admin/settings')).data.data,
  })
}

export function useUpdateGuideSettings() {
  const qc = useQueryClient()
  return useMutation<{ allowWebSearch: boolean }, Error, { allowWebSearch: boolean }>({
    mutationFn: async (body) => (await api.put('/guide/admin/settings', body)).data.data,
    onSuccess: (data) => {
      qc.setQueryData(['guide-settings'], data)
      toast.success('Saved.')
    },
    onError: (err) => toast.error(getApiError(err)),
  })
}

export function useGuideConversations(page: number) {
  return useQuery<{ rows: GuideConversationRow[]; total: number; totalPages: number }>({
    queryKey: ['guide-conversations', page],
    queryFn: async () => {
      const res = await api.get('/guide/admin/conversations', { params: { page, limit: 20 } })
      return { rows: res.data.data, total: res.data.meta?.total ?? 0, totalPages: res.data.meta?.totalPages ?? 1 }
    },
  })
}

export function useGuideConversation(id: string | null) {
  return useQuery<GuideConversationRow & { messages: GuideTurn[] }>({
    queryKey: ['guide-conversation', id],
    queryFn: async () => (await api.get(`/guide/admin/conversations/${id}`)).data.data,
    enabled: !!id,
  })
}

// ─── AI connection (Gemini key entered by the admin) ─────────────────────────

export type GuideAiProvider = 'anthropic' | 'openrouter' | 'gemini'

export interface GuideKeyStatus {
  source: 'server' | 'admin' | 'none'
  last4: string | null
}

export interface GuideAiKeyStatus {
  /** Which AI answers first. */
  active: 'openrouter' | 'gemini' | 'claude' | 'none'
  openrouter: GuideKeyStatus
  gemini: GuideKeyStatus
  anthropic: GuideKeyStatus
}

export function useGuideAiKey() {
  return useQuery<GuideAiKeyStatus>({
    queryKey: ['guide-ai-key'],
    queryFn: async () => (await api.get('/guide/admin/ai-key')).data.data,
  })
}

export function useSaveGuideAiKey() {
  const qc = useQueryClient()
  return useMutation<GuideAiKeyStatus, Error, { provider: GuideAiProvider; key: string }>({
    mutationFn: async (body) => (await api.put('/guide/admin/ai-key', body)).data.data,
    onSuccess: (data) => {
      qc.setQueryData(['guide-ai-key'], data)
      toast.success('Connected. Solomon AI is ready to answer.')
    },
    onError: (err) => toast.error(getApiError(err)),
  })
}

export function useRemoveGuideAiKey() {
  const qc = useQueryClient()
  return useMutation<GuideAiKeyStatus, Error, GuideAiProvider>({
    mutationFn: async (provider) => (await api.delete('/guide/admin/ai-key', { params: { provider } })).data.data,
    onSuccess: (data) => {
      qc.setQueryData(['guide-ai-key'], data)
      toast.success('Key removed.')
    },
    onError: (err) => toast.error(getApiError(err)),
  })
}
