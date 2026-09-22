'use client'

import { useMemo, useState } from 'react'
import { Building2, ExternalLink, Phone, Search, UserCheck, UserX, Users, X } from 'lucide-react'
import { useAdminBuyer, useAdminBuyers } from '@/hooks/queries/useBuyerProfile'
import { useReactivateUser, useSuspendUser } from '@/hooks/queries/useAdmin'
import type { BuyerProfile } from '@/types'
import { cn } from '@/lib/utils'

const LIMIT = 20

// ─── Suspend / Reactivate actions ──────────────────────────────────────────────
// BuyerProfile carries no `status` field (unlike the old AdminUser projection),
// so we can't tell from the list/detail data alone whether the underlying user
// account is currently active or suspended. Both actions are exposed side by
// side and the hooks' own toasts confirm which one actually applied.

function SuspendReactivateButtons({ userId }: { userId: string }) {
  const suspend = useSuspendUser()
  const reactivate = useReactivateUser()

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => suspend.mutate(userId)}
        disabled={suspend.isPending || reactivate.isPending}
        className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-red-300 text-red-500 bg-red-50 hover:bg-red-100 text-[12px] font-[600] font-sans transition-colors disabled:opacity-50"
      >
        <UserX size={12} aria-hidden="true" />
        {suspend.isPending ? 'Suspending…' : 'Suspend'}
      </button>
      <button
        type="button"
        onClick={() => reactivate.mutate(userId)}
        disabled={suspend.isPending || reactivate.isPending}
        className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-emerald-300 text-emerald-600 bg-emerald-50 hover:bg-emerald-100 text-[12px] font-[600] font-sans transition-colors disabled:opacity-50"
      >
        <UserCheck size={12} aria-hidden="true" />
        {reactivate.isPending ? 'Reactivating…' : 'Reactivate'}
      </button>
    </div>
  )
}

// ─── Detail row (drawer) ────────────────────────────────────────────────────────

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-2.5 border-b border-[#E5E1D8] last:border-0">
      <span className="text-[11px] font-[600] uppercase tracking-[0.06em] text-[#6B6460] font-sans">
        {label}
      </span>
      <span className="text-[14px] font-sans text-[#1A1A1A] leading-[1.5]">
        {value ?? <span className="text-[#6B6460]">Not provided</span>}
      </span>
    </div>
  )
}

// ─── Buyer detail drawer ────────────────────────────────────────────────────────

function BuyerDrawer({ buyerId, onClose }: { buyerId: string; onClose: () => void }) {
  const { data: buyer, isLoading } = useAdminBuyer(buyerId)

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/30" onClick={onClose} aria-hidden="true" />
      <div className="w-[420px] max-w-full bg-white border-l border-[#E5E1D8] h-full overflow-y-auto flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E1D8] shrink-0">
          <h2 className="text-[17px] font-[600] font-sans text-[#1A1A1A]">Buyer Profile</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close panel"
            className="w-8 h-8 flex items-center justify-center rounded border border-[#E5E1D8] text-[#6B6460] hover:text-[#1A1A1A] hover:bg-[#F5F0E8] transition-colors"
          >
            <X size={15} aria-hidden="true" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 flex flex-col gap-6">
          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-10 bg-[#F5F0E8] rounded animate-pulse" />
              ))}
            </div>
          ) : !buyer ? (
            <p className="text-[14px] font-sans text-[#6B6460] py-12 text-center">
              Buyer not found.
            </p>
          ) : (
            <>
              {/* Identity */}
              <div>
                <div className="w-12 h-12 rounded-full bg-[#A68B67]/10 flex items-center justify-center mb-3">
                  <Building2 size={20} className="text-[#A68B67]" aria-hidden="true" />
                </div>
                <p className="text-[18px] font-[600] font-sans text-[#1A1A1A] leading-tight">
                  {buyer.companyName ?? 'Unnamed company'}
                </p>
                {buyer.contactName && (
                  <p className="text-[13px] font-sans text-[#6B6460] mt-0.5">{buyer.contactName}</p>
                )}
              </div>

              {/* Profile fields — only what BuyerProfile actually exposes */}
              <div className="border border-[#E5E1D8] rounded bg-white px-4">
                <DetailRow label="Company name" value={buyer.companyName} />
                <DetailRow label="Contact name" value={buyer.contactName} />
                <DetailRow
                  label="Phone"
                  value={buyer.phone ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Phone size={12} className="text-[#6B6460]" aria-hidden="true" />
                      {buyer.phone}
                    </span>
                  ) : null}
                />
                <DetailRow label="Country" value={buyer.country} />
                <DetailRow label="Buyer ID" value={<span className="font-mono text-[12px]">{buyer.id}</span>} />
                <DetailRow label="User ID" value={<span className="font-mono text-[12px]">{buyer.userId}</span>} />
              </div>

              {/* Account action */}
              <div className="border-t border-[#E5E1D8] pt-5">
                <p className="text-[12px] font-[600] font-sans text-[#6B6460] uppercase tracking-[0.05em] mb-3">
                  Account access
                </p>
                <SuspendReactivateButtons userId={buyer.userId} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Table row ──────────────────────────────────────────────────────────────────

function BuyerRow({ buyer, onView }: { buyer: BuyerProfile; onView: (b: BuyerProfile) => void }) {
  return (
    <tr className="border-b border-[#E5E1D8] last:border-0 hover:bg-[#F5F0E8]/30 transition-colors">
      <td className="py-3.5 px-4">
        <p className="text-[14px] font-[600] font-sans text-[#1A1A1A]">
          {buyer.companyName ?? <span className="text-[#6B6460] font-[400]">—</span>}
        </p>
      </td>
      <td className="py-3.5 px-4 text-[13px] font-sans text-[#6B6460]">
        {buyer.contactName ?? '—'}
      </td>
      <td className="py-3.5 px-4 text-[13px] font-sans text-[#6B6460]">
        {buyer.phone ?? '—'}
      </td>
      <td className="py-3.5 px-4 text-[13px] font-sans text-[#6B6460]">
        {buyer.country ?? '—'}
      </td>
      <td className="py-3.5 px-4">
        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={() => onView(buyer)}
            className="flex items-center gap-1 h-7 px-2.5 rounded border border-[#E5E1D8] text-[11px] font-[600] font-sans text-[#6B6460] hover:text-[#1A1A1A] hover:bg-[#F5F0E8] transition-colors"
          >
            <ExternalLink size={11} aria-hidden="true" />
            View
          </button>
        </div>
      </td>
    </tr>
  )
}

// ─── Page ───────────────────────────────────────────────────────────────────────

export default function AdminBuyersPage() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [viewBuyerId, setViewBuyerId] = useState<string | null>(null)

  const { data, isLoading } = useAdminBuyers({ page, limit: LIMIT })

  const buyers = data?.items ?? []
  const total = data?.total ?? 0
  const limit = data?.limit ?? LIMIT
  const totalPages = data?.totalPages ?? Math.max(1, Math.ceil(total / limit))

  // Client-side filter over the current page of results — the admin buyers
  // endpoint takes no search param, so this only narrows what's already loaded.
  const filteredBuyers = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return buyers
    return buyers.filter((b) =>
      (b.companyName ?? '').toLowerCase().includes(q) ||
      (b.contactName ?? '').toLowerCase().includes(q)
    )
  }, [buyers, search])

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-[28px] leading-[1.3] font-[500] font-sans text-[#1A1A1A]">Buyers</h1>
        <p className="text-[14px] font-sans text-[#6B6460] mt-1">
          {total > 0 ? `${total.toLocaleString()} total buyers` : 'Manage registered buyer accounts'}
        </p>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2.5 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B6460] pointer-events-none" aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search this page by company or contact name…"
            className="w-full h-9 pl-9 pr-3 rounded-lg border border-[#E5E1D8] bg-white text-[14px] font-sans text-[#1A1A1A] placeholder:text-[#6B6460] focus:outline-none focus:border-[#A68B67] transition-colors"
          />
        </div>
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            className="flex items-center gap-1 h-9 px-3 rounded text-[13px] font-[600] font-sans text-[#6B6460] hover:text-[#1A1A1A] transition-colors"
          >
            <X size={12} aria-hidden="true" />
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white border border-[#E5E1D8] rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="divide-y divide-[#E5E1D8]">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="p-4 flex gap-4 animate-pulse">
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-[#F5F0E8] rounded w-36" />
                  <div className="h-3 bg-[#F5F0E8] rounded w-44" />
                </div>
                <div className="h-5 bg-[#F5F0E8] rounded w-20" />
                <div className="h-5 bg-[#F5F0E8] rounded w-16" />
              </div>
            ))}
          </div>
        ) : !filteredBuyers.length ? (
          <div className="py-16 flex flex-col items-center gap-3 text-center">
            <div className="w-12 h-12 rounded-full bg-[#F5F0E8] flex items-center justify-center">
              <Users size={22} className="text-[#6B6460]" aria-hidden="true" />
            </div>
            <p className="text-[15px] font-[600] font-sans text-[#1A1A1A]">No buyers found</p>
            {search && (
              <p className="text-[13px] font-sans text-[#6B6460]">Try adjusting your search.</p>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#E5E1D8] bg-[#F5F0E8]/40">
                    {['Company', 'Contact', 'Phone', 'Country', ''].map((h) => (
                      <th
                        key={h}
                        className="py-3 px-4 text-left text-[12px] font-[600] font-sans text-[#6B6460] uppercase tracking-[0.06em]"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredBuyers.map((b) => (
                    <BuyerRow key={b.id} buyer={b} onView={(buyer) => setViewBuyerId(buyer.id)} />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {total > limit && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-[#E5E1D8]">
                <p className="text-[12px] font-sans text-[#6B6460]">
                  {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total.toLocaleString()}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className={cn(
                      'h-8 px-3 rounded-lg border border-[#E5E1D8] text-[12px] font-[500] font-sans text-[#6B6460] transition-colors',
                      'hover:text-[#1A1A1A] hover:bg-[#F5F0E8] disabled:opacity-40'
                    )}
                  >
                    Prev
                  </button>
                  <span className="h-8 px-3 flex items-center text-[12px] font-sans text-[#6B6460]">
                    {page} / {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className={cn(
                      'h-8 px-3 rounded-lg border border-[#E5E1D8] text-[12px] font-[500] font-sans text-[#6B6460] transition-colors',
                      'hover:text-[#1A1A1A] hover:bg-[#F5F0E8] disabled:opacity-40'
                    )}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {viewBuyerId && (
        <BuyerDrawer buyerId={viewBuyerId} onClose={() => setViewBuyerId(null)} />
      )}
    </div>
  )
}
