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
          <h1 className="text-[28px] leading-[1.3] font-[500] font-playfair text-primary">Sellers</h1>
          <p className="text-[14px] font-public-sans text-muted-text mt-1">Approved sellers on the platform</p>
        </div>
        {total > 0 && (
          <p className="text-[13px] font-public-sans text-muted-text self-end">
            {total.toLocaleString()} seller{total !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* Search */}
      <div className="mb-4 relative max-w-[320px]">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-text" aria-hidden="true" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, contact, or phone…"
          className={cn(
            'w-full h-9 pl-9 pr-3 rounded border border-border-warm bg-surface',
            'text-[14px] font-public-sans text-primary placeholder:text-muted-text',
            'focus:outline-none focus:border-primary/40 transition-colors'
          )}
        />
      </div>

      {/* Table */}
      <div className="bg-surface border border-border-warm rounded overflow-hidden">
        {isLoading ? (
          <div className="divide-y divide-border-warm">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="p-4 flex gap-4 animate-pulse">
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 bg-muted-bg rounded w-40" />
                  <div className="h-3 bg-muted-bg rounded w-56" />
                </div>
                <div className="h-5 bg-muted-bg rounded w-24" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 flex flex-col items-center gap-3 text-center">
            <div className="w-12 h-12 rounded-full bg-muted-bg flex items-center justify-center">
              <Building2 size={22} className="text-muted-text" aria-hidden="true" />
            </div>
            <p className="text-[16px] font-[600] font-public-sans text-primary">
              {search ? 'No sellers match your search' : 'No approved sellers yet'}
            </p>
            {search && (
              <p className="text-[13px] font-public-sans text-muted-text">Try a different keyword.</p>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border-warm bg-muted-bg/40">
                    {['Business', 'Contact', 'Phone', 'Address', 'Created'].map((h) => (
                      <th
                        key={h}
                        className="py-3 px-4 text-[12px] font-[600] font-public-sans text-muted-text uppercase tracking-[0.06em] text-left"
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
                      className="border-b border-border-warm last:border-0 hover:bg-muted-bg/30 transition-colors cursor-pointer"
                    >
                      <td className="py-3.5 px-4">
                        <p className="text-[13px] font-[600] font-public-sans text-primary">{seller.businessName}</p>
                      </td>
                      <td className="py-3.5 px-4 text-[13px] font-public-sans text-muted-text">{seller.contactName}</td>
                      <td className="py-3.5 px-4 text-[13px] font-public-sans text-muted-text whitespace-nowrap">{seller.phone}</td>
                      <td className="py-3.5 px-4 text-[13px] font-public-sans text-muted-text max-w-[260px] truncate" title={seller.businessAddress}>
                        {seller.businessAddress}
                      </td>
                      <td className="py-3.5 px-4 text-[12px] font-public-sans text-muted-text whitespace-nowrap">
                        {new Date(seller.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border-warm">
                <p className="text-[12px] font-public-sans text-muted-text">
                  Page {page} of {totalPages} &middot; {total.toLocaleString()} total
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
