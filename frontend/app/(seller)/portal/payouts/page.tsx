'use client'

import { useMemo, useState } from 'react'
import { TrendingUp, Clock, Wallet } from 'lucide-react'
import { useMyPayouts, useMyPayoutSummary } from '@/hooks/queries/usePayouts'
import { useSellerOrderItems } from '@/hooks/queries/useOrders'
import { formatINR } from '@/lib/utils'
import { PayoutStatusBadge } from '@/components/seller-portal/StatusBadges'

function SummaryCard({
  label,
  value,
  sub,
  featured,
  icon: Icon,
}: {
  label: string
  value: string
  sub?: string
  featured?: boolean
  icon: React.ComponentType<{ size?: number; className?: string; 'aria-hidden'?: boolean }>
}) {
  if (featured) {
    return (
      <div className="bg-[#1A1A1A] rounded-xl p-5 flex flex-col gap-1">
        <div className="flex items-center gap-2 mb-1">
          <Icon size={14} className="text-[#A68B67]" aria-hidden={true} />
          <p className="text-[12px] font-[600] font-sans text-[#C4BDB4] uppercase tracking-[0.07em]">{label}</p>
        </div>
        <p className="text-[28px] font-[700] font-sans text-white tabular-nums leading-none">{value}</p>
        {sub && <p className="text-[11.5px] font-sans text-[#6B6460] mt-0.5">{sub}</p>}
      </div>
    )
  }
  return (
    <div className="bg-white border border-[#E5E1D8] rounded-xl p-5">
      <div className="flex items-center gap-2 mb-1">
        <Icon size={14} className="text-[#C4BDB4]" aria-hidden={true} />
        <p className="text-[12px] font-[600] font-sans text-[#9CA3AF] uppercase tracking-[0.07em]">{label}</p>
      </div>
      <p className="text-[24px] font-[700] font-sans text-[#1A1A1A] tabular-nums leading-none mt-1">{value}</p>
      {sub && <p className="text-[11.5px] font-sans text-[#9CA3AF] mt-1">{sub}</p>}
    </div>
  )
}

function SummaryCardSkeleton({ featured }: { featured?: boolean }) {
  const bg = featured ? 'bg-[#1A1A1A]' : 'bg-white border border-[#E5E1D8]'
  const shade = featured ? 'bg-[#2E2A24]' : 'bg-[#F5F0E8]'
  return (
    <div className={`${bg} rounded-xl p-5 animate-pulse`}>
      <div className={`h-3 w-28 ${shade} rounded mb-3`} />
      <div className={`h-7 w-24 ${shade} rounded`} />
    </div>
  )
}

const PAGE_LIMIT = 20
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

  const lastPayoutSub = !summaryLoading && summary?.lastPayoutDate
    ? `Last paid ${new Date(summary.lastPayoutDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`
    : undefined

  return (
    <div>
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-[24px] font-[700] font-sans text-[#1A1A1A] leading-tight">Payouts</h1>
        <p className="text-[13px] font-sans text-[#6B6460] mt-0.5">
          Payouts are processed manually by Solomon Bharat and update once marked as paid.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {summaryLoading ? (
          <>
            <SummaryCardSkeleton featured />
            <SummaryCardSkeleton />
            <SummaryCardSkeleton />
          </>
        ) : (
          <>
            <SummaryCard
              label="Total Earned (all time)"
              value={formatINR(summary?.totalEarned ?? 0)}
              icon={TrendingUp}
              featured
            />
            <SummaryCard
              label="Pending Payout"
              value={formatINR(summary?.pendingPayout ?? 0)}
              icon={Clock}
            />
            <SummaryCard
              label="Last Payout"
              value={summary?.lastPayoutAmount != null ? formatINR(summary.lastPayoutAmount) : '—'}
              sub={lastPayoutSub}
              icon={Wallet}
            />
          </>
        )}
      </div>

      {isLoading ? (
        <div className="bg-white border border-[#E5E1D8] rounded-xl overflow-hidden animate-pulse">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-[58px] border-b border-[#F5F0E8] px-5 flex items-center gap-4">
              <div className="h-3 w-24 bg-[#F5F0E8] rounded" />
              <div className="h-3 w-20 bg-[#F5F0E8] rounded ml-auto" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="py-12 text-center">
          <p className="text-[14px] font-sans text-red-500">Failed to load payouts.</p>
        </div>
      ) : payouts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-white border border-[#E5E1D8] rounded-xl">
          <div className="w-14 h-14 rounded-full bg-[#F5F0E8] flex items-center justify-center mb-4">
            <Wallet size={22} className="text-[#C4BDB4]" aria-hidden="true" />
          </div>
          <p className="text-[16px] font-[600] font-sans text-[#1A1A1A] mb-1">No payouts yet</p>
          <p className="text-[13.5px] font-sans text-[#6B6460]">Payouts for delivered orders will appear here.</p>
        </div>
      ) : (
        <>
          <div className="bg-white border border-[#E5E1D8] rounded-xl overflow-hidden mb-4">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px]">
                <thead>
                  <tr className="border-b border-[#E5E1D8] bg-[#F9F7F2]">
                    {['Date', 'Order Ref', 'Product', 'Amount', 'Status'].map((col) => (
                      <th key={col} className="px-5 py-3 text-left text-[11px] font-[700] font-sans text-[#9CA3AF] uppercase tracking-[0.07em]">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F5F0E8]">
                  {payouts.map((payout) => (
                    <tr key={payout.id} className="hover:bg-[#FDFCF9] transition-colors">
                      <td className="px-5 py-4">
                        <span className="text-[12.5px] font-sans text-[#9CA3AF] whitespace-nowrap">
                          {new Date(payout.createdAt).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className="font-[600] text-[12.5px] font-sans tabular-nums text-[#9CA3AF] tracking-wide">
                          #{payout.orderId.slice(0, 8).toUpperCase()}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-[14px] font-[500] font-sans text-[#1A1A1A]">
                          {productNameByOrderItemId.get(payout.orderItemId) ??
                            payout.orderItemId.slice(0, 8).toUpperCase()}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className="tabular-nums text-[14px] font-[700] font-sans text-[#1A1A1A]">
                          {formatINR(payout.amount)}
                        </span>
                      </td>
                      <td className="px-5 py-4">
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
              <p className="text-[13px] font-sans text-[#6B6460]">
                {total} payout{total !== 1 ? 's' : ''} total
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="h-8 px-3.5 rounded-lg border border-[#E5E1D8] text-[13px] font-[600] font-sans text-[#1A1A1A] hover:bg-[#F5F0E8] transition-colors disabled:opacity-40"
                >
                  Prev
                </button>
                <span className="text-[13px] font-sans text-[#6B6460] px-2">
                  {page} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="h-8 px-3.5 rounded-lg border border-[#E5E1D8] text-[13px] font-[600] font-sans text-[#1A1A1A] hover:bg-[#F5F0E8] transition-colors disabled:opacity-40"
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
