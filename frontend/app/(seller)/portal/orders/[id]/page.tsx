'use client'

import { use, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Copy, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  useBrandOrder,
  useConfirmBrandOrder,
  useDeliverBrandOrder,
  useSellerType,
  useShipBrandOrder,
} from '@/hooks/queries/useBrandPortal'
import { OrderItemStatusBadge } from '@/components/seller-portal/StatusBadges'
import { formatINR } from '@/lib/utils'
import type { BrandOrderView } from '@/types/brand-portal'

const money = (v: string | null): string => (v === null ? '—' : formatINR(Number(v)))

function addressText(order: BrandOrderView): string {
  const a = order.shippingAddress
  if (!a) return ''
  return [
    order.buyer.name,
    order.buyer.company,
    a.line1,
    a.line2,
    [a.city, a.state, a.postalCode].filter(Boolean).join(', '),
    a.country,
    order.buyer.phone ? `Phone: ${order.buyer.phone}` : null,
  ]
    .filter(Boolean)
    .join('\n')
}

async function copy(text: string, what: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.success(`${what} copied.`)
  } catch {
    toast.error('Could not copy. Select the text and copy it manually.')
  }
}

function Card({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="bg-white border border-line rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-line bg-ivory flex items-center justify-between gap-2">
        <h2 className="text-[11px] font-[700] font-sans text-muted uppercase tracking-[0.07em]">{title}</h2>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  )
}

function ShipDialog({ order, open, onOpenChange }: { order: BrandOrderView; open: boolean; onOpenChange: (o: boolean) => void }) {
  const ship = useShipBrandOrder()
  const [tracking, setTracking] = useState('')
  const [carrier, setCarrier] = useState('')

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!tracking.trim()) return
    ship.mutate(
      { id: order.id, trackingNumber: tracking.trim(), carrier: carrier.trim() || undefined },
      { onSuccess: () => onOpenChange(false) },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-6">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Ship this order</DialogTitle>
            <DialogDescription>The buyer is notified with the tracking details.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 my-5">
            <div>
              <label htmlFor="tracking" className="block text-[14px] font-[600] font-sans text-ink mb-1.5">Tracking number *</label>
              <input id="tracking" required maxLength={200} value={tracking} onChange={(e) => setTracking(e.target.value)}
                className="w-full h-11 px-3 rounded border border-line text-[14px] font-sans" />
            </div>
            <div>
              <label htmlFor="carrier" className="block text-[14px] font-[600] font-sans text-ink mb-1.5">Carrier (optional)</label>
              <input id="carrier" maxLength={100} value={carrier} onChange={(e) => setCarrier(e.target.value)} placeholder="e.g. DHL, FedEx"
                className="w-full h-11 px-3 rounded border border-line text-[14px] font-sans" />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={ship.isPending || !tracking.trim()}>
              {ship.isPending && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
              Mark as shipped
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function DeliverDialog({ order, open, onOpenChange }: { order: BrandOrderView; open: boolean; onOpenChange: (o: boolean) => void }) {
  const deliver = useDeliverBrandOrder()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-6">
        <DialogHeader>
          <DialogTitle>Mark as delivered?</DialogTitle>
          <DialogDescription>
            Confirm only once the buyer has received the order. This creates your payout
            {order.netTotal !== null ? ` of ${money(order.netTotal)}` : ''} and cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-5">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Not yet</Button>
          <Button
            type="button"
            variant="primary"
            disabled={deliver.isPending}
            onClick={() => deliver.mutate({ id: order.id }, { onSuccess: () => onOpenChange(false) })}
          >
            {deliver.isPending && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
            Yes, mark delivered
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function OrderDetail({ order }: { order: BrandOrderView }) {
  const confirm = useConfirmBrandOrder()
  const [shipOpen, setShipOpen] = useState(false)
  const [deliverOpen, setDeliverOpen] = useState(false)
  const a = order.shippingAddress

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <OrderItemStatusBadge status={order.status} />
        <span className="text-[13px] font-sans text-muted">
          Placed {new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
        </span>
        <div className="ml-auto flex flex-wrap gap-2">
          {order.status === 'PAYMENT_RECEIVED' && (
            <Button type="button" variant="primary" disabled={confirm.isPending} onClick={() => confirm.mutate({ id: order.id })}>
              {confirm.isPending && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
              Confirm order
            </Button>
          )}
          {order.status === 'CONFIRMED' && (
            <Button type="button" variant="primary" onClick={() => setShipOpen(true)}>Ship order</Button>
          )}
          {order.status === 'IN_TRANSIT' && (
            <Button type="button" variant="primary" onClick={() => setDeliverOpen(true)}>Mark delivered</Button>
          )}
        </div>
      </div>

      {order.status === 'PAYMENT_RECEIVED' && (
        <p className="text-[13px] font-sans text-muted">Payment is received. Confirm the order to start preparing it.</p>
      )}
      {order.status === 'CANCELLED' && (
        <p role="status" className="text-[13px] font-sans text-error">
          This order was cancelled{order.cancelledReason ? `: ${order.cancelledReason}` : '.'}
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
        <div className="space-y-5 min-w-0">
          <Card title="Items">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-[13px] font-sans">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-[0.06em] text-muted">
                    <th className="pb-2 font-[700]">Product</th>
                    <th className="pb-2 font-[700]">Qty</th>
                    <th className="pb-2 font-[700]">Gross</th>
                    <th className="pb-2 font-[700]">Rate</th>
                    <th className="pb-2 font-[700]">Commission</th>
                    <th className="pb-2 font-[700]">Net</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {order.items.map((it) => (
                    <tr key={it.id}>
                      <td className="py-3 pr-3">
                        <p className="font-[600] text-ink">{it.productName}</p>
                        {it.variantLabel && <p className="text-[12px] text-muted">{it.variantLabel}</p>}
                        <p className="text-[12px] text-muted">{money(it.unitPrice)} each</p>
                      </td>
                      <td className="py-3 pr-3 tabular-nums">{it.quantity}</td>
                      <td className="py-3 pr-3 tabular-nums">{money(it.lineGross)}</td>
                      <td className="py-3 pr-3 tabular-nums">{it.commissionRate !== null ? `${Number(it.commissionRate)}%` : '—'}</td>
                      <td className="py-3 pr-3 tabular-nums">{money(it.commissionAmount)}</td>
                      <td className="py-3 tabular-nums font-[600]">{money(it.lineNet)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-line font-[700] text-ink">
                    <td className="pt-3" colSpan={2}>Totals</td>
                    <td className="pt-3 tabular-nums">{money(order.grossTotal)}</td>
                    <td className="pt-3" />
                    <td className="pt-3 tabular-nums">{money(order.commissionTotal)}</td>
                    <td className="pt-3 tabular-nums">{money(order.netTotal)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            {order.commissionTotal === null && (
              <p className="text-[12px] font-sans text-muted mt-3">Commission is calculated when the order is paid.</p>
            )}
          </Card>

          <Card title="Tracking">
            {order.trackingNumber ? (
              <div className="flex items-center gap-3 flex-wrap">
                <p className="text-[14px] font-[600] font-sans text-ink break-all">{order.trackingNumber}</p>
                <button type="button" onClick={() => copy(order.trackingNumber!, 'Tracking number')}
                  className="inline-flex items-center gap-1 text-[12px] font-[600] text-forest underline min-h-[44px]">
                  <Copy size={12} aria-hidden="true" /> Copy
                </button>
              </div>
            ) : (
              <p className="text-[13px] font-sans text-muted">Added when you ship the order.</p>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          <Card
            title="Ship to"
            action={a ? (
              <button type="button" onClick={() => copy(addressText(order), 'Address')}
                className="inline-flex items-center gap-1 text-[12px] font-[600] text-forest underline">
                <Copy size={12} aria-hidden="true" /> Copy
              </button>
            ) : undefined}
          >
            <p className="text-[14px] font-[600] font-sans text-ink">{order.buyer.name}</p>
            {order.buyer.company && <p className="text-[13px] font-sans text-ink">{order.buyer.company}</p>}
            {order.buyer.phone ? (
              <p className="text-[13px] font-sans text-muted mt-1">Phone: {order.buyer.phone}</p>
            ) : (
              <p className="text-[13px] font-sans text-muted mt-1">No phone number provided.</p>
            )}
            {a ? (
              <address className="not-italic text-[13px] font-sans text-ink mt-3 leading-relaxed">
                {a.line1}<br />
                {a.line2 && <>{a.line2}<br /></>}
                {[a.city, a.state, a.postalCode].filter(Boolean).join(', ')}<br />
                {a.country}
              </address>
            ) : (
              <p className="text-[13px] font-sans text-muted mt-3">No shipping address on this order.</p>
            )}
          </Card>
        </div>
      </div>

      <ShipDialog order={order} open={shipOpen} onOpenChange={setShipOpen} />
      <DeliverDialog order={order} open={deliverOpen} onOpenChange={setDeliverOpen} />
    </div>
  )
}

export default function BrandOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { isMarketplace, ready } = useSellerType()
  const { data: order, isLoading, error } = useBrandOrder(isMarketplace ? id : null)

  return (
    <div className="max-w-5xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/portal/orders" aria-label="Back to orders"
          className="inline-flex items-center justify-center w-11 h-11 rounded border border-line text-muted hover:text-ink hover:bg-ivory shrink-0">
          <ArrowLeft size={15} aria-hidden="true" />
        </Link>
        <h1 className="type-h2 text-ink">Order #{id.slice(0, 8).toUpperCase()}</h1>
      </div>

      {!ready ? (
        <p className="text-[14px] font-sans text-muted">Loading…</p>
      ) : !isMarketplace ? (
        <p className="text-[14px] font-sans text-muted">Order details are only available to marketplace brands.</p>
      ) : isLoading ? (
        <div className="space-y-4 animate-pulse">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-32 bg-white border border-line rounded-xl" />)}
        </div>
      ) : error || !order ? (
        <p role="alert" className="text-[14px] font-sans text-error">Could not load this order.</p>
      ) : (
        <OrderDetail order={order} />
      )}
    </div>
  )
}
