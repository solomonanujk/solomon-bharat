'use client'

import { useState } from 'react'
import { ShoppingBag } from 'lucide-react'
import { useSellerOrderItems } from '@/hooks/queries/useOrders'
import { formatINR } from '@/lib/utils'
import { OrderItemStatusBadge } from '@/components/seller-portal/StatusBadges'

function SkeletonRows() {
  return (
    <div className="bg-white border border-[#E5E1D8] rounded-xl overflow-hidden animate-pulse">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex gap-4 px-5 py-4 border-b border-[#F5F0E8] last:border-0">
          <div className="h-4 bg-[#F5F0E8] rounded w-24" />
          <div className="h-4 bg-[#F5F0E8] rounded flex-1" />
          <div className="h-4 bg-[#F5F0E8] rounded w-8" />
          <div className="h-4 bg-[#F5F0E8] rounded w-20" />
          <div className="h-4 bg-[#F5F0E8] rounded w-20" />
          <div className="h-5 bg-[#F5F0E8] rounded-full w-24" />
          <div className="h-4 bg-[#F5F0E8] rounded w-20" />
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
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-[24px] font-[700] font-sans text-[#1A1A1A] leading-tight">Orders</h1>
        <p className="text-[13px] font-sans text-[#6B6460] mt-0.5">
          Order items linked to your products. Buyer identity and admin pricing are never shown here.
        </p>
      </div>

      {isLoading ? (
        <SkeletonRows />
      ) : error ? (
        <div className="py-12 text-center">
          <p className="text-[14px] font-sans text-red-500">Failed to load orders.</p>
        </div>
      ) : items.length === 0 ? (
        <div className="py-20 flex flex-col items-center justify-center text-center bg-white border border-[#E5E1D8] rounded-xl">
          <div className="w-14 h-14 rounded-full bg-[#F5F0E8] flex items-center justify-center mb-4">
            <ShoppingBag size={24} className="text-[#C4BDB4]" aria-hidden="true" />
          </div>
          <p className="text-[16px] font-[600] font-sans text-[#1A1A1A] mb-1">No orders yet</p>
          <p className="text-[13.5px] font-sans text-[#6B6460]">
            Orders containing your products will appear here.
          </p>
        </div>
      ) : (
        <>
          <div className="bg-white border border-[#E5E1D8] rounded-xl overflow-hidden mb-4">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px]">
                <thead>
                  <tr className="border-b border-[#E5E1D8] bg-[#F9F7F2]">
                    {['Order Ref', 'Product', 'Qty', 'Seller Price', 'Line Total', 'Status', 'Expected Collection'].map((col) => (
                      <th key={col} className="px-5 py-3 text-left text-[11px] font-[700] font-sans text-[#9CA3AF] uppercase tracking-[0.07em] whitespace-nowrap">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F5F0E8]">
                  {items.map((item) => (
                    <tr key={item.orderItemId} className="hover:bg-[#FDFCF9] transition-colors">
                      <td className="px-5 py-4">
                        <span className="font-[600] text-[12.5px] font-sans tabular-nums text-[#9CA3AF] tracking-wide">
                          #{item.orderId.slice(0, 8).toUpperCase()}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-[14px] font-[500] font-sans text-[#1A1A1A]">
                          {item.productName}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className="tabular-nums text-[14px] font-[600] font-sans text-[#1A1A1A]">
                          {item.quantity}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className="tabular-nums text-[13.5px] font-sans text-[#6B6460]">
                          {formatINR(item.sellerPrice)}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className="tabular-nums text-[14px] font-[700] font-sans text-[#1A1A1A]">
                          {formatINR(item.lineSellerTotal)}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <OrderItemStatusBadge status={item.status} />
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-[12.5px] font-sans text-[#9CA3AF] whitespace-nowrap">
                          {item.expectedCollectionDate
                            ? new Date(item.expectedCollectionDate).toLocaleDateString('en-IN', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              })
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
              <p className="text-[13px] font-sans text-[#6B6460]">
                {total} item{total !== 1 ? 's' : ''} total
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
