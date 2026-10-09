'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CheckCircle, Pencil } from 'lucide-react'
import {
  useAdminPayouts,
  useMarkPayoutPaid,
  useUpdatePayoutNotes,
  useBulkMarkPayoutsPaid,
} from '@/hooks/queries/usePayouts'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { EmptyState } from '@/components/shared/EmptyState'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { PayoutStatus } from '@/types'
import type { AdminPayout } from '@/types/brand-admin'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function shortId(id: string) {
  return id.length > 10 ? `${id.slice(0, 8)}…` : id
}

function formatCurrency(amount: number) {
  return `₹${amount.toLocaleString('en-IN')}`
}

function toNum(v: string | number | null | undefined): number | null {
  if (v == null) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function isBrandPayout(p: AdminPayout) {
  return p.seller?.sellerType === 'MARKETPLACE'
}

function formatDate(value: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })
}

const LIMIT = 20

// ─── Row ──────────────────────────────────────────────────────────────────────

function PayoutRow({
  payout,
  showCheckbox,
  selected,
  onToggle,
  onEditNotes,
}: {
  payout: AdminPayout
  showCheckbox: boolean
  selected: boolean
  onToggle: () => void
  onEditNotes: () => void
}) {
  const markPaid = useMarkPayoutPaid()
  const isPending = payout.status === 'PENDING'
  const brand = isBrandPayout(payout)
  const gross = toNum(payout.grossAmount)
  const commissionAmount = toNum(payout.commissionAmount)
  const commissionRate = toNum(payout.commissionRate)

  return (
    <tr className="border-b border-[#E5DCCB] last:border-0 hover:bg-[#F5F0E5]/30 transition-colors">
      <td className="py-3.5 pl-4 pr-2 w-10">
        {showCheckbox && isPending && (
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggle}
            aria-label={`Select payout ${payout.id}`}
            className="w-4 h-4 rounded border-[#E5DCCB] accent-[#183D33] cursor-pointer"
          />
        )}
      </td>
      <td className="py-3.5 px-4">
        <p className="text-[13px] font-[600] font-sans text-[#20201E]" title={payout.orderId}>
          {shortId(payout.orderId)}
        </p>
        <p className="text-[11px] font-sans text-[#665F55] mt-0.5" title={payout.orderItemId}>
          item {shortId(payout.orderItemId)}
        </p>
      </td>
      <td className="py-3.5 px-4 text-[13px] font-sans text-[#665F55]">
        <Link
          href={`/admin/sellers/${payout.sellerId}`}
          className="hover:text-[#20201E] hover:underline underline-offset-2 transition-colors"
          title={payout.sellerId}
        >
          {payout.seller?.brandName ?? payout.seller?.businessName ?? shortId(payout.sellerId)}
        </Link>
        {payout.seller?.sellerType && (
          <span
            className={cn(
              'ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-[600] font-sans align-middle',
              brand ? 'bg-selected text-forest' : 'bg-ivory text-muted',
            )}
          >
            {brand ? 'Marketplace' : 'Curated'}
          </span>
        )}
      </td>
      <td className="py-3.5 px-4 text-right text-[13px] font-sans text-[#20201E] tabular-nums whitespace-nowrap">
        {brand && gross != null ? formatCurrency(gross) : <span className="text-[#665F55]">—</span>}
      </td>
      <td className="py-3.5 px-4 text-right text-[13px] font-sans text-[#20201E] tabular-nums whitespace-nowrap">
        {brand && commissionAmount != null ? (
          <>
            {formatCurrency(commissionAmount)}
            {commissionRate != null && <span className="block text-[11px] text-[#665F55]">{commissionRate}%</span>}
          </>
        ) : <span className="text-[#665F55]">—</span>}
      </td>
      <td className="py-3.5 px-4 text-right text-[13px] font-[600] font-sans text-[#20201E] tabular-nums whitespace-nowrap">
        {formatCurrency(Number(payout.amount))}
      </td>
      <td className="py-3.5 px-4">
        <StatusBadge status={payout.status} />
      </td>
      <td className="py-3.5 px-4 text-[12px] font-sans text-[#665F55] whitespace-nowrap">
        {formatDate(payout.paidAt)}
      </td>
      <td className="py-3.5 px-4 max-w-[220px]">
        <button
          type="button"
          onClick={onEditNotes}
          className="flex items-center gap-1.5 text-left group"
          aria-label="Edit notes"
        >
          <span
            className={cn(
              'text-[12px] font-sans truncate',
              payout.notes ? 'text-[#665F55]' : 'text-[#665F55]/50 italic'
            )}
            title={payout.notes ?? undefined}
          >
            {payout.notes ? (payout.notes.length > 40 ? `${payout.notes.slice(0, 40)}…` : payout.notes) : 'No notes'}
          </span>
          <Pencil size={11} className="shrink-0 text-[#665F55] opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden="true" />
        </button>
      </td>
      <td className="py-3.5 px-4 text-[12px] font-sans text-[#665F55] whitespace-nowrap">
        {formatDate(payout.createdAt)}
      </td>
      <td className="py-3.5 px-4 text-right">
        {isPending && (
          <button
            type="button"
            onClick={() => markPaid.mutate({ id: payout.id })}
            disabled={markPaid.isPending}
            aria-label={`Mark payout ${payout.id} as paid`}
            className={cn(
              'inline-flex items-center gap-1.5 h-7 px-2.5 rounded border text-[11px] font-[600] font-sans transition-colors ml-auto',
              'border-emerald-300 text-emerald-600 bg-emerald-50 hover:bg-emerald-100',
              'disabled:opacity-50'
            )}
          >
            <CheckCircle size={12} aria-hidden="true" />
            Mark Paid
          </button>
        )}
      </td>
    </tr>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminPayoutsPage() {
  const [tab, setTab] = useState<'PENDING' | 'ALL'>('PENDING')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [editingPayout, setEditingPayout] = useState<AdminPayout | null>(null)
  const [noteDraft, setNoteDraft] = useState('')

  const status: PayoutStatus | undefined = tab === 'PENDING' ? 'PENDING' : undefined
  const { data, isLoading } = useAdminPayouts({ status, page, limit: LIMIT })
  const bulkPaid = useBulkMarkPayoutsPaid()
  const updateNotes = useUpdatePayoutNotes()

  const payouts = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = data?.totalPages ?? 1
  const limit = data?.limit ?? LIMIT

  const pendingOnPage = payouts.filter((p) => p.status === 'PENDING')
  const allPendingSelected = pendingOnPage.length > 0 && pendingOnPage.every((p) => selected.has(p.id))

  function switchTab(t: 'PENDING' | 'ALL') {
    setTab(t)
    setPage(1)
    setSelected(new Set())
  }

  function goToPage(p: number) {
    setPage(p)
    setSelected(new Set())
  }

  function toggleAll() {
    setSelected(allPendingSelected ? new Set() : new Set(pendingOnPage.map((p) => p.id)))
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleBulkPaid() {
    bulkPaid.mutate(Array.from(selected), { onSuccess: () => setSelected(new Set()) })
  }

  function openNotes(payout: AdminPayout) {
    setEditingPayout(payout)
    setNoteDraft(payout.notes ?? '')
  }

  function saveNotes() {
    if (!editingPayout) return
    updateNotes.mutate(
      { id: editingPayout.id, notes: noteDraft },
      { onSuccess: () => setEditingPayout(null) }
    )
  }

  const rangeStart = total === 0 ? 0 : (page - 1) * limit + 1
  const rangeEnd = Math.min(page * limit, total)

  return (
    <div>
      <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[28px] leading-[1.3] font-[500] font-sans text-[#20201E]">Payouts</h1>
          <p className="text-[14px] font-sans text-[#665F55] mt-1">
            Manage seller payouts — marked and paid manually
          </p>
        </div>

        {selected.size > 0 && (
          <Button
            variant="accent"
            size="sm"
            onClick={handleBulkPaid}
            disabled={bulkPaid.isPending}
            className="gap-1.5"
          >
            <CheckCircle size={14} aria-hidden="true" />
            Mark {selected.size} Paid
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-[#E5DCCB]">
        {(['PENDING', 'ALL'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => switchTab(t)}
            className={cn(
              'px-4 py-2.5 text-[13px] font-[600] font-sans border-b-2 -mb-px transition-colors',
              tab === t ? 'border-[#183D33] text-[#20201E]' : 'border-transparent text-[#665F55] hover:text-[#20201E]'
            )}
          >
            {t === 'PENDING' ? 'Pending' : 'All'}
          </button>
        ))}
      </div>

      <div className="bg-white border border-[#E5DCCB] rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="divide-y divide-[#E5DCCB]">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="p-4 flex gap-4 animate-pulse">
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 bg-[#F5F0E5] rounded w-24" />
                  <div className="h-3 bg-[#F5F0E5] rounded w-32" />
                </div>
                <div className="h-6 bg-[#F5F0E5] rounded w-16" />
              </div>
            ))}
          </div>
        ) : !payouts.length ? (
          <EmptyState
            title={`No ${tab === 'PENDING' ? 'pending ' : ''}payouts`}
            description="There is nothing to display here at the moment."
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#E5DCCB] bg-[#F5F0E5]/40">
                    <th className="py-3 pl-4 pr-2 w-10">
                      {tab === 'PENDING' && pendingOnPage.length > 0 && (
                        <input
                          type="checkbox"
                          checked={allPendingSelected}
                          onChange={toggleAll}
                          aria-label="Select all pending payouts"
                          className="w-4 h-4 rounded border-[#E5DCCB] accent-[#183D33] cursor-pointer"
                        />
                      )}
                    </th>
                    {['Order', 'Seller', 'Gross', 'Commission', 'Net payout', 'Status', 'Paid', 'Notes', 'Created', ''].map((h) => (
                      <th
                        key={h}
                        className={cn(
                          'py-3 px-4 text-[12px] font-[600] font-sans text-[#665F55] uppercase tracking-[0.06em]',
                          ['Gross', 'Commission', 'Net payout'].includes(h) ? 'text-right' : 'text-left'
                        )}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {payouts.map((p) => (
                    <PayoutRow
                      key={p.id}
                      payout={p}
                      showCheckbox={tab === 'PENDING'}
                      selected={selected.has(p.id)}
                      onToggle={() => toggleOne(p.id)}
                      onEditNotes={() => openNotes(p)}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between px-4 py-3 border-t border-[#E5DCCB]">
              <span className="text-[12px] leading-[1.3] font-[400] font-sans text-[#665F55]">
                Showing {rangeStart}&ndash;{rangeEnd} of {total.toLocaleString()}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => goToPage(Math.max(1, page - 1))}
                  aria-label="Previous page"
                >
                  Prev
                </Button>
                <span className="text-[12px] font-[500] font-sans text-[#665F55] px-2 select-none tabular-nums">
                  {page} / {totalPages}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => goToPage(Math.min(totalPages, page + 1))}
                  aria-label="Next page"
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Notes editor dialog */}
      <Dialog open={!!editingPayout} onOpenChange={(open) => !open && setEditingPayout(null)}>
        <DialogContent className="max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Payout notes</DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-2">
            <textarea
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              rows={5}
              placeholder="Add a note for this payout…"
              className={cn(
                'w-full rounded border border-[#E5DCCB] bg-white px-3 py-2 resize-none',
                'text-[14px] font-sans text-[#20201E] placeholder:text-[#665F55]/60',
                'outline-none focus:ring-1 focus:ring-[#183D33] focus:border-[#183D33] transition-colors'
              )}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setEditingPayout(null)}>
              Cancel
            </Button>
            <Button
              variant="accent"
              size="sm"
              onClick={saveNotes}
              disabled={updateNotes.isPending}
            >
              Save notes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
