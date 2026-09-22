'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, Search } from 'lucide-react'
import { useAdminSellers } from '@/hooks/queries/useSellers'
import { cn } from '@/lib/utils'

const LIMIT = 20

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminSellersPage() {
  const router = useRouter()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')

  const { data, isLoading } = useAdminSellers({ page, limit: LIMIT })

  const sellers = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = data?.totalPages ?? 1

  const filtered = sellers.filter((s) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      s.businessName.toLowerCase().includes(q) ||
      s.contactName.toLowerCase().includes(q) ||
      s.phone.toLowerCase().includes(q)
    )
  })

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[28px] leading-[1.3] font-[500] font-sans text-[#1A1A1A]">Sellers</h1>
          <p className="text-[14px] font-sans text-[#6B6460] mt-1">Approved sellers on the platform</p>
        </div>
        {total > 0 && (
          <p className="text-[13px] font-sans text-[#6B6460] self-end">
            {total.toLocaleString()} seller{total !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* Search */}
      <div className="mb-4 relative max-w-[320px]">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B6460]" aria-hidden="true" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, contact, or phone…"
          className={cn(
            'w-full h-9 pl-9 pr-3 rounded-lg border border-[#E5E1D8] bg-white',
            'text-[14px] font-sans text-[#1A1A1A] placeholder:text-[#6B6460]',
            'focus:outline-none focus:border-[#A68B67] transition-colors'
          )}
        />
      </div>

      {/* Table */}
      <div className="bg-white border border-[#E5E1D8] rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="divide-y divide-[#E5E1D8]">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="p-4 flex gap-4 animate-pulse">
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 bg-[#F5F0E8] rounded w-40" />
                  <div className="h-3 bg-[#F5F0E8] rounded w-56" />
                </div>
                <div className="h-5 bg-[#F5F0E8] rounded w-24" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 flex flex-col items-center gap-3 text-center">
            <div className="w-12 h-12 rounded-full bg-[#F5F0E8] flex items-center justify-center">
              <Building2 size={22} className="text-[#6B6460]" aria-hidden="true" />
            </div>
            <p className="text-[16px] font-[600] font-sans text-[#1A1A1A]">
              {search ? 'No sellers match your search' : 'No approved sellers yet'}
            </p>
            {search && (
              <p className="text-[13px] font-sans text-[#6B6460]">Try a different keyword.</p>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#E5E1D8] bg-[#F5F0E8]/40">
                    {['Business', 'Contact', 'Phone', 'Address', 'Created'].map((h) => (
                      <th
                        key={h}
                        className="py-3 px-4 text-[12px] font-[600] font-sans text-[#6B6460] uppercase tracking-[0.06em] text-left"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((seller) => (
                    <tr
                      key={seller.id}
                      onClick={() => router.push(`/admin/sellers/${seller.id}`)}
                      className="border-b border-[#E5E1D8] last:border-0 hover:bg-[#F5F0E8]/30 transition-colors cursor-pointer"
                    >
                      <td className="py-3.5 px-4">
                        <p className="text-[13px] font-[600] font-sans text-[#1A1A1A]">{seller.businessName}</p>
                      </td>
                      <td className="py-3.5 px-4 text-[13px] font-sans text-[#6B6460]">{seller.contactName}</td>
                      <td className="py-3.5 px-4 text-[13px] font-sans text-[#6B6460] whitespace-nowrap">{seller.phone}</td>
                      <td className="py-3.5 px-4 text-[13px] font-sans text-[#6B6460] max-w-[260px] truncate" title={seller.businessAddress}>
                        {seller.businessAddress}
                      </td>
                      <td className="py-3.5 px-4 text-[12px] font-sans text-[#6B6460] whitespace-nowrap">
                        {new Date(seller.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-[#E5E1D8]">
                <p className="text-[12px] font-sans text-[#6B6460]">
                  Page {page} of {totalPages} &middot; {total.toLocaleString()} total
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="h-8 px-3 rounded-lg border border-[#E5E1D8] text-[12px] font-[500] font-sans text-[#6B6460] hover:text-[#1A1A1A] hover:bg-[#F5F0E8] disabled:opacity-40 transition-colors"
                  >
                    Prev
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="h-8 px-3 rounded-lg border border-[#E5E1D8] text-[12px] font-[500] font-sans text-[#6B6460] hover:text-[#1A1A1A] hover:bg-[#F5F0E8] disabled:opacity-40 transition-colors"
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
