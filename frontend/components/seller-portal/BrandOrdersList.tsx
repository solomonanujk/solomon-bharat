'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ShoppingBag } from 'lucide-react'
import { useBrandOrders } from '@/hooks/queries/useBrandPortal'
import { OrderItemStatusBadge } from '@/components/seller-portal/StatusBadges'
import { formatINR, cn } from '@/lib/utils'
import type { OrderStatus } from '@/types'

type Filter = 'ALL' | OrderStatus

const FILTERS: { label: string; value: Filter }[] = [
  { label: 'All', value: 'ALL' },
  { label: 'To confirm', value: 'PAYMENT_RECEIVED' },
  { label: 'To ship', value: 'CONFIRMED' },
  { label: 'In transit', value: 'IN_TRANSIT' },
  { label: 'Delivered', value: 'DELIVERED' },
  { label: 'Cancelled', value: 'CANCELLED' },
]

const PAGE_LIMIT = 20

export function BrandOrdersList() {
  const [filter, setFilter] = useState<Filter>('ALL')
  const [page, setPage] = useState(1)
  const { data, isLoading, error } = useBrandOrders({
    status: filter === 'ALL' ? undefined : filter,
    page,
    limit: PAGE_LIMIT,
  })

  const orders = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_LIMIT))

  return (
    <div>
      <div className="mb-6">
        <h1 className="type-h2 text-ink">Sales</h1>
        <p className="text-[13.5px] font-sans text-muted mt-0.5">
          Orders for your brand. Confirm, ship with tracking, and mark delivered to receive your payout.
        </p>
      </div>

      <div className="flex items-center gap-1 mb-5 border-b border-line overflow-x-auto" role="tablist" aria-label="Filter orders by status">
        {FILTERS.map(({ label, value }) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={filter === value}
            onClick={() => { setFilter(value); setPage(1) }}
            className={cn(
              'px-4 min-h-[44px] text-[13.5px] font-[600] font-sans whitespace-nowrap border-b-2 transition-colors',
              filter === value ? 'border-forest text-ink -mb-px' : 'border-transparent text-muted hover:text-ink',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="bg-white border border-line rounded-xl animate-pulse h-64" />
      ) : error ? (
        <p role="alert" className="py-12 text-center text-[14px] font-sans text-error">Failed to load orders.</p>
      ) : orders.length === 0 ? (
        <div className="py-20 flex flex-col items-center text-center bg-white border border-line rounded-xl">
          <div className="w-14 h-14 rounded-full bg-ivory flex items-center justify-center mb-4">
            <ShoppingBag size={24} className="text-muted" aria-hidden="true" />
          </div>
          <p className="text-[16px] font-[600] font-sans text-ink mb-1">No orders here</p>
          <p className="text-[13.5px] font-sans text-muted">Paid orders for your products will appear here.</p>
        </div>
      ) : (
        <>
          <div className="bg-white border border-line rounded-xl overflow-x-auto mb-4">
            <table className="w-full min-w-[720px]">
              <thead>
                <tr className="border-b border-line bg-ivory">
                  {['Order', 'Date', 'Buyer', 'Items', 'Total', 'Net to you', 'Status', ''].map((col, i) => (
                    <th key={`${col}-${i}`} className="px-5 py-3 text-left text-[11px] font-[700] font-sans text-muted uppercase tracking-[0.07em] whitespace-nowrap">
                      {col || <span className="sr-only">Open</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {orders.map((o) => (
                  <tr key={o.id} className="hover:bg-ivory/50 transition-colors">
                    <td className="px-5 py-4 text-[12.5px] font-[600] font-sans tabular-nums text-muted">#{o.id.slice(0, 8).toUpperCase()}</td>
                    <td className="px-5 py-4 text-[12.5px] font-sans text-muted whitespace-nowrap">
                      {new Date(o.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-5 py-4 text-[13.5px] font-sans text-ink">{o.buyer.name}</td>
                    <td className="px-5 py-4 text-[13.5px] font-sans tabular-nums text-ink">{o.items.reduce((n, i) => n + i.quantity, 0)}</td>
                    <td className="px-5 py-4 text-[13.5px] font-[700] font-sans tabular-nums text-ink">{formatINR(Number(o.grossTotal))}</td>
                    <td className="px-5 py-4 text-[13.5px] font-sans tabular-nums text-ink">
                      {o.netTotal !== null ? formatINR(Number(o.netTotal)) : '—'}
                    </td>
                    <td className="px-5 py-4"><OrderItemStatusBadge status={o.status} /></td>
                    <td className="px-5 py-4">
                      <Link href={`/portal/orders/${o.id}`} className="text-[13px] font-[600] font-sans text-forest underline min-h-[44px] inline-flex items-center">
                        View<span className="sr-only"> order {o.id.slice(0, 8)}</span>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-[13px] font-sans text-muted">{total} order{total !== 1 ? 's' : ''} total</p>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                  className="min-h-[44px] px-4 rounded border border-line text-[13px] font-[600] font-sans text-ink hover:bg-ivory disabled:opacity-40">
                  Prev
                </button>
                <span className="text-[13px] font-sans text-muted px-2">{page} / {totalPages}</span>
                <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="min-h-[44px] px-4 rounded border border-line text-[13px] font-[600] font-sans text-ink hover:bg-ivory disabled:opacity-40">
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
