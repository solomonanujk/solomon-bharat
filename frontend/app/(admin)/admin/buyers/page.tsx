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
        className="flex items-center gap-1.5 h-8 px-3 rounded border border-error/40 text-error bg-error/5 hover:bg-error/10 text-[12px] font-[600] font-public-sans transition-colors disabled:opacity-50"
      >
        <UserX size={12} aria-hidden="true" />
        {suspend.isPending ? 'Suspending…' : 'Suspend'}
      </button>
      <button
        type="button"
        onClick={() => reactivate.mutate(userId)}
        disabled={suspend.isPending || reactivate.isPending}
        className="flex items-center gap-1.5 h-8 px-3 rounded border border-success/40 text-success bg-success/5 hover:bg-success/10 text-[12px] font-[600] font-public-sans transition-colors disabled:opacity-50"
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
    <div className="flex flex-col gap-0.5 py-2.5 border-b border-border-warm last:border-0">
      <span className="text-[11px] font-[600] uppercase tracking-[0.06em] text-muted-text font-public-sans">
        {label}
      </span>
      <span className="text-[14px] font-public-sans text-primary leading-[1.5]">
        {value ?? <span className="text-muted-text">Not provided</span>}
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
      <div className="w-[420px] max-w-full bg-surface border-l border-border-warm h-full overflow-y-auto flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-warm shrink-0">
          <h2 className="text-[17px] font-[600] font-playfair text-primary">Buyer Profile</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close panel"
            className="w-8 h-8 flex items-center justify-center rounded border border-border-warm text-muted-text hover:text-primary hover:bg-muted-bg transition-colors"
          >
            <X size={15} aria-hidden="true" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 flex flex-col gap-6">
          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-10 bg-muted-bg rounded animate-pulse" />
              ))}
            </div>
          ) : !buyer ? (
            <p className="text-[14px] font-public-sans text-muted-text py-12 text-center">
              Buyer not found.
            </p>
          ) : (
            <>
              {/* Identity */}
              <div>
                <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center mb-3">
                  <Building2 size={20} className="text-accent" aria-hidden="true" />
                </div>
                <p className="text-[18px] font-[600] font-public-sans text-primary leading-tight">
                  {buyer.companyName ?? 'Unnamed company'}
                </p>
                {buyer.contactName && (
                  <p className="text-[13px] font-public-sans text-muted-text mt-0.5">{buyer.contactName}</p>
                )}
              </div>

              {/* Profile fields — only what BuyerProfile actually exposes */}
              <div className="border border-border-warm rounded bg-surface px-4">
                <DetailRow label="Company name" value={buyer.companyName} />
                <DetailRow label="Contact name" value={buyer.contactName} />
                <DetailRow
                  label="Phone"
                  value={buyer.phone ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Phone size={12} className="text-muted-text" aria-hidden="true" />
                      {buyer.phone}
                    </span>
                  ) : null}
                />
                <DetailRow label="Country" value={buyer.country} />
                <DetailRow label="Buyer ID" value={<span className="font-mono text-[12px]">{buyer.id}</span>} />
                <DetailRow label="User ID" value={<span className="font-mono text-[12px]">{buyer.userId}</span>} />
              </div>

              {/* Account action */}
              <div className="border-t border-border-warm pt-5">
                <p className="text-[12px] font-[600] font-public-sans text-muted-text uppercase tracking-[0.05em] mb-3">
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
    <tr className="border-b border-border-warm last:border-0 hover:bg-muted-bg/30 transition-colors">
      <td className="py-3.5 px-4">
        <p className="text-[14px] font-[600] font-public-sans text-primary">
          {buyer.companyName ?? <span className="text-muted-text font-[400]">—</span>}
        </p>
      </td>
      <td className="py-3.5 px-4 text-[13px] font-public-sans text-muted-text">
        {buyer.contactName ?? '—'}
      </td>
      <td className="py-3.5 px-4 text-[13px] font-public-sans text-muted-text">
        {buyer.phone ?? '—'}
      </td>
      <td className="py-3.5 px-4 text-[13px] font-public-sans text-muted-text">
        {buyer.country ?? '—'}
      </td>
      <td className="py-3.5 px-4">
        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={() => onView(buyer)}
            className="flex items-center gap-1 h-7 px-2.5 rounded border border-border-warm text-[11px] font-[600] font-public-sans text-muted-text hover:text-primary hover:bg-muted-bg transition-colors"
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
        <h1 className="text-[28px] leading-[1.3] font-[500] font-playfair text-primary">Buyers</h1>
        <p className="text-[14px] font-public-sans text-muted-text mt-1">
          {total > 0 ? `${total.toLocaleString()} total buyers` : 'Manage registered buyer accounts'}
        </p>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2.5 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-text pointer-events-none" aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search this page by company or contact name…"
            className="w-full h-9 pl-9 pr-3 rounded border border-border-warm bg-surface text-[14px] font-public-sans text-primary placeholder:text-muted-text focus:outline-none focus:border-accent transition-colors"
          />
        </div>
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            className="flex items-center gap-1 h-9 px-3 rounded text-[13px] font-[600] font-public-sans text-muted-text hover:text-primary transition-colors"
          >
            <X size={12} aria-hidden="true" />
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-surface border border-border-warm rounded overflow-hidden">
        {isLoading ? (
          <div className="divide-y divide-border-warm">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="p-4 flex gap-4 animate-pulse">
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted-bg rounded w-36" />
                  <div className="h-3 bg-muted-bg rounded w-44" />
                </div>
                <div className="h-5 bg-muted-bg rounded w-20" />
                <div className="h-5 bg-muted-bg rounded w-16" />
              </div>
            ))}
          </div>
        ) : !filteredBuyers.length ? (
          <div className="py-16 flex flex-col items-center gap-3 text-center">
            <div className="w-12 h-12 rounded-full bg-muted-bg flex items-center justify-center">
              <Users size={22} className="text-muted-text" aria-hidden="true" />
            </div>
            <p className="text-[15px] font-[600] font-public-sans text-primary">No buyers found</p>
            {search && (
              <p className="text-[13px] font-public-sans text-muted-text">Try adjusting your search.</p>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border-warm bg-muted-bg/40">
                    {['Company', 'Contact', 'Phone', 'Country', ''].map((h) => (
                      <th
                        key={h}
                        className="py-3 px-4 text-left text-[12px] font-[600] font-public-sans text-muted-text uppercase tracking-[0.06em]"
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
              <div className="flex items-center justify-between px-4 py-3 border-t border-border-warm">
                <p className="text-[12px] font-public-sans text-muted-text">
                  {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total.toLocaleString()}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className={cn(
                      'h-8 px-3 rounded border border-border-warm text-[12px] font-[500] font-public-sans text-muted-text transition-colors',
                      'hover:text-primary hover:bg-muted-bg disabled:opacity-40'
                    )}
                  >
                    Prev
                  </button>
                  <span className="h-8 px-3 flex items-center text-[12px] font-public-sans text-muted-text">
                    {page} / {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className={cn(
                      'h-8 px-3 rounded border border-border-warm text-[12px] font-[500] font-public-sans text-muted-text transition-colors',
                      'hover:text-primary hover:bg-muted-bg disabled:opacity-40'
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
