'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Download } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { EmptyState } from '@/components/shared/EmptyState'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Pager, Skeleton, Table, cell, formatDateTime, timeAgo } from '@/components/admin/AdminTable'
import { WhatsAppPreview } from '@/components/admin/bulk/WhatsAppPreview'
import {
  downloadBulkCampaignCsv,
  useBulkCampaign,
  useBulkCampaignAction,
  useBulkRecipients,
  useBulkReplies,
  useMarkBulkRepliesRead,
  type BulkRecipientStatus,
} from '@/hooks/queries/useBulkMessages'
import { cn } from '@/lib/utils'

const PAGE_LIMIT = 20

const STATUS_FILTERS: { value: BulkRecipientStatus | ''; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'QUEUED', label: 'Queued' },
  { value: 'SENT', label: 'Sent' },
  { value: 'DELIVERED', label: 'Delivered' },
  { value: 'READ', label: 'Read' },
  { value: 'FAILED', label: 'Failed' },
]

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'error' }) {
  return (
    <div className="bg-white border border-[#D9E2DA] rounded-xl px-4 py-3">
      <p className="text-[11px] font-[600] font-sans text-[#183D33B3] uppercase tracking-[0.06em]">{label}</p>
      <p className={cn('text-[22px] font-[500] font-sans mt-0.5', tone === 'error' && value > 0 ? 'text-error' : 'text-[#0F241D]')}>{value.toLocaleString()}</p>
    </div>
  )
}

export default function BulkCampaignPage() {
  const { id } = useParams<{ id: string }>()
  const { data: campaign, isLoading } = useBulkCampaign(id)
  const action = useBulkCampaignAction()
  const markRead = useMarkBulkRepliesRead()
  const [status, setStatus] = useState<BulkRecipientStatus | ''>('')
  const [page, setPage] = useState(1)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [exporting, setExporting] = useState(false)

  const recipients = useBulkRecipients(id, { status: status || undefined, page, limit: PAGE_LIMIT })
  const replies = useBulkReplies({ campaignId: id, limit: 5 })

  if (isLoading || !campaign) {
    return (
      <div className="bg-white border border-[#D9E2DA] rounded-xl overflow-hidden">
        <Skeleton />
      </div>
    )
  }

  const s = campaign.summary ?? { queued: 0, sent: 0, delivered: 0, read: 0, failed: 0, accepted: 0 }
  const done = s.accepted + s.failed
  const canCancel = ['DRAFT', 'RUNNING', 'PAUSED'].includes(campaign.status)

  async function exportCsv() {
    setExporting(true)
    try {
      await downloadBulkCampaignCsv(id)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not prepare the report')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/bulk-messages" className="inline-flex items-center gap-1 text-[13px] font-[600] font-sans text-[#183D33B3] hover:text-[#0F241D] mb-3">
          <ArrowLeft size={14} aria-hidden="true" /> Bulk Messages
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-[26px] leading-[1.3] font-[500] font-sans text-[#0F241D] flex items-center gap-3">
              {campaign.name} <StatusBadge status={campaign.status} />
            </h1>
            <p className="text-[13px] font-sans text-[#183D33B3] mt-1">
              Template {campaign.template.name}
              {campaign.startedAt ? `, started ${formatDateTime(campaign.startedAt)}` : ''}
              {campaign.completedAt ? `, finished ${formatDateTime(campaign.completedAt)}` : ''}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {campaign.status === 'DRAFT' && (
              <Button size="sm" onClick={() => action.mutate({ id, action: 'start' })} loading={action.isPending}>
                Start sending
              </Button>
            )}
            {campaign.status === 'RUNNING' && (
              <Button variant="secondary" size="sm" onClick={() => action.mutate({ id, action: 'pause' })} loading={action.isPending}>
                Pause
              </Button>
            )}
            {campaign.status === 'PAUSED' && (
              <Button size="sm" onClick={() => action.mutate({ id, action: 'resume' })} loading={action.isPending}>
                Resume
              </Button>
            )}
            {canCancel && (
              <Button variant="destructive" size="sm" onClick={() => setCancelOpen(true)}>
                Cancel campaign
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => void exportCsv()} loading={exporting}>
              <Download size={14} aria-hidden="true" /> Report (CSV)
            </Button>
          </div>
        </div>
      </div>

      <div className="bg-white border border-[#D9E2DA] rounded-xl p-4">
        <div className="h-2 bg-[#E7EDE7] rounded-full overflow-hidden">
          <div className="h-full bg-[#183D33] transition-all" style={{ width: `${campaign.totalCount ? Math.min(100, (done / campaign.totalCount) * 100) : 0}%` }} />
        </div>
        <p className="text-[12px] font-sans text-[#183D33B3] mt-2">
          {done.toLocaleString()} of {campaign.totalCount.toLocaleString()} processed
          {campaign.skippedCount > 0 ? `. ${campaign.skippedCount.toLocaleString()} sellers were left out when the audience was built (no linked number, opted out, suspended or unmatched).` : ''}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Stat label="Queued" value={s.queued} />
        <Stat label="Sent" value={s.sent} />
        <Stat label="Delivered" value={s.delivered} />
        <Stat label="Read" value={s.read} />
        <Stat label="Failed" value={s.failed} tone="error" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-6">
        <div className="space-y-6 min-w-0">
          <section>
            <h2 className="text-[16px] font-[600] font-sans text-[#0F241D] mb-3">Sellers</h2>
            <div className="flex gap-1 mb-3 border-b border-[#D9E2DA] overflow-x-auto">
              {STATUS_FILTERS.map(({ value, label }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => {
                    setStatus(value)
                    setPage(1)
                  }}
                  className={cn(
                    'px-4 py-2 text-[13px] font-[600] font-sans border-b-2 -mb-px transition-colors whitespace-nowrap',
                    status === value ? 'border-[#183D33] text-[#0F241D]' : 'border-transparent text-[#183D33B3] hover:text-[#0F241D]',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="bg-white border border-[#D9E2DA] rounded-xl overflow-hidden">
              {recipients.isLoading ? (
                <Skeleton />
              ) : (recipients.data?.items.length ?? 0) === 0 ? (
                <EmptyState title="Nobody here" description="No sellers have this status yet." />
              ) : (
                <>
                  <Table heads={['Seller', 'Number', 'Status', 'Sent', 'Problem']}>
                    {recipients.data!.items.map((r) => (
                      <tr key={r.id} className="border-b border-[#D9E2DA] last:border-0 align-top">
                        <td className={cn(cell, 'text-[#0F241D] font-[600]')}>{r.seller.businessName}</td>
                        <td className={cell}>{r.phone}</td>
                        <td className="py-3 px-4">
                          <StatusBadge status={r.status} />
                        </td>
                        <td className={cn(cell, 'whitespace-nowrap')}>{r.sentAt ? formatDateTime(r.sentAt) : '—'}</td>
                        <td className={cn(cell, 'max-w-[280px] break-words text-error')}>
                          {r.status === 'FAILED' ? `${r.errorCode ? `${r.errorCode}: ` : ''}${r.errorMessage ?? 'Not delivered'}` : ''}
                        </td>
                      </tr>
                    ))}
                  </Table>
                  <Pager
                    page={page}
                    totalPages={recipients.data?.totalPages ?? 1}
                    total={recipients.data?.total ?? 0}
                    limit={recipients.data?.limit ?? PAGE_LIMIT}
                    onPage={setPage}
                  />
                </>
              )}
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[16px] font-[600] font-sans text-[#0F241D]">Replies</h2>
              <Button variant="ghost" size="sm" onClick={() => markRead.mutate({ campaignId: id })} disabled={markRead.isPending}>
                Mark all as read
              </Button>
            </div>
            <div className="bg-white border border-[#D9E2DA] rounded-xl divide-y divide-[#D9E2DA]">
              {(replies.data?.items ?? []).length === 0 ? (
                <p className="px-4 py-4 text-[13px] font-sans text-[#183D33B3]">No replies to this campaign yet.</p>
              ) : (
                replies.data!.items.map((r) => (
                  <div key={r.id} className={cn('px-4 py-3', !r.readByAdminAt && 'bg-[#E7EDE7]/40')}>
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[13px] font-[600] font-sans text-[#0F241D]">{r.recipient.seller.businessName}</p>
                      <p className="text-[11px] font-sans text-[#183D33B3]">{timeAgo(r.receivedAt)}</p>
                    </div>
                    <p className="text-[13px] font-sans text-[#0F241D] whitespace-pre-wrap break-words mt-0.5">
                      {r.text || (r.type === 'media' ? 'Sent a photo or file' : '—')}
                    </p>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        <aside>
          <h2 className="text-[16px] font-[600] font-sans text-[#0F241D] mb-3">Message</h2>
          <WhatsAppPreview
            headerText={campaign.template.headerText}
            body={campaign.template.body}
            footer={campaign.template.footer}
            buttons={campaign.template.buttons}
            values={campaign.template.variableExamples}
          />
          <p className="text-[11px] font-sans text-[#183D33B3] mt-2">Variables show the template&apos;s examples. Each seller got their own values.</p>
        </aside>
      </div>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="max-w-[460px]">
          <DialogHeader>
            <DialogTitle>Cancel this campaign?</DialogTitle>
            <DialogDescription>
              Sending stops now. Sellers who have not been messaged yet are marked as failed and will not get it. Messages already sent cannot be taken back.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setCancelOpen(false)}>
              Keep it
            </Button>
            <Button
              variant="destructive"
              size="sm"
              loading={action.isPending}
              onClick={() => action.mutate({ id, action: 'cancel' }, { onSettled: () => setCancelOpen(false) })}
            >
              Cancel campaign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
