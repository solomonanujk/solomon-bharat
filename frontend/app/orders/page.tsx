'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Download, MessageCircle, Truck, Copy, Star, ImagePlus, X } from 'lucide-react'
import { toast } from 'sonner'
import { AccountPageWrapper } from '@/components/shared/AccountPageWrapper'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/shared/EmptyState'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
} from '@/components/ui/sheet'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { useMyOrders, useMyOrder } from '@/hooks/queries/useOrders'
import { useInvoice } from '@/hooks/queries/usePayments'
import { useSubmitReview } from '@/hooks/queries/useReviews'
import { useFormatPrice } from '@/components/ui/Price'
import type { Order, OrderItem, OrderStatus } from '@/types'

// No "Return" or "Dispute" action anywhere on this page — all sales are
// final (AGENTS.md). Filter tabs mirror the real OrderStatus enum exactly;
// there is no DISPUTED status on this product.

type FilterTab = 'ALL' | OrderStatus

const FILTER_TABS: FilterTab[] = [
  'ALL',
  'PENDING_PAYMENT',
  'PAYMENT_RECEIVED',
  'CONFIRMED',
  'PROCURING',
  'COLLECTED',
  'IN_TRANSIT',
  'DELIVERED',
  'CANCELLED',
]

const TAB_LABELS: Record<FilterTab, string> = {
  ALL: 'All',
  PENDING_PAYMENT: 'Pending Payment',
  PAYMENT_RECEIVED: 'Payment Received',
  CONFIRMED: 'Confirmed',
  PROCURING: 'Procuring',
  COLLECTED: 'Collected',
  IN_TRANSIT: 'In Transit',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function orderRef(id: string) {
  return `#${id.slice(0, 8).toUpperCase()}`
}

function orderTotalItems(order: Order) {
  return order.items?.reduce((sum, i) => sum + i.quantity, 0) ?? 0
}

// ─── Shared actions ───────────────────────────────────────────────────────────

function DownloadInvoiceButton({ orderId, size = 'sm' as const }: { orderId: string; size?: 'sm' | 'md' }) {
  const [requested, setRequested] = useState(false)
  const { data: invoice, isFetching } = useInvoice(requested ? orderId : null)

  useEffect(() => {
    if (!requested || !invoice) return
    const lines = [
      `Solomon Bharat — Invoice ${invoice.invoiceNumber}`,
      `Order: ${invoice.orderId}`,
      `Issued: ${formatDate(invoice.issuedAt)}`,
      `Sold by: ${invoice.soldBy}`,
      `Billed to: ${invoice.buyerEmail}`,
      '',
      ...invoice.items.map(
        (i) => `${i.productName}  x${i.quantity}  @ ${i.unitPrice}  =  ${i.lineTotal}`
      ),
      '',
      `Total: ${invoice.currency} ${invoice.total}`,
    ].join('\n')
    const blob = new Blob([lines], { type: 'text/plain;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `invoice-${invoice.invoiceNumber}.txt`
    a.click()
    URL.revokeObjectURL(url)
    setRequested(false)
  }, [invoice, requested])

  return (
    <Button
      variant="ghost"
      size={size}
      className="gap-1.5"
      onClick={(e) => { e.stopPropagation(); setRequested(true) }}
      disabled={isFetching}
    >
      <Download size={size === 'sm' ? 12 : 13} aria-hidden="true" />
      {isFetching ? 'Preparing…' : 'Invoice'}
    </Button>
  )
}

function TrackShipmentButton({ trackingNumber, size = 'sm' as const }: { trackingNumber: string | null; size?: 'sm' | 'md' }) {
  function handleClick(e: React.MouseEvent) {
    e.stopPropagation()
    if (!trackingNumber) {
      toast.info('Not yet dispatched', { description: 'Tracking details appear once the order ships.' })
      return
    }
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(trackingNumber).catch(() => {})
    }
    toast.success('Tracking number copied', { description: trackingNumber })
  }

  return (
    <Button variant="ghost" size={size} className="gap-1.5" onClick={handleClick}>
      <Truck size={size === 'sm' ? 12 : 13} aria-hidden="true" />
      Track
    </Button>
  )
}

// ─── Rate product ─────────────────────────────────────────────────────────────
// Only shown for delivered, not-yet-reviewed order items — one review per
// purchased line item, submitted anonymously (no reviewer identity is ever shown).

const MAX_REVIEW_PHOTOS = 5

function RateProductDialog({
  productName,
  orderItemId,
  open,
  onClose,
}: {
  productName: string
  orderItemId: string
  open: boolean
  onClose: () => void
}) {
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [comment, setComment] = useState('')
  const [photos, setPhotos] = useState<File[]>([])
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([])
  const submitReview = useSubmitReview()

  // Object URLs are created once per `photos` change and revoked on the
  // next change / unmount, instead of being recreated on every render.
  useEffect(() => {
    const urls = photos.map((f) => URL.createObjectURL(f))
    setPhotoPreviews(urls)
    return () => { urls.forEach((u) => URL.revokeObjectURL(u)) }
  }, [photos])

  function reset() {
    setRating(0)
    setComment('')
    setPhotos([])
  }

  function handleClose() {
    reset()
    onClose()
  }

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (files.length === 0) return
    setPhotos((prev) => {
      const combined = [...prev, ...files]
      if (combined.length > MAX_REVIEW_PHOTOS) {
        toast.error(`You can attach up to ${MAX_REVIEW_PHOTOS} photos`)
        return combined.slice(0, MAX_REVIEW_PHOTOS)
      }
      return combined
    })
  }

  function removePhoto(index: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== index))
  }

  function handleSubmit() {
    if (rating === 0) {
      toast.error('Please select a star rating')
      return
    }
    submitReview.mutate(
      { orderItemId, rating, comment: comment.trim() || undefined, images: photos },
      { onSuccess: () => { handleClose() } }
    )
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rate {productName}</DialogTitle>
        </DialogHeader>

        <div className="py-4 flex flex-col gap-4">
          <div className="flex items-center gap-1" onMouseLeave={() => setHoverRating(0)}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                onMouseEnter={() => setHoverRating(n)}
                aria-label={`${n} star${n === 1 ? '' : 's'}`}
                className="p-0.5"
              >
                <Star
                  size={26}
                  className={(hoverRating || rating) >= n ? 'text-accent' : 'text-border-warm'}
                  fill={(hoverRating || rating) >= n ? 'currentColor' : 'none'}
                />
              </button>
            ))}
          </div>

          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Share your experience with this product (optional)"
            rows={4}
            maxLength={2000}
            className="w-full rounded border border-border-warm bg-surface px-3 py-2 text-[14px] font-public-sans text-primary placeholder:text-muted-text/60 outline-none focus:ring-1 focus:ring-accent focus:border-accent transition-colors resize-none"
          />

          <div>
            <p className="text-[12px] font-[600] font-public-sans text-muted-text uppercase tracking-[0.05em] mb-2">
              Photos (optional)
            </p>
            <div className="flex flex-wrap gap-2">
              {photoPreviews.map((previewUrl, i) => (
                <div key={i} className="relative w-16 h-16 rounded-md overflow-hidden bg-muted-bg flex-shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={previewUrl} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removePhoto(i)}
                    aria-label="Remove photo"
                    className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-black/80 transition-colors"
                  >
                    <X size={11} aria-hidden="true" />
                  </button>
                </div>
              ))}
              {photos.length < MAX_REVIEW_PHOTOS && (
                <label className="w-16 h-16 rounded-md border border-dashed border-border-warm flex flex-col items-center justify-center gap-1 text-muted-text hover:text-primary hover:border-primary transition-colors cursor-pointer">
                  <ImagePlus size={16} aria-hidden="true" />
                  <span className="text-[10px] font-public-sans">Add</span>
                  <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={handlePhotoSelect} />
                </label>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={handleClose}>Cancel</Button>
          <Button variant="primary" onClick={handleSubmit} disabled={submitReview.isPending}>
            {submitReview.isPending ? 'Submitting…' : 'Submit Review'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function RateProductButton({ item, orderStatus }: { item: OrderItem; orderStatus: OrderStatus }) {
  const [open, setOpen] = useState(false)

  if (orderStatus !== 'DELIVERED' || item.reviewed) return null

  return (
    <>
      <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
        <Star size={12} aria-hidden="true" />
        Rate
      </Button>
      <RateProductDialog
        productName={item.productName ?? 'this product'}
        orderItemId={item.id}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  )
}

// ─── Detail sheet ─────────────────────────────────────────────────────────────

function OrderDetailSheet({
  orderId,
  open,
  onClose,
}: {
  orderId: string | null
  open: boolean
  onClose: () => void
}) {
  const fmt = useFormatPrice()
  const { data: order, isLoading } = useMyOrder(orderId)

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <SheetContent side="right" className="overflow-y-auto flex flex-col">
        <SheetHeader>
          <SheetTitle>{order ? `Order ${orderRef(order.id)}` : 'Order Details'}</SheetTitle>
          <SheetClose />
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {isLoading && (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex gap-3 animate-pulse">
                  <div className="w-12 h-12 rounded bg-muted-bg flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-muted-bg rounded w-3/4" />
                    <div className="h-3 bg-muted-bg rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {order && (
            <>
              <div className="flex items-center justify-between">
                <StatusBadge status={order.status} />
                <span className="text-[12px] font-public-sans text-muted-text">
                  Placed {formatDate(order.createdAt)}
                </span>
              </div>

              <section>
                <h3 className="text-[14px] font-[600] font-public-sans text-muted-text uppercase tracking-[0.06em] mb-4">
                  Items
                </h3>
                <div className="space-y-3">
                  {order.items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-[600] font-public-sans text-primary leading-tight truncate">
                          {item.productName ?? 'Product'}
                        </p>
                        <p className="text-[12px] font-public-sans text-muted-text mt-0.5">
                          Qty {item.quantity} &middot; {fmt(item.unitAdminPrice)} each
                        </p>
                        <RateProductButton item={item} orderStatus={order.status} />
                      </div>
                      <p className="text-[14px] font-[600] font-public-sans text-primary flex-shrink-0">
                        {fmt(item.lineAdminTotal)}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mt-4 pt-4 border-t border-border-warm flex justify-between">
                  <span className="text-[14px] font-[600] font-public-sans text-muted-text">Total</span>
                  <span className="text-[16px] font-[600] font-public-sans text-primary">
                    {fmt(order.adminPriceTotal)}
                  </span>
                </div>
              </section>

              {order.status === 'CANCELLED' && order.cancelledReason && (
                <div className="bg-error/[6%] border border-error/20 rounded p-4">
                  <p className="text-[14px] font-[600] font-public-sans text-error">Order Cancelled</p>
                  <p className="text-[12px] font-public-sans text-muted-text mt-0.5">{order.cancelledReason}</p>
                </div>
              )}

              {order.expectedCollectionDate && order.status !== 'DELIVERED' && order.status !== 'CANCELLED' && (
                <section>
                  <h3 className="text-[14px] font-[600] font-public-sans text-muted-text uppercase tracking-[0.06em] mb-2">
                    Expected Collection
                  </h3>
                  <p className="text-[13px] font-public-sans text-primary">
                    {formatDate(order.expectedCollectionDate)}
                  </p>
                </section>
              )}

              {order.trackingNumber && (
                <section>
                  <h3 className="text-[14px] font-[600] font-public-sans text-muted-text uppercase tracking-[0.06em] mb-2">
                    Tracking
                  </h3>
                  <p className="text-[13px] font-[500] font-public-sans text-primary bg-muted-bg border border-border-warm rounded px-3 py-2 inline-flex items-center gap-2">
                    {order.trackingNumber}
                    <button
                      type="button"
                      aria-label="Copy tracking number"
                      onClick={() => {
                        navigator.clipboard?.writeText(order.trackingNumber ?? '').catch(() => {})
                        toast.success('Tracking number copied')
                      }}
                      className="text-muted-text hover:text-primary transition-colors"
                    >
                      <Copy size={12} aria-hidden="true" />
                    </button>
                  </p>
                </section>
              )}

              <div className="flex flex-wrap gap-3 pt-2">
                <DownloadInvoiceButton orderId={order.id} size="md" />
                <Button variant="ghost" size="md" className="gap-1.5" asChild>
                  <Link href="/messages">
                    <MessageCircle size={13} aria-hidden="true" />
                    Contact Solomon Bharat
                  </Link>
                </Button>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr className="border-b border-border-warm">
      {Array.from({ length: 6 }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-muted-bg rounded animate-pulse w-20" />
        </td>
      ))}
    </tr>
  )
}

export default function OrdersPage() {
  const fmt = useFormatPrice()
  const [activeTab, setActiveTab] = useState<FilterTab>('ALL')
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const { data, isLoading } = useMyOrders({ limit: 100 })

  const allOrders = data?.items ?? []
  const orders = activeTab === 'ALL' ? allOrders : allOrders.filter((o) => o.status === activeTab)

  function openOrder(id: string) {
    setSelectedOrderId(id)
    setSheetOpen(true)
  }

  return (
    <AccountPageWrapper
      title="Order History"
      description={isLoading ? 'Loading…' : `${allOrders.length} order${allOrders.length === 1 ? '' : 's'} to date`}
    >
      <div className="flex gap-1 mb-6 border-b border-border-warm overflow-x-auto pb-0">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={cn(
              'px-4 py-2.5 text-[14px] font-[600] font-public-sans whitespace-nowrap',
              'border-b-[2px] transition-colors duration-150 -mb-px',
              activeTab === tab
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-text hover:text-primary'
            )}
            aria-selected={activeTab === tab}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      <div className="border border-border-warm rounded bg-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[720px]">
            <thead>
              <tr className="border-b border-border-warm bg-muted-bg/40">
                {['Order', 'Status', 'Items', 'Total', 'Date', 'Actions'].map((col) => (
                  <th
                    key={col}
                    className="px-4 py-3 text-[12px] font-[600] font-public-sans text-muted-text uppercase tracking-[0.05em] whitespace-nowrap"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-0 text-center">
                    <EmptyState
                      title="No orders yet"
                      description="Place your first wholesale order with Solomon Bharat."
                      action={{
                        label: 'Continue Browsing',
                        onClick: () => { window.location.href = '/' },
                      }}
                    />
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr
                    key={order.id}
                    onClick={() => openOrder(order.id)}
                    className="border-b border-border-warm last:border-0 cursor-pointer hover:bg-muted-bg/30 transition-colors duration-100"
                  >
                    <td className="px-4 py-3">
                      <span className="text-[13px] font-[600] font-public-sans text-primary">
                        {orderRef(order.id)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={order.status} />
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[13px] font-public-sans text-muted-text">
                        {orderTotalItems(order)} item{orderTotalItems(order) === 1 ? '' : 's'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[13px] font-[600] font-public-sans text-primary">
                        {fmt(order.adminPriceTotal)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[13px] font-public-sans text-muted-text whitespace-nowrap">
                        {formatDate(order.createdAt)}
                      </span>
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1 flex-wrap">
                        <TrackShipmentButton trackingNumber={order.trackingNumber} />
                        <DownloadInvoiceButton orderId={order.id} />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <OrderDetailSheet
        orderId={selectedOrderId}
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
      />
    </AccountPageWrapper>
  )
}
