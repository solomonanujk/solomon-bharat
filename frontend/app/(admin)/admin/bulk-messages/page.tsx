'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Megaphone, Plus, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/shared/EmptyState'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Pager, Skeleton, Table, cell, formatDate, formatDateTime, timeAgo } from '@/components/admin/AdminTable'
import { CampaignWizard } from '@/components/admin/bulk/CampaignWizard'
import { TemplateWizard } from '@/components/admin/bulk/TemplateWizard'
import {
  useBulkCampaigns,
  useBulkReplies,
  useBulkSummary,
  useBulkTemplates,
  useDeleteBulkTemplate,
  useMarkBulkRepliesRead,
  useRefreshBulkTemplate,
  useSubmitBulkTemplate,
  useSyncBulkTemplates,
  type BulkCampaign,
  type BulkTemplate,
} from '@/hooks/queries/useBulkMessages'
import { cn } from '@/lib/utils'

type Tab = 'campaigns' | 'templates' | 'replies'
type View = { kind: 'list' } | { kind: 'template'; editing?: BulkTemplate } | { kind: 'campaign' }

const PAGE_LIMIT = 20

// ─── Campaigns ───────────────────────────────────────────────────────────────────

function Progress({ campaign }: { campaign: BulkCampaign }) {
  const s = campaign.summary
  const total = campaign.totalCount || 1
  const done = s ? s.accepted + s.failed : 0
  return (
    <div className="min-w-[140px]">
      <div className="h-1.5 bg-[#E7EDE7] rounded-full overflow-hidden">
        <div className="h-full bg-[#183D33]" style={{ width: `${Math.min(100, (done / total) * 100)}%` }} />
      </div>
      <p className="text-[11px] font-sans text-[#183D33B3] mt-1">
        {s ? `${s.accepted} sent` : '…'} of {campaign.totalCount}
        {s && s.failed > 0 ? `, ${s.failed} failed` : ''}
      </p>
    </div>
  )
}

function CampaignsTab({ onNew }: { onNew: () => void }) {
  const router = useRouter()
  const [page, setPage] = useState(1)
  const { data, isLoading } = useBulkCampaigns({ page, limit: PAGE_LIMIT })
  const items = data?.items ?? []

  return (
    <div className="bg-white border border-[#D9E2DA] rounded-xl overflow-hidden">
      {isLoading ? (
        <Skeleton />
      ) : items.length === 0 ? (
        <EmptyState
          title="No campaigns yet"
          description="Create a template, wait for Meta to approve it, then send it to your sellers."
          action={{ label: 'New campaign', onClick: onNew }}
        />
      ) : (
        <>
          <Table heads={['Campaign', 'Template', 'Status', 'Progress', 'Started']}>
            {items.map((c) => (
              <tr
                key={c.id}
                onClick={() => router.push(`/admin/bulk-messages/${c.id}`)}
                className="border-b border-[#D9E2DA] last:border-0 hover:bg-[#E7EDE7]/30 transition-colors cursor-pointer"
              >
                <td className={cn(cell, 'text-[#0F241D] font-[600] max-w-[240px] truncate')}>{c.name}</td>
                <td className={cell}>{c.template.name}</td>
                <td className="py-3 px-4">
                  <StatusBadge status={c.status} />
                </td>
                <td className="py-3 px-4">
                  <Progress campaign={c} />
                </td>
                <td className={cn(cell, 'whitespace-nowrap')}>{c.startedAt ? formatDateTime(c.startedAt) : formatDate(c.createdAt)}</td>
              </tr>
            ))}
          </Table>
          <Pager page={page} totalPages={data?.totalPages ?? 1} total={data?.total ?? 0} limit={data?.limit ?? PAGE_LIMIT} onPage={setPage} />
        </>
      )}
    </div>
  )
}

// ─── Templates ───────────────────────────────────────────────────────────────────

function TemplatesTab({ onNew, onEdit }: { onNew: () => void; onEdit: (t: BulkTemplate) => void }) {
  const [page, setPage] = useState(1)
  const { data, isLoading } = useBulkTemplates({ page, limit: PAGE_LIMIT })
  const submit = useSubmitBulkTemplate()
  const refresh = useRefreshBulkTemplate()
  const remove = useDeleteBulkTemplate()
  const sync = useSyncBulkTemplates()
  const items = data?.items ?? []
  const link = 'text-[12px] font-[600] font-sans text-[#183D33] hover:underline disabled:opacity-40'

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <p className="text-[12px] font-sans text-[#183D33B3] max-w-[640px]">
          Templates made in Meta&apos;s WhatsApp Manager, and Meta&apos;s own samples like hello_world, can be brought in with Sync from Meta. Only templates Meta has approved can be sent.
        </p>
        <Button variant="secondary" size="sm" onClick={() => sync.mutate()} loading={sync.isPending}>
          <RefreshCw size={14} aria-hidden="true" /> Sync from Meta
        </Button>
      </div>
      {sync.data && sync.data.skipped.length > 0 && (
        <div className="mb-3 rounded-xl border border-[#D9E2DA] bg-[#E7EDE7]/40 px-4 py-3">
          <p className="text-[12px] font-[600] font-sans text-[#0F241D]">Left out because they cannot be sent from here:</p>
          <ul className="mt-1 text-[12px] font-sans text-[#183D33B3] list-disc pl-4">
            {sync.data.skipped.map((s, i) => (
              <li key={`${s.name}-${s.language}-${i}`}>
                {s.name} ({s.language}): {s.reason}
              </li>
            ))}
          </ul>
        </div>
      )}
    <div className="bg-white border border-[#D9E2DA] rounded-xl overflow-hidden">
      {isLoading ? (
        <Skeleton />
      ) : items.length === 0 ? (
        <EmptyState
          title="No templates yet"
          description="A template is the message you will send. Build one step by step and submit it to Meta for approval."
          action={{ label: 'New template', onClick: onNew }}
        />
      ) : (
        <>
          <Table heads={['Template', 'Category', 'Language', 'Status', 'Updated', '']}>
            {items.map((t) => (
              <tr key={t.id} className="border-b border-[#D9E2DA] last:border-0 align-top">
                <td className="py-3 px-4 max-w-[300px]">
                  <p className="text-[13px] font-[600] font-sans text-[#0F241D] break-all">
                    {t.name}
                    {t.syncedFromMeta && (
                      <span className="ml-2 align-middle text-[10px] font-[600] uppercase tracking-wide text-[#183D33] bg-[#E7EDE7] rounded px-1.5 py-0.5">From Meta</span>
                    )}
                  </p>
                  <p className="text-[12px] font-sans text-[#183D33B3] line-clamp-2 mt-0.5">{t.body}</p>
                </td>
                <td className={cell}>{t.category === 'MARKETING' ? 'Marketing' : 'Utility'}</td>
                <td className={cell}>{t.language}</td>
                <td className="py-3 px-4">
                  <StatusBadge status={t.status} />
                  {t.status === 'REJECTED' && t.rejectionReason && (
                    <p className="text-[11px] font-sans text-error mt-1 max-w-[200px]">{t.rejectionReason}</p>
                  )}
                </td>
                <td className={cn(cell, 'whitespace-nowrap')}>{formatDate(t.updatedAt)}</td>
                <td className="py-3 px-4">
                  <div className="flex flex-wrap gap-x-3 gap-y-1 justify-end">
                    {t.status === 'DRAFT' && (
                      <>
                        <button type="button" className={link} onClick={() => onEdit(t)}>
                          Edit
                        </button>
                        <button type="button" className={link} disabled={submit.isPending} onClick={() => submit.mutate(t.id)}>
                          Submit to Meta
                        </button>
                      </>
                    )}
                    {t.status !== 'DRAFT' && (
                      <button type="button" className={link} disabled={refresh.isPending} onClick={() => refresh.mutate(t.id)}>
                        Refresh status
                      </button>
                    )}
                    <button
                      type="button"
                      className={cn(link, 'text-error')}
                      disabled={remove.isPending}
                      onClick={() => {
                        const message = t.syncedFromMeta
                          ? `Remove "${t.name}" from this list? It stays in Meta, and Sync from Meta would bring it back.`
                          : `Delete the template "${t.name}"? This also removes it from Meta.`
                        if (window.confirm(message)) remove.mutate(t.id)
                      }}
                    >
                      {t.syncedFromMeta ? 'Remove' : 'Delete'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </Table>
          <Pager page={page} totalPages={data?.totalPages ?? 1} total={data?.total ?? 0} limit={data?.limit ?? PAGE_LIMIT} onPage={setPage} />
        </>
      )}
    </div>
    </>
  )
}

// ─── Replies ─────────────────────────────────────────────────────────────────────

function RepliesTab() {
  const [page, setPage] = useState(1)
  const [unread, setUnread] = useState(false)
  const { data, isLoading } = useBulkReplies({ unread, page, limit: PAGE_LIMIT })
  const markRead = useMarkBulkRepliesRead()
  const items = data?.items ?? []

  return (
    <>
      <div className="flex items-center justify-between gap-3 mb-3">
        <label className="flex items-center gap-2 text-[13px] font-sans text-[#0F241D]">
          <input
            type="checkbox"
            className="w-4 h-4 accent-[#183D33]"
            checked={unread}
            onChange={(e) => {
              setUnread(e.target.checked)
              setPage(1)
            }}
          />
          Unread only
        </label>
        <Button variant="ghost" size="sm" onClick={() => markRead.mutate({})} disabled={markRead.isPending}>
          Mark all as read
        </Button>
      </div>
      <div className="bg-white border border-[#D9E2DA] rounded-xl overflow-hidden">
        {isLoading ? (
          <Skeleton />
        ) : items.length === 0 ? (
          <EmptyState title="No replies" description="Answers sellers send to a bulk message appear here for 90 days." />
        ) : (
          <>
            <Table heads={['Seller', 'Reply', 'Campaign', 'Received']}>
              {items.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => !r.readByAdminAt && markRead.mutate({ id: r.id })}
                  className={cn('border-b border-[#D9E2DA] last:border-0 align-top', !r.readByAdminAt && 'bg-[#E7EDE7]/40 cursor-pointer')}
                >
                  <td className="py-3 px-4">
                    <p className={cn('text-[13px] font-sans text-[#0F241D]', !r.readByAdminAt && 'font-[700]')}>{r.recipient.seller.businessName}</p>
                    <p className="text-[11px] font-sans text-[#183D33B3]">{r.phone}</p>
                  </td>
                  <td className={cn(cell, 'max-w-[360px] whitespace-pre-wrap break-words text-[#0F241D]')}>
                    {r.text || (r.type === 'media' ? 'Sent a photo or file' : '—')}
                  </td>
                  <td className={cell}>{r.campaign.name}</td>
                  <td className={cn(cell, 'whitespace-nowrap')}>{timeAgo(r.receivedAt)}</td>
                </tr>
              ))}
            </Table>
            <Pager page={page} totalPages={data?.totalPages ?? 1} total={data?.total ?? 0} limit={data?.limit ?? PAGE_LIMIT} onPage={setPage} />
          </>
        )}
      </div>
    </>
  )
}

// ─── Page ───────────────────────────────────────────────────────────────────────

export default function AdminBulkMessagesPage() {
  const [tab, setTab] = useState<Tab>('campaigns')
  const [view, setView] = useState<View>({ kind: 'list' })
  const { data: summary } = useBulkSummary()

  const tabs: { value: Tab; label: string; count?: number }[] = [
    { value: 'campaigns', label: 'Campaigns' },
    { value: 'templates', label: 'Templates' },
    { value: 'replies', label: 'Replies', count: summary?.unreadReplies },
  ]

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-[28px] leading-[1.3] font-[500] font-sans text-[#0F241D] flex items-center gap-2">
            <Megaphone size={24} aria-hidden="true" /> Bulk Messages
          </h1>
          <p className="text-[14px] font-sans text-[#183D33B3] mt-1">
            Build WhatsApp templates, get them approved by Meta, and send them to registered sellers.
          </p>
        </div>
        {view.kind === 'list' && (
          <div className="flex gap-2 flex-shrink-0">
            <Button variant="secondary" size="sm" onClick={() => setView({ kind: 'template' })}>
              <Plus size={14} aria-hidden="true" /> New template
            </Button>
            <Button size="sm" onClick={() => setView({ kind: 'campaign' })}>
              <Plus size={14} aria-hidden="true" /> New campaign
            </Button>
          </div>
        )}
      </div>

      {view.kind === 'template' && (
        <TemplateWizard
          initial={view.editing}
          onCancel={() => setView({ kind: 'list' })}
          onDone={() => {
            setView({ kind: 'list' })
            setTab('templates')
          }}
        />
      )}
      {view.kind === 'campaign' && <CampaignWizard onCancel={() => setView({ kind: 'list' })} />}

      {view.kind === 'list' && (
        <>
          <div className="flex gap-2 mb-5">
            {tabs.map(({ value, label, count }) => (
              <button
                key={value}
                type="button"
                onClick={() => setTab(value)}
                className={cn(
                  'h-9 px-4 rounded-lg border text-[13px] font-[600] font-sans transition-colors flex items-center gap-2',
                  tab === value
                    ? 'bg-[#183D33] border-[#183D33] text-white'
                    : 'bg-white border-[#D9E2DA] text-[#183D33B3] hover:text-[#0F241D] hover:bg-[#E7EDE7]',
                )}
              >
                {label}
                {count ? (
                  <span className={cn('text-[11px] rounded-full px-1.5 min-w-[18px] text-center', tab === value ? 'bg-white/20' : 'bg-[#E7EDE7]')}>{count}</span>
                ) : null}
              </button>
            ))}
          </div>
          {tab === 'campaigns' && <CampaignsTab onNew={() => setView({ kind: 'campaign' })} />}
          {tab === 'templates' && <TemplatesTab onNew={() => setView({ kind: 'template' })} onEdit={(t) => setView({ kind: 'template', editing: t })} />}
          {tab === 'replies' && <RepliesTab />}
        </>
      )}
    </div>
  )
}
