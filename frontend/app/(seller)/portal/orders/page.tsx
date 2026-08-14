'use client'

import { useState } from 'react'
import { useSellerOrderItems } from '@/hooks/queries/useOrders'
import { formatINR } from '@/lib/utils'
import { OrderItemStatusBadge } from '@/components/seller-portal/StatusBadges'

function SkeletonRows() {
  return (
    <div className="bg-surface border border-border-warm rounded animate-pulse">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex gap-4 px-4 py-3 border-b border-border-warm last:border-0">
          <div className="h-4 bg-muted-bg rounded w-1/4" />
          <div className="h-4 bg-muted-bg rounded w-1/12" />
          <div className="h-4 bg-muted-bg rounded w-1/8" />
          <div className="h-4 bg-muted-bg rounded w-1/8" />
          <div className="h-4 bg-muted-bg rounded w-1/8" />
          <div className="h-4 bg-muted-bg rounded w-1/8" />
        </div>
      ))}
    </div>
  )
}

const PAGE_LIMIT = 20

export default function OrdersPage() {
  const [page, setPage] = useState(1)
  const { data, isLoading, error } = useSellerOrderItems({ page, limit: PAGE_LIMIT })

  const items = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_LIMIT))

  return (
    <div>
      <h1 className="text-[24px] leading-[1.3] font-[500] font-playfair text-primary mb-2">Orders</h1>
      <p className="text-[13px] font-public-sans text-muted-text mb-6">
        Order items linked to your products. Buyer identity and admin pricing are never shown here.
      </p>

      {isLoading ? (
        <SkeletonRows />
      ) : error ? (
        <div className="py-8 text-center">
          <p className="text-[14px] font-public-sans text-error">Failed to load orders.</p>
        </div>
      ) : items.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-[15px] font-public-sans text-muted-text font-[500]">No orders yet</p>
          <p className="text-[13px] font-public-sans text-muted-text mt-1">
            Orders containing your products will appear here.
          </p>
        </div>
      ) : (
        <>
          <div className="bg-surface border border-border-warm rounded overflow-hidden mb-4">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead>
                  <tr className="border-b border-border-warm">
                    {['Order Ref', 'Product', 'Qty', 'Seller Price', 'Line Total', 'Status', 'Expected Collection'].map((col) => (
                      <th key={col} className="px-4 py-3 text-left text-[12px] font-[600] font-public-sans text-muted-text uppercase tracking-[0.04em]">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.orderItemId} className="border-b border-border-warm last:border-0 hover:bg-muted-bg/30 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-[500] text-[13px] font-public-sans tabular-nums text-muted-text">
                          {item.orderId.slice(0, 8).toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[14px] font-public-sans text-primary">{item.productName}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="tabular-nums text-[14px] font-public-sans">{item.quantity}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="tabular-nums text-[14px] font-public-sans">{formatINR(item.sellerPrice)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="tabular-nums text-[14px] font-[600] font-public-sans text-primary">{formatINR(item.lineSellerTotal)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <OrderItemStatusBadge status={item.status} />
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-muted-text text-[13px] font-public-sans">
                          {item.expectedCollectionDate
                            ? new Date(item.expectedCollectionDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                            : '—'}
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
              <p className="text-[13px] font-public-sans text-muted-text">{total} item{total !== 1 ? 's' : ''} total</p>
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
    </div>
  )
}
