'use client'

import { useState } from 'react'
import { BadgeCheck, Ban, Search, Store } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  useAdminBrands, useCommissionDefaults, useUpdateAdminBrand, useUpdateCommissionDefaults,
} from '@/hooks/queries/useAdminBrands'
import type { AdminBrand, AdminBrandUpdateInput, BrandStatus, CommissionDefaults } from '@/types/brand-admin'
import { cn } from '@/lib/utils'

const LIMIT = 20
const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`

function parsePercent(raw: string): number | null | 'invalid' {
  const t = raw.trim()
  if (t === '') return null
  const n = Number(t)
  if (!Number.isFinite(n) || n < 0 || n > 100) return 'invalid'
  return n
}

// ─── Commission defaults ──────────────────────────────────────────────────────

function CommissionDefaultsCard() {
  const { data, isLoading } = useCommissionDefaults()
  const update = useUpdateCommissionDefaults()
  const [first, setFirst] = useState<string | null>(null)
  const [repeat, setRepeat] = useState<string | null>(null)
  const [error, setError] = useState('')

  const firstValue = first ?? (data ? String(data.first) : '')
  const repeatValue = repeat ?? (data ? String(data.repeat) : '')

  function save() {
    const f = parsePercent(firstValue)
    const r = parsePercent(repeatValue)
    if (f === 'invalid' || r === 'invalid' || f === null || r === null) {
      setError('Both rates are required and must be between 0 and 100.')
      return
    }
    setError('')
    const payload: CommissionDefaults = { first: f, repeat: r }
    update.mutate(payload, { onSuccess: () => { setFirst(null); setRepeat(null) } })
  }

  const field = 'h-10 w-28 rounded-[4px] border border-line bg-white px-3 text-[14px] font-sans text-ink focus:outline-none focus:border-forest'

  return (
    <section className="bg-white border border-line rounded-xl p-5 mb-6" aria-labelledby="commission-defaults-heading">
      <h2 id="commission-defaults-heading" className="text-[15px] font-[600] font-sans text-ink">Commission defaults</h2>
      <p className="text-[13px] font-sans text-muted mt-1">
        Applied to every brand without its own override. The rate is locked on each order when it is paid.
        Changes affect future paid orders only and are recorded in the audit log.
      </p>
      <div className="mt-4 flex flex-wrap items-end gap-4">
        <label className="block">
          <span className="block text-[12px] font-[600] font-sans text-muted mb-1">First paid order (%)</span>
          <input
            type="number" min={0} max={100} step="0.1" inputMode="decimal"
            value={firstValue} onChange={(e) => setFirst(e.target.value)} disabled={isLoading}
            className={field}
          />
        </label>
        <label className="block">
          <span className="block text-[12px] font-[600] font-sans text-muted mb-1">Every later order (%)</span>
          <input
            type="number" min={0} max={100} step="0.1" inputMode="decimal"
            value={repeatValue} onChange={(e) => setRepeat(e.target.value)} disabled={isLoading}
            className={field}
          />
        </label>
        <Button onClick={save} loading={update.isPending} disabled={isLoading}>Save defaults</Button>
      </div>
      {error && <p role="alert" className="text-[12.5px] font-sans text-error mt-2">{error}</p>}
    </section>
  )
}

// ─── Badges ───────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: BrandStatus }) {
  return (
    <span className={cn(
      'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-[600] font-sans',
      status === 'ACTIVE' ? 'bg-selected text-forest' : 'bg-red-50 text-error',
    )}>
      {status === 'ACTIVE' ? 'Active' : 'Suspended'}
    </span>
  )
}

// ─── Manage dialog ────────────────────────────────────────────────────────────

function ManageBrandDialog({ brand, defaults, onClose }: {
  brand: AdminBrand
  defaults: CommissionDefaults | undefined
  onClose: () => void
}) {
  const update = useUpdateAdminBrand()
  const [name, setName] = useState(brand.name)
  const [first, setFirst] = useState(brand.commissionFirstOverride == null ? '' : String(brand.commissionFirstOverride))
  const [repeat, setRepeat] = useState(brand.commissionRepeatOverride == null ? '' : String(brand.commissionRepeatOverride))
  const [error, setError] = useState('')
  const [confirmSuspend, setConfirmSuspend] = useState(false)

  const f = parsePercent(first)
  const r = parsePercent(repeat)
  const effFirst = f === 'invalid' ? null : (f ?? defaults?.first ?? null)
  const effRepeat = r === 'invalid' ? null : (r ?? defaults?.repeat ?? null)

  function saveDetails() {
    if (f === 'invalid' || r === 'invalid') {
      setError('Commission overrides must be between 0 and 100 (leave blank to use the default).')
      return
    }
    const trimmed = name.trim()
    if (trimmed.length < 2 || trimmed.length > 60) {
      setError('Brand name must be 2 to 60 characters.')
      return
    }
    setError('')
    const input: AdminBrandUpdateInput = {}
    if (trimmed !== brand.name) input.name = trimmed
    if (f !== brand.commissionFirstOverride) input.commissionFirstOverride = f
    if (r !== brand.commissionRepeatOverride) input.commissionRepeatOverride = r
    if (Object.keys(input).length === 0) { onClose(); return }
    update.mutate({ id: brand.id, input }, { onSuccess: onClose })
  }

  const suspended = brand.status === 'SUSPENDED'
  const field = 'h-10 w-full rounded-[4px] border border-line bg-white px-3 text-[14px] font-sans text-ink focus:outline-none focus:border-forest'

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{brand.name}</DialogTitle>
          <DialogDescription>
            {brand.seller.businessName} &middot; {brand.seller.contactName} &middot; {brand.seller.email}
          </DialogDescription>
        </DialogHeader>

        {confirmSuspend ? (
          <div className="space-y-4">
            <p className="text-[14px] font-sans text-ink">
              {suspended
                ? `Reactivate ${brand.name}? Its products become visible to buyers again.`
                : `Suspend ${brand.name}? All of its products are hidden from buyers while it is suspended. Existing paid orders are not changed.`}
            </p>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setConfirmSuspend(false)}>Back</Button>
              <Button
                variant={suspended ? 'primary' : 'destructive'}
                loading={update.isPending}
                onClick={() => update.mutate(
                  {
                    id: brand.id,
                    input: { status: suspended ? 'ACTIVE' : 'SUSPENDED' },
                    successMessage: suspended ? 'Brand reactivated' : 'Brand suspended',
                  },
                  { onSuccess: onClose },
                )}
              >
                {suspended ? 'Reactivate brand' : 'Suspend brand'}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex flex-wrap gap-2 items-center">
              <StatusBadge status={brand.status} />
              {brand.isVerified && (
                <span className="inline-flex items-center gap-1 text-[11px] font-[600] font-sans text-forest">
                  <BadgeCheck size={13} aria-hidden="true" /> Verified
                </span>
              )}
              <span className="text-[12px] font-sans text-muted">
                {brand.productCount} product{brand.productCount !== 1 ? 's' : ''} &middot; {brand.orderStats.ordersCount} paid order{brand.orderStats.ordersCount !== 1 ? 's' : ''} &middot; {inr(brand.orderStats.gmv)} GMV
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary" size="sm" loading={update.isPending}
                onClick={() => update.mutate({
                  id: brand.id,
                  input: { isVerified: !brand.isVerified },
                  successMessage: brand.isVerified ? 'Verified badge removed' : 'Brand verified',
                })}
              >
                {brand.isVerified ? 'Unverify brand' : 'Verify brand'}
              </Button>
              <Button variant={suspended ? 'secondary' : 'ghost'} size="sm" onClick={() => setConfirmSuspend(true)}>
                {suspended ? 'Reactivate' : 'Suspend'}
              </Button>
            </div>

            <label className="block">
              <span className="block text-[12px] font-[600] font-sans text-muted mb-1">Brand name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} className={field} />
            </label>

            <fieldset className="border border-line rounded-lg p-4">
              <legend className="px-1 text-[12px] font-[600] font-sans text-muted">Commission overrides (%)</legend>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="block text-[12px] font-sans text-muted mb-1">First paid order</span>
                  <input
                    type="number" min={0} max={100} step="0.1" inputMode="decimal"
                    value={first} onChange={(e) => setFirst(e.target.value)}
                    placeholder={defaults ? `Default ${defaults.first}` : 'Default'} className={field}
                  />
                </label>
                <label className="block">
                  <span className="block text-[12px] font-sans text-muted mb-1">Later orders</span>
                  <input
                    type="number" min={0} max={100} step="0.1" inputMode="decimal"
                    value={repeat} onChange={(e) => setRepeat(e.target.value)}
                    placeholder={defaults ? `Default ${defaults.repeat}` : 'Default'} className={field}
                  />
                </label>
              </div>
              <p className="text-[12.5px] font-sans text-ink mt-3">
                Effective rates: <strong>{effFirst ?? '–'}%</strong> on the first paid order, <strong>{effRepeat ?? '–'}%</strong> on every later one.
              </p>
              <p className="text-[12px] font-sans text-muted mt-1">Leave a field blank to clear the override and use the platform default.</p>
            </fieldset>

            {error && <p role="alert" className="text-[12.5px] font-sans text-error">{error}</p>}

            <DialogFooter>
              <Button variant="ghost" onClick={onClose}>Close</Button>
              <Button onClick={saveDetails} loading={update.isPending}>Save changes</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminBrandsPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<BrandStatus | ''>('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const { data, isLoading } = useAdminBrands({
    page, limit: LIMIT, status: status || undefined, search: search.trim() || undefined,
  })
  const { data: defaults } = useCommissionDefaults()

  const brands = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = data?.totalPages ?? 1
  const selected = brands.find((b) => b.id === selectedId) ?? null

  const rate = (override: number | null, fallback: number | undefined) =>
    override != null ? `${override}% (override)` : fallback != null ? `${fallback}%` : '–'

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[28px] leading-[1.3] font-[500] font-sans text-ink">Brands</h1>
          <p className="text-[14px] font-sans text-muted mt-1">Marketplace brands: verification, suspension and commission</p>
        </div>
        {total > 0 && <p className="text-[13px] font-sans text-muted self-end">{total.toLocaleString()} brand{total !== 1 ? 's' : ''}</p>}
      </div>

      <CommissionDefaultsCard />

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative w-full max-w-[320px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input
            type="search" aria-label="Search brands" value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search by brand name…"
            className="w-full h-10 pl-9 pr-3 rounded-lg border border-line bg-white text-[14px] font-sans text-ink placeholder:text-muted focus:outline-none focus:border-forest"
          />
        </div>
        <select
          aria-label="Filter by status" value={status}
          onChange={(e) => { setStatus(e.target.value as BrandStatus | ''); setPage(1) }}
          className="h-10 rounded-lg border border-line bg-white px-3 text-[14px] font-sans text-ink focus:outline-none focus:border-forest"
        >
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="SUSPENDED">Suspended</option>
        </select>
      </div>

      <div className="bg-white border border-line rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="divide-y divide-line">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="p-4 animate-pulse"><div className="h-4 bg-ivory rounded w-56" /></div>
            ))}
          </div>
        ) : brands.length === 0 ? (
          <div className="py-16 flex flex-col items-center gap-3 text-center">
            <div className="w-12 h-12 rounded-full bg-ivory flex items-center justify-center">
              <Store size={22} className="text-muted" aria-hidden="true" />
            </div>
            <p className="text-[16px] font-[600] font-sans text-ink">No brands found</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-line bg-ivory/60">
                    {['Brand', 'Seller contact', 'Status', 'Products', 'Orders / GMV', 'Commission (first / later)', ''].map((h, i) => (
                      <th key={i} className="py-3 px-4 text-[12px] font-[600] font-sans text-muted uppercase tracking-[0.06em] text-left whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {brands.map((b) => (
                    <tr key={b.id} className="border-b border-line last:border-0 hover:bg-ivory/40 transition-colors">
                      <td className="py-3.5 px-4">
                        <p className="text-[13px] font-[600] font-sans text-ink flex items-center gap-1.5">
                          {b.name}
                          {b.isVerified && <BadgeCheck size={14} className="text-forest" aria-label="Verified" />}
                        </p>
                        <p className="text-[12px] font-sans text-muted">{b.seller.businessName}</p>
                      </td>
                      <td className="py-3.5 px-4 text-[13px] font-sans text-muted">
                        <p className="text-ink">{b.seller.contactName}</p>
                        <p>{b.seller.email}</p>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <StatusBadge status={b.status} />
                        {b.status === 'SUSPENDED' && <Ban size={12} className="inline ml-1 text-error" aria-hidden="true" />}
                      </td>
                      <td className="py-3.5 px-4 text-[13px] font-sans text-ink tabular-nums">{b.productCount}</td>
                      <td className="py-3.5 px-4 text-[13px] font-sans text-ink whitespace-nowrap tabular-nums">
                        {b.orderStats.ordersCount} / {inr(b.orderStats.gmv)}
                      </td>
                      <td className="py-3.5 px-4 text-[12.5px] font-sans text-muted whitespace-nowrap">
                        {rate(b.commissionFirstOverride, defaults?.first)} / {rate(b.commissionRepeatOverride, defaults?.repeat)}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <Button variant="secondary" size="sm" onClick={() => setSelectedId(b.id)} aria-label={`Manage ${b.name}`}>Manage</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-line">
                <p className="text-[12px] font-sans text-muted">Page {page} of {totalPages} &middot; {total.toLocaleString()} total</p>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Prev</Button>
                  <Button variant="ghost" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>Next</Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {selected && <ManageBrandDialog key={selected.id} brand={selected} defaults={defaults} onClose={() => setSelectedId(null)} />}
    </div>
  )
}
