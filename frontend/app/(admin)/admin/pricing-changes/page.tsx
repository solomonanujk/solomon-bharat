'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Clock, CalendarDays } from 'lucide-react'
import {
  usePendingPricingChanges,
  useApprovePricingChange,
  useRejectPricingChange,
  type PendingPricingChangeListItem,
} from '@/hooks/queries/useProducts'
import { useChangeRequestPriceForm, TierPriceTable } from '@/components/admin/ProductAdminShared'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'

const LIMIT = 20

// ─── Reject dialog (reason required) ─────────────────────────────────────────

function RejectDialog({ change, onClose }: { change: PendingPricingChangeListItem; onClose: () => void }) {
  const [reason, setReason] = useState('')
  const rejectChange = useRejectPricingChange()
  const trimmed = reason.trim()

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject pricing change</DialogTitle>
          <DialogDescription>
            Rejecting the pricing/variant update for{' '}
            <strong className="text-primary">{change.product.name}</strong>. The live product is left completely
            untouched — the seller will see this reason.
          </DialogDescription>
        </DialogHeader>
        <div className="px-6 pb-2">
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason for rejection (required)…"
            rows={4}
            className="w-full px-3 py-2.5 rounded border border-border-warm bg-bg text-[13.5px] font-public-sans text-primary placeholder:text-muted-text focus:outline-none focus:border-accent transition-colors resize-none"
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            variant="destructive"
            disabled={!trimmed || rejectChange.isPending}
            onClick={() => rejectChange.mutate({ id: change.id, reason: trimmed }, { onSuccess: onClose })}
          >
            {rejectChange.isPending ? 'Rejecting…' : 'Confirm reject'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Pending change card ──────────────────────────────────────────────────────

function PendingChangeCard({ change, onReject }: { change: PendingPricingChangeListItem; onReject: (c: PendingPricingChangeListItem) => void }) {
  const approveChange = useApprovePricingChange()
  const { allTiers, values, setValue, agentValues, setAgentValue, buildPayload, hasAnyPriced } =
    useChangeRequestPriceForm(change)

  return (
    <div className="bg-surface border border-border-warm rounded p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
        <div>
          <Link
            href={`/admin/products/${change.product.id}`}
            className="text-[15px] font-[600] font-public-sans text-primary hover:underline"
          >
            {change.product.name}
          </Link>
          <p className="flex items-center gap-1 text-[12.5px] font-public-sans text-muted-text mt-1">
            <CalendarDays size={11} aria-hidden="true" />
            Submitted {new Date(change.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="accent"
            size="sm"
            disabled={!hasAnyPriced || approveChange.isPending}
            onClick={() => approveChange.mutate({ id: change.id, ...buildPayload() })}
          >
            {approveChange.isPending ? 'Approving…' : 'Approve & apply'}
          </Button>
          <Button variant="destructive" size="sm" onClick={() => onReject(change)}>
            Reject
          </Button>
        </div>
      </div>

      <p className="text-[12px] font-public-sans text-muted-text mb-3">
        Set an admin price (and optionally an agent price) for at least one tier below to approve — buyers keep
        seeing the current live pricing until then.
      </p>
      <TierPriceTable
        tiers={allTiers}
        values={values}
        onChange={setValue}
        agentValues={agentValues}
        onAgentChange={setAgentValue}
        editable
        disabled={approveChange.isPending}
      />
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PricingChangesPage() {
  const [page, setPage] = useState(1)
  const [rejectTarget, setRejectTarget] = useState<PendingPricingChangeListItem | null>(null)

  const { data, isLoading } = usePendingPricingChanges({ page, limit: LIMIT })
  const changes = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = data?.totalPages ?? 1

  return (
    <div>
      <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[28px] leading-[1.3] font-[500] font-playfair text-primary">Pricing Changes</h1>
          <p className="text-[14px] font-public-sans text-muted-text mt-1">
            Sellers&apos; proposed pricing/variant updates on already-live products, awaiting review
          </p>
        </div>
        {total > 0 && (
          <p className="text-[13px] font-public-sans text-muted-text self-end">
            {total.toLocaleString()} pending change{total !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {isLoading ? (
        <div className="grid gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-surface border border-border-warm rounded p-5 animate-pulse">
              <div className="h-4 bg-muted-bg rounded w-40 mb-3" />
              <div className="h-24 bg-muted-bg rounded" />
            </div>
          ))}
        </div>
      ) : changes.length === 0 ? (
        <div className="bg-surface border border-border-warm rounded py-16 flex flex-col items-center gap-3 text-center">
          <div className="w-12 h-12 rounded-full bg-muted-bg flex items-center justify-center">
            <Clock size={22} className="text-muted-text" aria-hidden="true" />
          </div>
          <p className="text-[16px] font-[600] font-public-sans text-primary">No pending pricing changes</p>
          <p className="text-[13px] font-public-sans text-muted-text">
            Sellers&apos; pricing/variant edits to live products will show up here for review.
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {changes.map((change) => (
            <PendingChangeCard key={change.id} change={change} onReject={setRejectTarget} />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-1 py-4">
          <p className="text-[12px] font-public-sans text-muted-text">
            Page {page} of {totalPages} &middot; {total.toLocaleString()} total
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="h-8 px-3 rounded border border-border-warm text-[12px] font-[500] font-public-sans text-muted-text hover:text-primary hover:bg-muted-bg disabled:opacity-40 transition-colors"
            >
              Prev
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="h-8 px-3 rounded border border-border-warm text-[12px] font-[500] font-public-sans text-muted-text hover:text-primary hover:bg-muted-bg disabled:opacity-40 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {rejectTarget && <RejectDialog change={rejectTarget} onClose={() => setRejectTarget(null)} />}
    </div>
  )
}
