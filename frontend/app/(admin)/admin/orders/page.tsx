'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ShoppingCart } from 'lucide-react'
import { useAdminOrders } from '@/hooks/queries/useOrders'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { cn, formatCurrency } from '@/lib/utils'
import type { OrderStatus } from '@/types'
import type { AdminOrderFields } from '@/types/order-extras'

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
  return (
    <Suspense fallback={null}>
      <AdminOrdersList />
    </Suspense>
  )
}

function AdminOrdersList() {
  // Dashboard counters link here with ?status=… to open the right filter.
  const initialStatus = (useSearchParams().get('status') ?? '') as OrderStatus | ''
  const router = useRouter()
  const [status, setStatus] = useState<OrderStatus | ''>(initialStatus)
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
          <h1 className="text-[28px] leading-[1.3] font-[500] font-sans text-[#0F241D]">Orders</h1>
          <p className="text-[14px] font-sans text-[#183D33B3] mt-1">
            All orders placed with Solomon Bharat
          </p>
        </div>
        {total > 0 && (
          <p className="text-[13px] font-sans text-[#183D33B3] self-end">
            {total.toLocaleString()} order{total !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 mb-4 border-b border-[#D9E2DA] overflow-x-auto">
        {STATUS_TABS.map(({ value, label }) => (
          <button
            key={label}
            type="button"
            onClick={() => {
              setStatus(value)
              setPage(1)
            }}
            className={cn(
              'px-4 py-2.5 text-[13px] font-[600] font-sans border-b-2 -mb-px transition-colors whitespace-nowrap',
              status === value ? 'border-[#183D33] text-[#0F241D]' : 'border-transparent text-[#183D33B3] hover:text-[#0F241D]'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="bg-white border border-[#D9E2DA] rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="divide-y divide-[#D9E2DA]">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="p-4 flex gap-4 animate-pulse">
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 bg-[#E7EDE7] rounded w-24" />
                  <div className="h-3 bg-[#E7EDE7] rounded w-40" />
                </div>
                <div className="h-5 bg-[#E7EDE7] rounded w-20" />
              </div>
            ))}
          </div>
        ) : !orders.length ? (
          <div className="py-16 flex flex-col items-center gap-3 text-center">
            <div className="w-12 h-12 rounded-full bg-[#E7EDE7] flex items-center justify-center">
              <ShoppingCart size={22} className="text-[#183D33B3]" aria-hidden="true" />
            </div>
            <p className="text-[16px] font-[600] font-sans text-[#0F241D]">No orders found</p>
            {status && <p className="text-[13px] font-sans text-[#183D33B3]">Try a different status filter.</p>}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#D9E2DA] bg-[#E7EDE7]/40">
                    {['Order', 'Items', 'Total', 'Status', 'Tracking', 'Created'].map((h) => (
                      <th
                        key={h}
                        className={cn(
                          'py-3 px-4 text-[12px] font-[600] font-sans text-[#183D33B3] uppercase tracking-[0.06em]',
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
                      className="border-b border-[#D9E2DA] last:border-0 hover:bg-[#E7EDE7]/30 transition-colors cursor-pointer"
                    >
                      <td className="py-3.5 px-4">
                        <p className="text-[13px] font-[600] font-sans text-[#0F241D]">#{shortId(order.id)}</p>
                        {(() => {
                          // Historical marketplace-brand order (model removed Oct 2026).
                          if (!(order as typeof order & AdminOrderFields).sellerProfileId) return null
                          return (
                            <span className="mt-1 inline-flex items-center rounded-full bg-selected px-2 py-0.5 text-[10.5px] font-[600] font-sans text-forest">
                              Former marketplace order
                            </span>
                          )
                        })()}
                      </td>
                      <td className="py-3.5 px-4 text-[13px] font-sans text-[#183D33B3]">
                        {order.items.length} item{order.items.length !== 1 ? 's' : ''}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <p className="text-[13px] font-[600] font-sans text-[#0F241D]">
                          {formatCurrency(order.adminPriceTotal)}
                        </p>
                      </td>
                      <td className="py-3.5 px-4">
                        <StatusBadge status={order.status} />
                      </td>
                      <td className="py-3.5 px-4 text-[13px] font-sans text-[#183D33B3] whitespace-nowrap">
                        {order.trackingNumber ?? '—'}
                      </td>
                      <td className="py-3.5 px-4 text-[12px] font-sans text-[#183D33B3] whitespace-nowrap">
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
              <div className="flex items-center justify-between px-4 py-3 border-t border-[#D9E2DA]">
                <p className="text-[12px] font-sans text-[#183D33B3]">
                  {(page - 1) * limit + 1}&ndash;{Math.min(page * limit, total)} of {total.toLocaleString()}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="h-8 px-3 rounded-lg border border-[#D9E2DA] text-[12px] font-[500] font-sans text-[#183D33B3] hover:text-[#0F241D] hover:bg-[#E7EDE7] disabled:opacity-40 transition-colors"
                  >
                    Prev
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="h-8 px-3 rounded-lg border border-[#D9E2DA] text-[12px] font-[500] font-sans text-[#183D33B3] hover:text-[#0F241D] hover:bg-[#E7EDE7] disabled:opacity-40 transition-colors"
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
