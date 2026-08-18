'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Copy } from 'lucide-react'
import { useMyOrders, useMyOrder } from '@/hooks/queries/useOrders'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useFormatPrice } from '@/components/ui/Price'
import type { Order } from '@/types'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function orderRef(id: string) {
  return `#${id.slice(0, 8).toUpperCase()}`
}

function orderTotalItems(order: Order) {
  return order.items?.reduce((sum, i) => sum + i.quantity, 0) ?? 0
}

function SkeletonRows() {
  return (
    <div className="bg-surface border border-border-warm rounded animate-pulse">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex gap-4 px-4 py-3 border-b border-border-warm last:border-0">
          <div className="h-4 bg-muted-bg rounded w-1/4" />
          <div className="h-4 bg-muted-bg rounded w-1/8" />
          <div className="h-4 bg-muted-bg rounded w-1/8" />
          <div className="h-4 bg-muted-bg rounded w-1/8" />
          <div className="h-4 bg-muted-bg rounded w-1/8" />
        </div>
      ))}
    </div>
  )
}

// ─── Order detail dialog ───────────────────────────────────────────────────────

function OrderDetailDialog({ orderId, onClose }: { orderId: string | null; onClose: () => void }) {
  const fmt = useFormatPrice()
  const { data: order, isLoading } = useMyOrder(orderId)

  return (
    <Dialog open={!!orderId} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{order ? `Order ${orderRef(order.id)}` : 'Order Details'}</DialogTitle>
        </DialogHeader>

        <div className="px-6 pb-6 space-y-5">
          {isLoading && (
            <div className="space-y-3 animate-pulse">
              {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-4 bg-muted-bg rounded w-3/4" />)}
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

              <div className="space-y-3">
                {order.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[14px] font-[600] font-public-sans text-primary truncate">
                        {item.productName ?? 'Product'}
                      </p>
                      <p className="text-[12px] font-public-sans text-muted-text mt-0.5">
                        Qty {item.quantity} &middot; {fmt(item.unitAdminPrice)} each
                      </p>
                    </div>
                    <p className="text-[14px] font-[600] font-public-sans text-primary shrink-0">
                      {fmt(item.lineAdminTotal)}
                    </p>
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t border-border-warm flex justify-between">
                <span className="text-[14px] font-[600] font-public-sans text-muted-text">Total</span>
                <span className="text-[16px] font-[600] font-public-sans text-primary">
                  {fmt(order.adminPriceTotal)}
                </span>
              </div>

              {order.trackingNumber && (
                <div>
                  <p className="text-[12px] font-[600] font-public-sans text-muted-text uppercase tracking-[0.05em] mb-1.5">
                    Tracking
                  </p>
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
                </div>
              )}

              {order.status === 'CANCELLED' && order.cancelledReason && (
                <div className="bg-error/[6%] border border-error/20 rounded p-4">
                  <p className="text-[14px] font-[600] font-public-sans text-error">Order Cancelled</p>
                  <p className="text-[12px] font-public-sans text-muted-text mt-0.5">{order.cancelledReason}</p>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
// Your Orders — same GET /orders/me endpoint the buyer uses, now also
// AGENT-accessible. Deliberately not the seller orders page's
// fulfillment-focused copy (no "seller price"/"buyer identity" language) — the
// agent is the one who placed the order, same as a buyer.

const PAGE_LIMIT = 20

export default function AgentOrdersPage() {
  const fmt = useFormatPrice()
  const [page, setPage] = useState(1)
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const { data, isLoading, error } = useMyOrders({ page, limit: PAGE_LIMIT })

  const orders = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_LIMIT))

  return (
    <div>
      <h1 className="text-[24px] leading-[1.3] font-[500] font-playfair text-primary mb-2">Your Orders</h1>
      <p className="text-[13px] font-public-sans text-muted-text mb-6">
        Orders you&apos;ve placed through the agent portal.
      </p>

      {isLoading ? (
        <SkeletonRows />
      ) : error ? (
        <div className="py-8 text-center">
          <p className="text-[14px] font-public-sans text-error">Failed to load orders.</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-[15px] font-public-sans text-muted-text font-[500]">No orders yet</p>
          <p className="text-[13px] font-public-sans text-muted-text mt-1">
            Orders you place from the Products page will appear here.
          </p>
        </div>
      ) : (
        <>
          <div className="bg-surface border border-border-warm rounded overflow-hidden mb-4">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px]">
                <thead>
                  <tr className="border-b border-border-warm">
                    {['Order', 'Status', 'Items', 'Total', 'Date'].map((col) => (
                      <th key={col} className="px-4 py-3 text-left text-[12px] font-[600] font-public-sans text-muted-text uppercase tracking-[0.04em]">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr
                      key={order.id}
                      onClick={() => setSelectedOrderId(order.id)}
                      className="border-b border-border-warm last:border-0 cursor-pointer hover:bg-muted-bg/30 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <span className="font-[600] text-[13px] font-public-sans text-primary">
                          {orderRef(order.id)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={order.status} />
                      </td>
                      <td className="px-4 py-3">
                        <span className="tabular-nums text-[14px] font-public-sans text-muted-text">
                          {orderTotalItems(order)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="tabular-nums text-[14px] font-[600] font-public-sans text-primary">
                          {fmt(order.adminPriceTotal)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-muted-text text-[13px] font-public-sans whitespace-nowrap">
                          {formatDate(order.createdAt)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-[13px] font-public-sans text-muted-text">{total} order{total !== 1 ? 's' : ''} total</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="h-8 px-3 rounded border border-border-warm text-[13px] font-[600] font-public-sans text-primary hover:bg-muted-bg transition-colors disabled:opacity-40"
                >
                  Prev
                </button>
                <span className="text-[13px] font-public-sans text-muted-text px-2">{page} / {totalPages}</span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="h-8 px-3 rounded border border-border-warm text-[13px] font-[600] font-public-sans text-primary hover:bg-muted-bg transition-colors disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}

      <OrderDetailDialog orderId={selectedOrderId} onClose={() => setSelectedOrderId(null)} />
    </div>
  )
}
