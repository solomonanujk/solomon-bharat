'use client'

import type { ElementType } from 'react'
import Link from 'next/link'
import {
  Building2, Users, ShoppingBag, CreditCard,
  Clock, TrendingUp, PackageCheck, Truck,
  Package, ShoppingCart, BarChart3, FileCheck,
} from 'lucide-react'
import { useAdminDashboard, useAdminReport } from '@/hooks/queries/useAdmin'
import { cn } from '@/lib/utils'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatINR(n: number | undefined | null) {
  if (n == null || isNaN(n)) return '₹0'
  if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(1)}Cr`
  if (n >= 100_000) return `₹${(n / 100_000).toFixed(1)}L`
  if (n >= 1_000) return `₹${(n / 1_000).toFixed(0)}K`
  return `₹${n.toLocaleString('en-IN')}`
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, icon: Icon, accent, sub, href }: {
  label: string; value: string | number; icon: ElementType; accent?: boolean; sub?: string; href?: string
}) {
  const content = (
    <>
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-[500] font-public-sans text-muted-text">{label}</span>
        <div className={cn('w-8 h-8 rounded flex items-center justify-center', accent ? 'bg-accent/10' : 'bg-muted-bg')}>
          <Icon size={16} className={accent ? 'text-accent' : 'text-muted-text'} aria-hidden="true" />
        </div>
      </div>
      <div>
        <p className="text-[28px] font-[600] font-playfair text-primary leading-none">{value}</p>
        {sub && <p className="text-[12px] font-public-sans text-muted-text mt-1">{sub}</p>}
      </div>
    </>
  )
  const cls = cn(
    'bg-surface border rounded p-5 flex flex-col gap-3',
    accent ? 'border-accent/30 bg-accent/[3%]' : 'border-border-warm',
    href && 'hover:border-primary/30 transition-colors'
  )
  if (href) {
    return <Link href={href} className={cls}>{content}</Link>
  }
  return <div className={cls}>{content}</div>
}

function StatCardSkeleton() {
  return (
    <div className="bg-surface border border-border-warm rounded p-5 space-y-3 animate-pulse">
      <div className="flex justify-between"><div className="h-3 bg-muted-bg rounded w-24" /><div className="w-8 h-8 bg-muted-bg rounded" /></div>
      <div className="h-8 bg-muted-bg rounded w-20" />
    </div>
  )
}

// ─── Revenue chart (best-effort — report row shape is generic) ───────────────

const DATE_KEYS = ['date', 'day', 'period', 'label', 'month']
const VALUE_KEYS = ['revenue', 'amount', 'total', 'value', 'gmv']

function pickKey(row: Record<string, unknown>, candidates: string[]) {
  return candidates.find((k) => k in row)
}

function RevenueChart() {
  const { data = [], isLoading } = useAdminReport({ type: 'revenue' })

  const dateKey = data[0] ? pickKey(data[0], DATE_KEYS) : undefined
  const valueKey = data[0] ? pickKey(data[0], VALUE_KEYS) : undefined
  const usable = !!dateKey && !!valueKey

  const values = usable ? data.map((d) => Number(d[valueKey!]) || 0) : []
  const max = Math.max(...values, 1)

  return (
    <div className="bg-surface border border-border-warm rounded p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-[16px] font-[600] font-public-sans text-primary">Revenue Over Time</h2>
          <p className="text-[12px] font-public-sans text-muted-text mt-0.5">Gross Merchandise Value, INR</p>
        </div>
        <Link href="/admin/reports" className="text-[12px] font-[600] font-public-sans text-accent hover:text-accent-hover transition-colors flex items-center gap-1">
          <BarChart3 size={13} aria-hidden="true" />
          Full reports →
        </Link>
      </div>

      {isLoading ? (
        <div className="h-[140px] bg-muted-bg/30 rounded animate-pulse" />
      ) : !usable || data.length === 0 ? (
        <div className="py-10 text-center">
          <p className="text-[13px] font-public-sans text-muted-text">
            {data.length === 0 ? 'No revenue data yet.' : 'Revenue report is available in full detail on the Reports page.'}
          </p>
        </div>
      ) : (
        <div className="flex items-end gap-[2px] h-[140px]">
          {data.map((bucket, i) => {
            const v = Number(bucket[valueKey!]) || 0
            const label = String(bucket[dateKey!])
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative" title={`${label}: ${formatINR(v)}`}>
                <div
                  className="w-full bg-accent/30 group-hover:bg-accent rounded-t transition-colors"
                  style={{ height: `${Math.max(v > 0 ? 4 : 0, (v / max) * 100)}%` }}
                />
              </div>
            )
          })}
        </div>
      )}

      {usable && data.length > 0 && (
        <p className="text-[12px] font-public-sans text-muted-text mt-3">
          Total: <span className="font-[600] text-primary">{formatINR(values.reduce((s, v) => s + v, 0))}</span>
        </p>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminOverviewPage() {
  const { data: stats, isLoading } = useAdminDashboard()

  const cards = stats ? [
    { label: 'Pending Seller Applications', value: stats.pendingSellerApplications, icon: Clock, accent: stats.pendingSellerApplications > 0, sub: stats.pendingSellerApplications > 0 ? 'Needs review' : 'All clear', href: '/admin/seller-applications' },
    { label: 'Pending Product Reviews', value: stats.pendingProductReviews, icon: FileCheck, accent: stats.pendingProductReviews > 0, sub: stats.pendingProductReviews > 0 ? 'Needs review' : 'All clear', href: '/admin/products?approvalStatus=PENDING' },
    { label: 'Active Orders', value: stats.activeOrders.toLocaleString(), icon: ShoppingBag, href: '/admin/orders' },
    { label: 'Orders Awaiting Collection', value: stats.ordersAwaitingCollection, icon: PackageCheck, accent: stats.ordersAwaitingCollection > 0, href: '/admin/orders' },
    { label: 'Pending Payouts', value: stats.pendingPayoutsCount, icon: CreditCard, href: '/admin/payouts' },
    { label: 'Pending Payout Value', value: formatINR(stats.pendingPayoutsAmount), icon: TrendingUp, accent: stats.pendingPayoutsAmount > 0, sub: 'Awaiting disbursement', href: '/admin/payouts' },
    { label: 'Total GMV', value: formatINR(stats.totalGMV), icon: TrendingUp, accent: true, sub: 'All time' },
    { label: 'Total Buyers', value: stats.totalBuyers.toLocaleString(), icon: Users, href: '/admin/buyers' },
    { label: 'Total Approved Sellers', value: stats.totalApprovedSellers.toLocaleString(), icon: Building2, href: '/admin/sellers' },
  ] : []

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-[28px] leading-[1.3] font-[500] font-playfair text-primary">Admin Overview</h1>
        <p className="text-[14px] font-public-sans text-muted-text mt-1">Platform health at a glance</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
        {isLoading ? Array.from({ length: 9 }).map((_, i) => <StatCardSkeleton key={i} />) : cards.map((c) => <StatCard key={c.label} {...c} />)}
      </div>

      {/* Revenue chart — full width */}
      <RevenueChart />

      {/* Quick actions (prd.md §9.3) */}
      <div>
        <h2 className="text-[14px] font-[600] font-public-sans text-muted-text uppercase tracking-[0.06em] mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { href: '/admin/products?approvalStatus=PENDING', label: 'Review Pending Products', icon: FileCheck },
            { href: '/admin/orders', label: 'View New Orders', icon: ShoppingCart },
            { href: '/admin/payouts', label: 'Process Payouts', icon: Package },
            { href: '/admin/seller-applications', label: 'Review Seller Applications', icon: Truck },
          ].map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href}
              className="flex items-center gap-2.5 p-4 bg-surface border border-border-warm rounded hover:border-primary/30 hover:bg-muted-bg transition-colors">
              <Icon size={16} className="text-muted-text flex-shrink-0" aria-hidden="true" />
              <span className="text-[13px] font-[600] font-public-sans text-primary">{label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
