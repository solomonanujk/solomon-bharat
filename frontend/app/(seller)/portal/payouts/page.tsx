'use client'

import { useMemo, useState } from 'react'
import { useMyPayouts, useMyPayoutSummary } from '@/hooks/queries/usePayouts'
import { useSellerOrderItems } from '@/hooks/queries/useOrders'
import { formatINR } from '@/lib/utils'
import { PayoutStatusBadge } from '@/components/seller-portal/StatusBadges'

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface border border-border-warm rounded p-5">
      <p className="text-[12px] font-public-sans text-muted-text">{label}</p>
      <p className="text-[26px] font-[600] font-public-sans text-primary mt-1 tabular-nums leading-none">{value}</p>
    </div>
  )
}

function StatCardSkeleton() {
  return (
    <div className="bg-surface border border-border-warm rounded p-5 animate-pulse">
      <div className="h-3 w-28 bg-muted-bg rounded mb-3" />
      <div className="h-7 w-24 bg-muted-bg rounded" />
    </div>
  )
}

const PAGE_LIMIT = 20
// Reasonably large lookup window for joining order-item → product name onto
// each payout row (Payout itself only carries orderItemId, no product name).
const ORDER_ITEM_LOOKUP_LIMIT = 200

export default function PayoutsPage() {
  const [page, setPage] = useState(1)
  const { data, isLoading, error } = useMyPayouts({ page, limit: PAGE_LIMIT })
  const { data: summary, isLoading: summaryLoading } = useMyPayoutSummary()
  const { data: orderItemsData } = useSellerOrderItems({ limit: ORDER_ITEM_LOOKUP_LIMIT })

  const productNameByOrderItemId = useMemo(() => {
    const map = new Map<string, string>()
    for (const item of orderItemsData?.items ?? []) {
      map.set(item.orderItemId, item.productName)
    }
    return map
  }, [orderItemsData])

  const payouts = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_LIMIT))

  return (
    <div>
      <h1 className="text-[24px] leading-[1.3] font-[500] font-playfair text-primary mb-6">Payouts</h1>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {summaryLoading ? (
          <>
            <StatCardSkeleton /><StatCardSkeleton /><StatCardSkeleton />
          </>
        ) : (
          <>
            <StatCard label="Total Earned (all time)" value={formatINR(summary?.totalEarned ?? 0)} />
            <StatCard label="Pending Payout" value={formatINR(summary?.pendingPayout ?? 0)} />
            <StatCard
              label="Last Payout"
              value={summary?.lastPayoutAmount != null ? formatINR(summary.lastPayoutAmount) : '—'}
            />
          </>
        )}
      </div>
      {!summaryLoading && summary?.lastPayoutDate && (
        <p className="text-[12px] font-public-sans text-muted-text -mt-6 mb-8">
          Last paid on {new Date(summary.lastPayoutDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
        </p>
      )}

      <p className="text-[13px] font-public-sans text-muted-text mb-4">
        Payouts are processed manually by Solomon Bharat. This list updates once a payout is marked as paid.
      </p>

      {isLoading ? (
        <div className="bg-surface border border-border-warm rounded overflow-hidden animate-pulse">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-14 border-b border-border-warm px-4 flex items-center gap-4">
              <div className="h-3 w-32 bg-muted-bg rounded" />
              <div className="h-3 w-20 bg-muted-bg rounded ml-auto" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="py-8 text-center">
          <p className="text-[14px] font-public-sans text-error">Failed to load payouts.</p>
        </div>
      ) : payouts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-surface border border-border-warm rounded">
          <p className="text-[16px] font-[500] font-public-sans text-primary mb-2">No payouts yet</p>
          <p className="text-[13px] font-public-sans text-muted-text">Payouts for delivered orders will appear here.</p>
        </div>
      ) : (
        <>
          <div className="bg-surface border border-border-warm rounded overflow-hidden mb-4">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px]">
                <thead>
                  <tr className="border-b border-border-warm">
                    {['Date', 'Order Ref', 'Product', 'Amount', 'Status'].map((col) => (
                      <th key={col} className="px-4 py-3 text-left text-[12px] font-[600] font-public-sans text-muted-text uppercase tracking-[0.04em]">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {payouts.map((payout) => (
                    <tr key={payout.id} className="border-b border-border-warm last:border-0 hover:bg-muted-bg/30 transition-colors">
                      <td className="px-4 py-3">
                        <span className="text-muted-text text-[13px] font-public-sans">
                          {new Date(payout.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-[500] text-[13px] font-public-sans tabular-nums text-muted-text">
                          {payout.orderId.slice(0, 8).toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[14px] font-public-sans text-primary">
                          {productNameByOrderItemId.get(payout.orderItemId) ?? payout.orderItemId.slice(0, 8).toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="tabular-nums text-[14px] font-[600] font-public-sans text-primary">{formatINR(payout.amount)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <PayoutStatusBadge status={payout.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-[13px] font-public-sans text-muted-text">{total} payout{total !== 1 ? 's' : ''} total</p>
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
