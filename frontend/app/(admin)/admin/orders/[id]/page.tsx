'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft,
  ExternalLink,
  FileText,
  Loader2,
  Plus,
  Send,
  ShoppingBag,
  X,
} from 'lucide-react'
import {
  useAdminOrder,
  useCancelOrder,
  useCollectOrder,
  useConfirmOrder,
  useDeliverOrder,
  useProcureOrder,
  useShipOrder,
  useUpdateTracking,
  useAttachExportDocuments,
} from '@/hooks/queries/useOrders'
import { useBuyerMessages, useSendAdminMessage } from '@/hooks/queries/useMessages'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { cn, formatCurrency } from '@/lib/utils'
import type { OrderStatus } from '@/types'

// ─── Lifecycle map ────────────────────────────────────────────────────────────
// Only the single "next step" action is offered for a given status — no
// disputes/returns/refunds anywhere. Cancel is offered separately, from any
// non-terminal state.

type LifecycleAction = 'confirm' | 'procure' | 'collect' | 'ship' | 'deliver'

const NEXT_ACTION: Partial<Record<OrderStatus, { action: LifecycleAction; label: string }>> = {
  PAYMENT_RECEIVED: { action: 'confirm', label: 'Confirm Order' },
  CONFIRMED: { action: 'procure', label: 'Start Procurement' },
  PROCURING: { action: 'collect', label: 'Mark Collected' },
  COLLECTED: { action: 'ship', label: 'Mark In Transit' },
  IN_TRANSIT: { action: 'deliver', label: 'Mark Delivered' },
}

const CANCELLABLE_STATUSES: OrderStatus[] = [
  'PENDING_PAYMENT',
  'PAYMENT_RECEIVED',
  'CONFIRMED',
  'PROCURING',
  'COLLECTED',
  'IN_TRANSIT',
]

function shortId(id: string) {
  return id.slice(-8).toUpperCase()
}

function formatDate(value: string | null | undefined, opts?: Intl.DateTimeFormatOptions) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-IN', opts ?? { day: 'numeric', month: 'short', year: 'numeric' })
}

// ─── Shared card pieces ───────────────────────────────────────────────────────

function InfoCard({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="bg-surface border border-border-warm rounded overflow-hidden">
      <div className="px-5 py-3.5 border-b border-border-warm bg-muted-bg/40 flex items-center justify-between gap-3">
        <h3 className="text-[12px] font-[600] font-public-sans text-muted-text uppercase tracking-[0.06em]">{title}</h3>
        {action}
      </div>
      <div className="px-5 py-4 space-y-3.5">{children}</div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value?: React.ReactNode }) {
  if (value === undefined || value === null || value === '') return null
  return (
    <div>
      <p className="text-[11px] font-[600] font-public-sans text-muted-text uppercase tracking-[0.06em] mb-0.5">{label}</p>
      <div className="text-[14px] font-public-sans text-primary leading-[1.5]">{value}</div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminOrderDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const id = params.id

  const { data: order, isLoading, isError } = useAdminOrder(id)

  const confirmOrder = useConfirmOrder()
  const procureOrder = useProcureOrder()
  const collectOrder = useCollectOrder()
  const shipOrder = useShipOrder()
  const deliverOrder = useDeliverOrder()
  const cancelOrder = useCancelOrder()
  const updateTracking = useUpdateTracking()
  const attachDocs = useAttachExportDocuments()

  // ── Dialog state for actions that need input ──────────────────────────────
  const [procureDialogOpen, setProcureDialogOpen] = useState(false)
  const [expectedCollectionDate, setExpectedCollectionDate] = useState('')
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState('')

  // ── Tracking number field ──────────────────────────────────────────────────
  const [trackingInput, setTrackingInput] = useState('')
  useEffect(() => {
    setTrackingInput(order?.trackingNumber ?? '')
  }, [order?.trackingNumber])

  // ── Export documents ────────────────────────────────────────────────────────
  const [docs, setDocs] = useState<string[]>([])
  const [newDocUrl, setNewDocUrl] = useState('')
  useEffect(() => {
    setDocs(order?.exportDocuments ?? [])
  }, [order?.exportDocuments])
  const docsDirty = useMemo(
    () => JSON.stringify(docs) !== JSON.stringify(order?.exportDocuments ?? []),
    [docs, order?.exportDocuments]
  )

  // ── Buyer messages ──────────────────────────────────────────────────────────
  const { data: messages = [], isLoading: messagesLoading } = useBuyerMessages(order?.buyerId ?? null)
  const sendMessage = useSendAdminMessage()
  const [messageBody, setMessageBody] = useState('')

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto animate-pulse space-y-5">
        <div className="h-5 bg-muted-bg rounded w-24" />
        <div className="h-32 bg-surface border border-border-warm rounded" />
        <div className="h-48 bg-surface border border-border-warm rounded" />
      </div>
    )
  }

  if (!order || isError) {
    return (
      <div className="max-w-4xl mx-auto">
        <button
          type="button"
          onClick={() => router.push('/admin/orders')}
          className="flex items-center gap-1.5 text-[13px] font-public-sans text-muted-text hover:text-primary mb-6 transition-colors"
        >
          <ArrowLeft size={14} /> Back to orders
        </button>
        <div className="bg-surface border border-border-warm rounded py-20 flex flex-col items-center gap-3">
          <ShoppingBag size={28} className="text-border-warm" aria-hidden="true" />
          <p className="text-[15px] font-[600] font-public-sans text-primary">
            {isError ? 'Failed to load order — check that the backend is running' : 'Order not found'}
          </p>
          <p className="text-[12px] font-public-sans text-muted-text">ID: {id}</p>
        </div>
      </div>
    )
  }

  const nextAction = NEXT_ACTION[order.status]
  const canCancel = CANCELLABLE_STATUSES.includes(order.status)
  const anyActionPending =
    confirmOrder.isPending ||
    procureOrder.isPending ||
    collectOrder.isPending ||
    shipOrder.isPending ||
    deliverOrder.isPending ||
    cancelOrder.isPending

  function runNextAction() {
    if (!nextAction) return
    switch (nextAction.action) {
      case 'confirm':
        confirmOrder.mutate({ id })
        break
      case 'procure':
        setProcureDialogOpen(true)
        break
      case 'collect':
        collectOrder.mutate({ id })
        break
      case 'ship':
        shipOrder.mutate({ id })
        break
      case 'deliver':
        deliverOrder.mutate({ id })
        break
    }
  }

  function submitProcure() {
    procureOrder.mutate(
      { id, body: expectedCollectionDate ? { expectedCollectionDate } : undefined },
      { onSuccess: () => setProcureDialogOpen(false) }
    )
  }

  function submitCancel() {
    if (!cancelReason.trim()) return
    cancelOrder.mutate({ id, body: { reason: cancelReason.trim() } }, { onSuccess: () => setCancelDialogOpen(false) })
  }

  function saveTracking() {
    updateTracking.mutate({ id, trackingNumber: trackingInput.trim() })
  }

  function addDocUrl() {
    const url = newDocUrl.trim()
    if (!url) return
    setDocs((prev) => [...prev, url])
    setNewDocUrl('')
  }

  function removeDocUrl(url: string) {
    setDocs((prev) => prev.filter((d) => d !== url))
  }

  function saveDocs() {
    attachDocs.mutate({ id, documents: docs })
  }

  function submitMessage() {
    const buyerId = order?.buyerId
    if (!buyerId || !messageBody.trim()) return
    sendMessage.mutate({ buyerId, body: messageBody.trim() }, { onSuccess: () => setMessageBody('') })
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Back */}
      <button
        type="button"
        onClick={() => router.push('/admin/orders')}
        className="flex items-center gap-1.5 text-[13px] font-public-sans text-muted-text hover:text-primary mb-6 transition-colors"
      >
        <ArrowLeft size={14} /> Back to orders
      </button>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-[28px] leading-[1.3] font-[500] font-playfair text-primary">Order #{shortId(order.id)}</h1>
            <StatusBadge status={order.status} />
          </div>
          <p className="text-[14px] font-public-sans text-muted-text mt-1">
            Placed {formatDate(order.createdAt, { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>

        {/* Lifecycle actions */}
        <div className="flex items-center gap-2.5">
          {nextAction && (
            <Button variant="accent" size="sm" onClick={runNextAction} disabled={anyActionPending}>
              {anyActionPending ? 'Working…' : nextAction.label}
            </Button>
          )}
          {canCancel && (
            <Button variant="destructive" size="sm" onClick={() => setCancelDialogOpen(true)} disabled={anyActionPending}>
              Cancel Order
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-5">
        {/* Order summary */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <InfoCard title="Order Summary">
            <InfoRow label="Admin Price Total" value={formatCurrency(order.adminPriceTotal)} />
            {order.sellerPriceTotal != null && <InfoRow label="Seller Price Total" value={formatCurrency(order.sellerPriceTotal)} />}
            {order.adminMargin != null && <InfoRow label="Admin Margin" value={formatCurrency(order.adminMargin)} />}
            <InfoRow label="Expected Collection Date" value={formatDate(order.expectedCollectionDate)} />
            {order.status === 'CANCELLED' && (
              <InfoRow
                label="Cancellation Reason"
                value={<span className="text-error">{order.cancelledReason ?? '—'}</span>}
              />
            )}
          </InfoCard>

          <InfoCard title="Timeline">
            <InfoRow label="Buyer ID" value={<span className="font-mono text-[13px]">{order.buyerId}</span>} />
            <InfoRow label="Created" value={formatDate(order.createdAt, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })} />
            <InfoRow label="Last Updated" value={formatDate(order.updatedAt, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })} />
          </InfoCard>
        </div>

        {/* Line items */}
        <InfoCard title={`Line Items (${order.items.length})`}>
          <div className="-mx-5 -mb-4 overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border-warm bg-muted-bg/40">
                  {['Product', 'Qty', 'Unit Price', 'Line Total', 'Seller Unit', 'Seller Line'].map((h) => (
                    <th
                      key={h}
                      className={cn(
                        'py-2.5 px-4 text-[11px] font-[600] font-public-sans text-muted-text uppercase tracking-[0.06em]',
                        h === 'Product' ? 'text-left' : 'text-right'
                      )}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {order.items.map((item) => (
                  <tr key={item.id} className="border-b border-border-warm last:border-0">
                    <td className="py-3 px-4 text-[13px] font-public-sans text-primary">
                      {item.productName ?? item.productId}
                    </td>
                    <td className="py-3 px-4 text-[13px] font-public-sans text-muted-text text-right tabular-nums">
                      {item.quantity}
                    </td>
                    <td className="py-3 px-4 text-[13px] font-public-sans text-muted-text text-right tabular-nums">
                      {formatCurrency(item.unitAdminPrice)}
                    </td>
                    <td className="py-3 px-4 text-[13px] font-[600] font-public-sans text-primary text-right tabular-nums">
                      {formatCurrency(item.lineAdminTotal)}
                    </td>
                    <td className="py-3 px-4 text-[13px] font-public-sans text-muted-text text-right tabular-nums">
                      {item.unitSellerPrice != null ? formatCurrency(item.unitSellerPrice) : '—'}
                    </td>
                    <td className="py-3 px-4 text-[13px] font-public-sans text-muted-text text-right tabular-nums">
                      {item.lineSellerTotal != null ? formatCurrency(item.lineSellerTotal) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </InfoCard>

        {/* Tracking number */}
        <InfoCard title="Tracking Number">
          <div className="flex items-center gap-2.5">
            <input
              type="text"
              value={trackingInput}
              onChange={(e) => setTrackingInput(e.target.value)}
              placeholder="Enter tracking number…"
              className="flex-1 h-9 px-3 rounded border border-border-warm bg-surface text-[14px] font-public-sans text-primary placeholder:text-muted-text focus:outline-none focus:border-primary/40 transition-colors"
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={saveTracking}
              disabled={updateTracking.isPending || trackingInput.trim() === (order.trackingNumber ?? '')}
            >
              {updateTracking.isPending ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </InfoCard>

        {/* Export documents */}
        <InfoCard title="Export Documents">
          <div className="space-y-2">
            {docs.length === 0 ? (
              <p className="text-[13px] font-public-sans text-muted-text">No export documents attached yet.</p>
            ) : (
              <ul className="space-y-1.5">
                {docs.map((url) => (
                  <li key={url} className="flex items-center justify-between gap-2 px-3 py-2 rounded border border-border-warm bg-muted-bg/30">
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 text-[13px] font-public-sans text-accent hover:underline truncate"
                    >
                      <FileText size={13} className="shrink-0" aria-hidden="true" />
                      <span className="truncate">{url}</span>
                      <ExternalLink size={11} className="shrink-0" aria-hidden="true" />
                    </a>
                    <button
                      type="button"
                      onClick={() => removeDocUrl(url)}
                      className="text-muted-text hover:text-error transition-colors shrink-0"
                      aria-label="Remove document"
                    >
                      <X size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex items-center gap-2.5 pt-1">
            <input
              type="url"
              value={newDocUrl}
              onChange={(e) => setNewDocUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addDocUrl()
                }
              }}
              placeholder="https://…"
              className="flex-1 h-9 px-3 rounded border border-border-warm bg-surface text-[14px] font-public-sans text-primary placeholder:text-muted-text focus:outline-none focus:border-primary/40 transition-colors"
            />
            <Button variant="ghost" size="sm" onClick={addDocUrl} className="gap-1">
              <Plus size={13} aria-hidden="true" />
              Add
            </Button>
          </div>

          {docsDirty && (
            <div className="flex justify-end pt-1">
              <Button variant="accent" size="sm" onClick={saveDocs} disabled={attachDocs.isPending}>
                {attachDocs.isPending ? 'Saving…' : 'Save Documents'}
              </Button>
            </div>
          )}
        </InfoCard>

        {/* Buyer messages */}
        <InfoCard title="Contact Buyer">
          <div className="space-y-3">
            <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
              {messagesLoading ? (
                <p className="text-[13px] font-public-sans text-muted-text">Loading conversation…</p>
              ) : messages.length === 0 ? (
                <p className="text-[13px] font-public-sans text-muted-text">No messages with this buyer yet.</p>
              ) : (
                messages.map((m) => (
                  <div
                    key={m.id}
                    className={cn(
                      'max-w-[80%] rounded px-3 py-2',
                      m.sender === 'ADMIN' ? 'ml-auto bg-primary text-white' : 'bg-muted-bg text-primary'
                    )}
                  >
                    <p className="text-[13px] font-public-sans whitespace-pre-wrap">{m.body}</p>
                    <p
                      className={cn(
                        'text-[10px] font-public-sans mt-1',
                        m.sender === 'ADMIN' ? 'text-white/60' : 'text-muted-text'
                      )}
                    >
                      {formatDate(m.createdAt, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                ))
              )}
            </div>

            <div className="flex items-end gap-2.5 pt-2 border-t border-border-warm">
              <textarea
                value={messageBody}
                onChange={(e) => setMessageBody(e.target.value)}
                placeholder="Reply to buyer…"
                rows={2}
                className="flex-1 px-3 py-2 rounded border border-border-warm bg-surface text-[14px] font-public-sans text-primary placeholder:text-muted-text focus:outline-none focus:border-primary/40 transition-colors resize-none"
              />
              <Button
                variant="accent"
                size="sm"
                onClick={submitMessage}
                disabled={sendMessage.isPending || !messageBody.trim()}
                className="gap-1.5"
              >
                {sendMessage.isPending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} aria-hidden="true" />}
                Send
              </Button>
            </div>
          </div>
        </InfoCard>
      </div>

      {/* Procure dialog */}
      <Dialog open={procureDialogOpen} onOpenChange={setProcureDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start Procurement</DialogTitle>
            <DialogDescription>
              Optionally set an expected collection date for this order&apos;s goods from the seller.
            </DialogDescription>
          </DialogHeader>
          <div className="px-6 pb-2">
            <label className="text-[12px] font-[600] font-public-sans text-muted-text uppercase tracking-[0.06em]">
              Expected Collection Date
            </label>
            <input
              type="date"
              value={expectedCollectionDate}
              onChange={(e) => setExpectedCollectionDate(e.target.value)}
              className="mt-1.5 w-full h-10 px-3 rounded border border-border-warm bg-surface text-[14px] font-public-sans text-primary focus:outline-none focus:border-primary/40 transition-colors"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setProcureDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="accent" onClick={submitProcure} disabled={procureOrder.isPending}>
              {procureOrder.isPending ? 'Starting…' : 'Start Procurement'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Order</DialogTitle>
            <DialogDescription>
              This cannot be undone. Provide a reason — it will be shown as the order&apos;s cancellation reason.
            </DialogDescription>
          </DialogHeader>
          <div className="px-6 pb-2">
            <label className="text-[12px] font-[600] font-public-sans text-muted-text uppercase tracking-[0.06em]">
              Reason<span className="text-error ml-0.5">*</span>
            </label>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              rows={3}
              placeholder="Why is this order being cancelled?"
              className="mt-1.5 w-full px-3 py-2 rounded border border-border-warm bg-surface text-[14px] font-public-sans text-primary placeholder:text-muted-text focus:outline-none focus:border-primary/40 transition-colors resize-none"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCancelDialogOpen(false)}>
              Back
            </Button>
            <Button variant="destructive" onClick={submitCancel} disabled={cancelOrder.isPending || !cancelReason.trim()}>
              {cancelOrder.isPending ? 'Cancelling…' : 'Confirm Cancel'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
