'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '@/lib/api'
import { getApiError } from '@/lib/getApiError'
import { toPaginated } from '@/lib/toPaginated'
import type { PaginatedResult } from '@/types'

// ─── Types ───────────────────────────────────────────────────────────────────────

export type BulkTemplateStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAUSED' | 'DISABLED'
export type BulkTemplateCategory = 'MARKETING' | 'UTILITY'
export type BulkCampaignStatus = 'DRAFT' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'CANCELLED'
export type BulkRecipientStatus = 'QUEUED' | 'SENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED'

export interface TemplateButton {
  type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER'
  text: string
  url?: string
  phone?: string
}

export interface TemplateInput {
  name: string
  category: BulkTemplateCategory
  language: string
  headerText?: string | null
  body: string
  footer?: string | null
  buttons?: TemplateButton[] | null
  variableExamples: string[]
}

export interface BulkTemplate extends TemplateInput {
  id: string
  status: BulkTemplateStatus
  metaTemplateId: string | null
  rejectionReason: string | null
  /** Pulled in from Meta's WhatsApp Manager: read-only here. */
  syncedFromMeta?: boolean
  createdAt: string
  updatedAt: string
}

export interface TemplateSyncResult {
  created: number
  updated: number
  unchanged: number
  skipped: { name: string; language: string; reason: string }[]
}

export type AudienceMode = 'ALL_LINKED' | 'FILTERED' | 'PICKED' | 'CSV'

export interface AudienceSpec {
  mode: AudienceMode
  filters?: { sellerType?: 'CURATED' | 'MARKETPLACE'; listedByChat?: boolean; search?: string }
  sellerIds?: string[]
  csvRows?: Record<string, string>[]
  csvKeyColumn?: string
}

export interface AudiencePreview {
  eligible: number
  skipped: { notLinked: number; optedOut: number; suspended: number; unmatched: number; duplicate: number }
  tooMany: boolean
  maxRecipients: number
  sample: { sellerId: string; businessName: string; contactName: string; phone: string }[]
}

export interface CampaignSummary {
  queued: number
  sent: number
  delivered: number
  read: number
  failed: number
  accepted: number
}

export interface BulkCampaign {
  id: string
  name: string
  status: BulkCampaignStatus
  templateId: string
  template: BulkTemplate
  totalCount: number
  skippedCount: number
  startedAt: string | null
  completedAt: string | null
  createdAt: string
  summary?: CampaignSummary
}

export interface BulkRecipient {
  id: string
  phone: string
  status: BulkRecipientStatus
  errorCode: number | null
  errorMessage: string | null
  sentAt: string | null
  deliveredAt: string | null
  readAt: string | null
  seller: { businessName: string }
}

export interface BulkReply {
  id: string
  campaignId: string
  phone: string
  type: string
  text: string | null
  receivedAt: string
  readByAdminAt: string | null
  campaign: { name: string }
  recipient: { seller: { businessName: string } }
}

export interface CampaignInput {
  name: string
  templateId: string
  audience: AudienceSpec
  variableMapping: string[]
}

const BASE = '/admin/bulk-messages'

// ─── Templates ───────────────────────────────────────────────────────────────────

export function useBulkTemplates(params: { status?: BulkTemplateStatus; page?: number; limit?: number }) {
  return useQuery<PaginatedResult<BulkTemplate>>({
    queryKey: ['bulk-templates', params],
    queryFn: async () => toPaginated<BulkTemplate>(await api.get(`${BASE}/templates`, { params })),
  })
}

export function useSaveBulkTemplate() {
  const qc = useQueryClient()
  return useMutation<BulkTemplate, Error, { id?: string; input: TemplateInput }>({
    mutationFn: async ({ id, input }) =>
      (id ? await api.put(`${BASE}/templates/${id}`, input) : await api.post(`${BASE}/templates`, input)).data.data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bulk-templates'] }),
    onError: (err) => toast.error(getApiError(err)),
  })
}

export function useSubmitBulkTemplate() {
  const qc = useQueryClient()
  return useMutation<BulkTemplate, Error, string>({
    mutationFn: async (id) => (await api.post(`${BASE}/templates/${id}/submit`)).data.data,
    onSuccess: () => {
      toast.success('Submitted to Meta. Approval usually takes a few minutes to a day.')
      void qc.invalidateQueries({ queryKey: ['bulk-templates'] })
    },
    onError: (err) => toast.error(getApiError(err)),
  })
}

export function useRefreshBulkTemplate() {
  const qc = useQueryClient()
  return useMutation<BulkTemplate, Error, string>({
    mutationFn: async (id) => (await api.post(`${BASE}/templates/${id}/refresh`)).data.data,
    onSuccess: (t) => {
      toast.success(`Status: ${t.status.toLowerCase()}`)
      void qc.invalidateQueries({ queryKey: ['bulk-templates'] })
    },
    onError: (err) => toast.error(getApiError(err)),
  })
}

export function useSyncBulkTemplates() {
  const qc = useQueryClient()
  return useMutation<TemplateSyncResult, Error, void>({
    mutationFn: async () => (await api.post(`${BASE}/templates/sync`)).data.data,
    onSuccess: (r) => {
      toast.success(`Synced from Meta: ${r.created} new, ${r.updated} updated${r.skipped.length ? `, ${r.skipped.length} left out` : ''}`)
      void qc.invalidateQueries({ queryKey: ['bulk-templates'] })
    },
    onError: (err) => toast.error(getApiError(err)),
  })
}

export function useDeleteBulkTemplate() {
  const qc = useQueryClient()
  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      await api.delete(`${BASE}/templates/${id}`)
    },
    onSuccess: () => {
      toast.success('Template deleted')
      void qc.invalidateQueries({ queryKey: ['bulk-templates'] })
    },
    onError: (err) => toast.error(getApiError(err)),
  })
}

// ─── Audience, test send, campaigns ─────────────────────────────────────────────

export function usePreviewAudience() {
  return useMutation<AudiencePreview, Error, AudienceSpec>({
    mutationFn: async (audience) => (await api.post(`${BASE}/audience/preview`, { audience })).data.data,
    onError: (err) => toast.error(getApiError(err)),
  })
}

export function useBulkTestSend() {
  return useMutation<{ messageId?: string }, Error, { templateId: string; phone: string; variables: string[] }>({
    mutationFn: async (body) => (await api.post(`${BASE}/test-send`, body)).data.data,
    onSuccess: () => toast.success('Test message sent'),
    onError: (err) => toast.error(getApiError(err)),
  })
}

export function useCreateBulkCampaign() {
  const qc = useQueryClient()
  return useMutation<BulkCampaign, Error, CampaignInput>({
    mutationFn: async (input) => (await api.post(`${BASE}/campaigns`, input)).data.data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bulk-campaigns'] }),
    onError: (err) => toast.error(getApiError(err)),
  })
}

export function useBulkCampaigns(params: { status?: BulkCampaignStatus; page?: number; limit?: number }) {
  return useQuery<PaginatedResult<BulkCampaign>>({
    queryKey: ['bulk-campaigns', params],
    queryFn: async () => toPaginated<BulkCampaign>(await api.get(`${BASE}/campaigns`, { params })),
    refetchInterval: 15_000,
  })
}

/** One campaign; refreshes every 5 seconds while it is sending. */
export function useBulkCampaign(id: string | undefined) {
  return useQuery<BulkCampaign>({
    queryKey: ['bulk-campaign', id],
    enabled: !!id,
    queryFn: async () => (await api.get(`${BASE}/campaigns/${id}`)).data.data,
    refetchInterval: (query) => (query.state.data?.status === 'RUNNING' ? 5_000 : false),
  })
}

export function useBulkRecipients(id: string | undefined, params: { status?: BulkRecipientStatus; page?: number; limit?: number }) {
  return useQuery<PaginatedResult<BulkRecipient>>({
    queryKey: ['bulk-recipients', id, params],
    enabled: !!id,
    queryFn: async () => toPaginated<BulkRecipient>(await api.get(`${BASE}/campaigns/${id}/recipients`, { params })),
    refetchInterval: 10_000,
  })
}

export type CampaignAction = 'start' | 'pause' | 'resume' | 'cancel'

const ACTION_MESSAGE: Record<CampaignAction, string> = {
  start: 'Campaign started',
  pause: 'Campaign paused',
  resume: 'Campaign resumed',
  cancel: 'Campaign cancelled',
}

export function useBulkCampaignAction() {
  const qc = useQueryClient()
  return useMutation<unknown, Error, { id: string; action: CampaignAction }>({
    mutationFn: async ({ id, action }) => (await api.post(`${BASE}/campaigns/${id}/${action}`)).data.data,
    onSuccess: (_d, { id, action }) => {
      toast.success(ACTION_MESSAGE[action])
      void qc.invalidateQueries({ queryKey: ['bulk-campaign', id] })
      void qc.invalidateQueries({ queryKey: ['bulk-campaigns'] })
    },
    onError: (err) => toast.error(getApiError(err)),
  })
}

/** Downloads the delivery report. It goes through the api client because the endpoint needs the Bearer token. */
export async function downloadBulkCampaignCsv(id: string): Promise<void> {
  let res
  try {
    res = await api.get(`${BASE}/campaigns/${id}/export`, { responseType: 'blob' })
  } catch (err) {
    const data = (err as { response?: { data?: unknown } })?.response?.data
    if (data instanceof Blob) {
      try {
        const parsed = JSON.parse(await data.text()) as { message?: string }
        if (parsed.message) throw new Error(parsed.message)
      } catch (inner) {
        if (inner instanceof Error && inner.message) throw inner
      }
    }
    throw new Error(getApiError(err, 'Could not prepare the report. Try again.'))
  }
  const url = URL.createObjectURL(new Blob([res.data as Blob], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `bulk-campaign-${id.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.csv`
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

// ─── Replies ─────────────────────────────────────────────────────────────────────

export function useBulkSummary() {
  return useQuery<{ unreadReplies: number }>({
    queryKey: ['bulk-summary'],
    queryFn: async () => (await api.get(`${BASE}/summary`)).data.data,
    refetchInterval: 60_000,
  })
}

export function useBulkReplies(params: { campaignId?: string; unread?: boolean; page?: number; limit?: number }) {
  return useQuery<PaginatedResult<BulkReply>>({
    queryKey: ['bulk-replies', params],
    queryFn: async () =>
      toPaginated<BulkReply>(await api.get(`${BASE}/replies`, { params: { ...params, unread: params.unread ? 'true' : undefined } })),
    refetchInterval: 30_000,
  })
}

export function useMarkBulkRepliesRead() {
  const qc = useQueryClient()
  return useMutation<unknown, Error, { id?: string; campaignId?: string }>({
    mutationFn: async ({ id, campaignId }) =>
      id
        ? (await api.post(`${BASE}/replies/${id}/read`)).data.data
        : (await api.post(`${BASE}/replies/read-all`, null, { params: { campaignId } })).data.data,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['bulk-replies'] })
      void qc.invalidateQueries({ queryKey: ['bulk-summary'] })
    },
    onError: (err) => toast.error(getApiError(err)),
  })
}
