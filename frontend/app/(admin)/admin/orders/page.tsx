'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ShoppingCart } from 'lucide-react'
import { useAdminOrders } from '@/hooks/queries/useOrders'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { cn, formatCurrency } from '@/lib/utils'
import type { OrderStatus } from '@/types'

const LIMIT = 20

// ─── Status filter tabs ───────────────────────────────────────────────────────
// Only the 8 real OrderStatus values — no DISPUTED/RETURNED/REFUNDED, ever.

const STATUS_TABS: { value: OrderStatus | ''; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'PENDING_PAYMENT', label: 'Pending Payment' },
  { value: 'PAYMENT_RECEIVED', label: 'Payment Received' },
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'PROCURING', label: 'Procuring' },
  { value: 'COLLECTED', label: 'Collected' },
  { value: 'IN_TRANSIT', label: 'In Transit' },
  { value: 'DELIVERED', label: 'Delivered' },
  { value: 'CANCELLED', label: 'Cancelled' },
]

function shortId(id: string) {
  return id.slice(-8).toUpperCase()
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminOrdersPage() {
  const router = useRouter()
  const [status, setStatus] = useState<OrderStatus | ''>('')
  const [page, setPage] = useState(1)

  const { data, isLoading } = useAdminOrders({
    status: status || undefined,
    page,
    limit: LIMIT,
  })

  const orders = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = data?.totalPages ?? 1
  const limit = data?.limit ?? LIMIT

  return (
    <div>
      <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[28px] leading-[1.3] font-[500] font-playfair text-primary">Orders</h1>
          <p className="text-[14px] font-public-sans text-muted-text mt-1">
            All orders placed with Solomon Bharat
          </p>
        </div>
        {total > 0 && (
          <p className="text-[13px] font-public-sans text-muted-text self-end">
            {total.toLocaleString()} order{total !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 mb-4 border-b border-border-warm overflow-x-auto">
        {STATUS_TABS.map(({ value, label }) => (
          <button
            key={label}
            type="button"
            onClick={() => {
              setStatus(value)
              setPage(1)
            }}
            className={cn(
              'px-4 py-2.5 text-[13px] font-[600] font-public-sans border-b-2 -mb-px transition-colors whitespace-nowrap',
              status === value ? 'border-primary text-primary' : 'border-transparent text-muted-text hover:text-primary'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="bg-surface border border-border-warm rounded overflow-hidden">
        {isLoading ? (
          <div className="divide-y divide-border-warm">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="p-4 flex gap-4 animate-pulse">
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 bg-muted-bg rounded w-24" />
                  <div className="h-3 bg-muted-bg rounded w-40" />
                </div>
                <div className="h-5 bg-muted-bg rounded w-20" />
              </div>
            ))}
          </div>
        ) : !orders.length ? (
          <div className="py-16 flex flex-col items-center gap-3 text-center">
            <div className="w-12 h-12 rounded-full bg-muted-bg flex items-center justify-center">
              <ShoppingCart size={22} className="text-muted-text" aria-hidden="true" />
            </div>
            <p className="text-[16px] font-[600] font-public-sans text-primary">No orders found</p>
            {status && <p className="text-[13px] font-public-sans text-muted-text">Try a different status filter.</p>}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border-warm bg-muted-bg/40">
                    {['Order', 'Items', 'Total', 'Status', 'Tracking', 'Created'].map((h) => (
                      <th
                        key={h}
                        className={cn(
                          'py-3 px-4 text-[12px] font-[600] font-public-sans text-muted-text uppercase tracking-[0.06em]',
                          h === 'Total' ? 'text-right' : 'text-left'
                        )}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr
                      key={order.id}
                      onClick={() => router.push(`/admin/orders/${order.id}`)}
                      className="border-b border-border-warm last:border-0 hover:bg-muted-bg/30 transition-colors cursor-pointer"
                    >
                      <td className="py-3.5 px-4">
                        <p className="text-[13px] font-[600] font-public-sans text-primary">#{shortId(order.id)}</p>
                      </td>
                      <td className="py-3.5 px-4 text-[13px] font-public-sans text-muted-text">
                        {order.items.length} item{order.items.length !== 1 ? 's' : ''}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <p className="text-[13px] font-[600] font-public-sans text-primary">
                          {formatCurrency(order.adminPriceTotal)}
                        </p>
                      </td>
                      <td className="py-3.5 px-4">
                        <StatusBadge status={order.status} />
                      </td>
                      <td className="py-3.5 px-4 text-[13px] font-public-sans text-muted-text whitespace-nowrap">
                        {order.trackingNumber ?? '—'}
                      </td>
                      <td className="py-3.5 px-4 text-[12px] font-public-sans text-muted-text whitespace-nowrap">
                        {new Date(order.createdAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: '2-digit',
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border-warm">
                <p className="text-[12px] font-public-sans text-muted-text">
                  {(page - 1) * limit + 1}&ndash;{Math.min(page * limit, total)} of {total.toLocaleString()}
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
          </>
        )}
      </div>
    </div>
  )
}
