'use client'

import type { ElementType } from 'react'
import Link from 'next/link'
import {
  Building2, Users, ShoppingBag, CreditCard,
  Clock, TrendingUp, PackageCheck,
  Package, ShoppingCart, BarChart3, FileCheck,
  AlertCircle, ArrowRight,
} from 'lucide-react'
import { useAdminDashboard, useAdminReport } from '@/hooks/queries/useAdmin'
import { cn } from '@/lib/utils'

function formatINR(n: number | undefined | null) {
  if (n == null || isNaN(n)) return '₹0'
  if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(1)}Cr`
  if (n >= 100_000) return `₹${(n / 100_000).toFixed(1)}L`
  if (n >= 1_000) return `₹${(n / 1_000).toFixed(0)}K`
  return `₹${n.toLocaleString('en-IN')}`
}

// ─── KPI card ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, icon: Icon, iconBg, iconColor, sub, href, featured }: {
  label: string
  value: string | number
  icon: ElementType
  iconBg: string
  iconColor: string
  sub?: string
  href?: string
  featured?: boolean
}) {
  const inner = (
    <div className={cn(
      'rounded-xl border p-5 flex flex-col gap-3 transition-all',
      featured
        ? 'bg-[#0F241D] border-[#183D33]'
        : 'bg-white border-[#D9E2DA] hover:border-[#6B7E6B] hover:shadow-sm',
    )}>
      <div className="flex items-center justify-between">
        <span className={cn('text-[12px] font-[500] font-sans', featured ? 'text-[#D9E2DA]' : 'text-[#183D33B3]')}>
          {label}
        </span>
        <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', iconBg)}>
          <Icon size={15} className={iconColor} aria-hidden="true" />
        </div>
      </div>
      <div>
        <p className={cn('text-[30px] font-[700] font-sans leading-none tabular-nums', featured ? 'text-white' : 'text-[#0F241D]')}>
          {value}
        </p>
        {sub && (
          <p className={cn('text-[11.5px] font-sans mt-1.5', featured ? 'text-[#D9E2DA]' : 'text-[#6B7E6B]')}>
            {sub}
          </p>
        )}
      </div>
    </div>
  )

  if (href) {
    return <Link href={href} className="block">{inner}</Link>
  }
  return inner
}

function KpiCardSkeleton() {
  return (
    <div className="bg-white border border-[#D9E2DA] rounded-xl p-5 space-y-3 animate-pulse">
      <div className="flex justify-between">
        <div className="h-3 bg-[#E7EDE7] rounded w-28" />
        <div className="w-8 h-8 bg-[#E7EDE7] rounded-lg" />
      </div>
      <div className="h-8 bg-[#E7EDE7] rounded w-20" />
    </div>
  )
}

// ─── Action item card (pending reviews) ───────────────────────────────────────

function ActionCard({ label, count, href, urgency }: {
  label: string; count: number; href: string; urgency: 'high' | 'medium'
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between p-4 bg-white border border-[#D9E2DA] rounded-xl hover:border-[#6B7E6B] hover:shadow-sm transition-all"
    >
      <div className="flex items-center gap-3">
        <div className={cn(
          'w-8 h-8 rounded-lg flex items-center justify-center text-[13px] font-[700]',
          urgency === 'high' ? 'bg-[#E7EDE7] text-[#183D33]' : 'bg-[#E7EDE7] text-[#183D33]'
        )}>
          {count > 99 ? '99+' : count}
        </div>
        <span className="text-[13.5px] font-[500] font-sans text-[#0F241D]">{label}</span>
      </div>
      <ArrowRight size={14} className="text-[#6B7E6B]" aria-hidden="true" />
    </Link>
  )
}

// ─── Revenue chart ─────────────────────────────────────────────────────────────

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
  const total = values.reduce((s, v) => s + v, 0)

  return (
    <div className="bg-white border border-[#D9E2DA] rounded-xl p-5">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-[15px] font-[600] font-sans text-[#0F241D]">Revenue Over Time</h2>
          <p className="text-[12px] font-sans text-[#6B7E6B] mt-0.5">Gross Merchandise Value (INR)</p>
        </div>
        <Link
          href="/admin/reports"
          className="flex items-center gap-1.5 text-[12px] font-[600] font-sans text-[#183D33] hover:text-[#0F241D] transition-colors"
        >
          <BarChart3 size={13} aria-hidden="true" />
          Full reports
        </Link>
      </div>

      {isLoading ? (
        <div className="h-[160px] bg-[#E7EDE7]/40 rounded-lg animate-pulse" />
      ) : !usable || data.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-[13px] font-sans text-[#6B7E6B]">
            {data.length === 0 ? 'No revenue data yet.' : 'View full breakdown on the Reports page.'}
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-end gap-1.5 h-[160px]">
            {data.map((bucket, i) => {
              const v = Number(bucket[valueKey!]) || 0
              const label = String(bucket[dateKey!])
              const pct = Math.max(v > 0 ? 4 : 0, (v / max) * 100)
              return (
                <div
                  key={i}
                  className="flex-1 flex flex-col items-center gap-1.5 group relative"
                  title={`${label}: ${formatINR(v)}`}
                >
                  <div
                    className="w-full bg-[#183D33]/20 group-hover:bg-[#183D33] rounded-t-md transition-colors"
                    style={{ height: `${pct}%` }}
                  />
                  <span className="text-[9px] font-sans text-[#6B7E6B] group-hover:text-[#183D33] transition-colors truncate w-full text-center">
                    {label.length > 6 ? label.slice(0, 6) : label}
                  </span>
                </div>
              )
            })}
          </div>
          <div className="mt-3 pt-3 border-t border-[#FFFFFF] flex items-center gap-6">
            <p className="text-[12px] font-sans text-[#6B7E6B]">
              Total <span className="font-[600] text-[#0F241D] ml-1">{formatINR(total)}</span>
            </p>
            {values.length > 1 && (
              <p className="text-[12px] font-sans text-[#6B7E6B]">
                Avg <span className="font-[600] text-[#0F241D] ml-1">{formatINR(Math.round(total / values.length))}</span>
              </p>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminOverviewPage() {
  const { data: stats, isLoading } = useAdminDashboard()

  const pendingActions = stats ? [
    (stats.checkoutsAwaitingPayment ?? 0) > 0 && { label: 'Bank transfers to confirm', count: stats.checkoutsAwaitingPayment ?? 0, href: '/admin/orders?status=PENDING_PAYMENT', urgency: 'high' as const },
    (stats.refundsToApprove ?? 0) > 0 && { label: 'Refunds to approve', count: stats.refundsToApprove ?? 0, href: '/admin/orders?status=CANCELLED', urgency: 'high' as const },
    (stats.newRfqs ?? 0) > 0 && { label: 'New custom requests', count: stats.newRfqs ?? 0, href: '/admin/rfqs', urgency: 'high' as const },
    stats.pendingSellerApplications > 0 && { label: 'Seller applications awaiting review', count: stats.pendingSellerApplications, href: '/admin/seller-applications', urgency: 'high' as const },
    stats.pendingProductReviews > 0 && { label: 'Products awaiting approval', count: stats.pendingProductReviews, href: '/admin/products?approvalStatus=PENDING', urgency: 'high' as const },
    stats.ordersAwaitingCollection > 0 && { label: 'Orders awaiting collection', count: stats.ordersAwaitingCollection, href: '/admin/orders', urgency: 'medium' as const },
    stats.pendingPayoutsCount > 0 && { label: 'Payouts pending disbursement', count: stats.pendingPayoutsCount, href: '/admin/payouts', urgency: 'medium' as const },
  ].filter(Boolean) as { label: string; count: number; href: string; urgency: 'high' | 'medium' }[] : []

  return (
    <div className="space-y-7">

      {/* Page header */}
      <div>
        <h1 className="text-[26px] font-[700] font-sans text-[#0F241D] leading-tight">Admin Overview</h1>
        <p className="text-[13.5px] font-sans text-[#6B7E6B] mt-1">Platform health at a glance</p>
      </div>

      {/* Attention banner */}
      {!isLoading && pendingActions.length > 0 && (
        <div className="bg-[#E7EDE7] border border-[#D9E2DA] rounded-xl px-5 py-4 flex gap-3">
          <AlertCircle size={16} className="text-[#183D33] shrink-0 mt-0.5" aria-hidden="true" />
          <div className="flex-1">
            <p className="text-[13px] font-[600] font-sans text-[#183D33] mb-3">
              {pendingActions.length} item{pendingActions.length !== 1 ? 's' : ''} need{pendingActions.length === 1 ? 's' : ''} your attention
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {pendingActions.map((item) => (
                <ActionCard key={item.href} {...item} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* KPI row — overview metrics */}
      <div>
        <p className="text-[11px] font-[700] font-sans text-[#183D33] tracking-[0.1em] uppercase mb-3">Key metrics</p>
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => <KpiCardSkeleton key={i} />)
          ) : stats ? (
            <>
              <KpiCard
                label="Total GMV"
                value={formatINR(stats.totalGMV)}
                icon={TrendingUp}
                iconBg="bg-[#183D33]/10"
                iconColor="text-[#183D33]"
                sub="All time"
                featured
              />
              <KpiCard
                label="Active Orders"
                value={stats.activeOrders.toLocaleString()}
                icon={ShoppingBag}
                iconBg="bg-[#E7EDE7]"
                iconColor="text-[#183D33]"
                href="/admin/orders"
              />
              <KpiCard
                label="Pending Payout Value"
                value={formatINR(stats.pendingPayoutsAmount)}
                icon={CreditCard}
                iconBg="bg-[#E7EDE7]"
                iconColor="text-[#183D33]"
                sub="Awaiting disbursement"
                href="/admin/payouts"
              />
              <KpiCard
                label="Total Buyers"
                value={stats.totalBuyers.toLocaleString()}
                icon={Users}
                iconBg="bg-[#E7EDE7]"
                iconColor="text-[#183D33]"
                href="/admin/buyers"
              />
            </>
          ) : null}
        </div>
      </div>

      {/* Secondary metrics */}
      <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <KpiCardSkeleton key={i} />)
        ) : stats ? (
          <>
            <KpiCard
              label="Total Approved Sellers"
              value={stats.totalApprovedSellers.toLocaleString()}
              icon={Building2}
              iconBg="bg-[#E7EDE7]"
              iconColor="text-[#183D33]"
              href="/admin/sellers"
            />
            <KpiCard
              label="Orders Awaiting Collection"
              value={stats.ordersAwaitingCollection}
              icon={PackageCheck}
              iconBg="bg-[#E7EDE7]"
              iconColor="text-[#183D33]"
              href="/admin/orders"
            />
            <KpiCard
              label="Pending Payouts Count"
              value={stats.pendingPayoutsCount}
              icon={Package}
              iconBg="bg-[#E7EDE7]"
              iconColor="text-[#183D33]"
              href="/admin/payouts"
            />
          </>
        ) : null}
      </div>

      {/* Revenue chart */}
      <RevenueChart />

      {/* Quick actions */}
      <div>
        <p className="text-[11px] font-[700] font-sans text-[#183D33] tracking-[0.1em] uppercase mb-3">Quick actions</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { href: '/admin/products?approvalStatus=PENDING', label: 'Review Pending Products', icon: FileCheck, color: 'text-[#183D33]', bg: 'bg-[#E7EDE7]' },
            { href: '/admin/orders', label: 'View New Orders', icon: ShoppingCart, color: 'text-[#183D33]', bg: 'bg-[#E7EDE7]' },
            { href: '/admin/payouts', label: 'Process Payouts', icon: CreditCard, color: 'text-[#183D33]', bg: 'bg-[#E7EDE7]' },
            { href: '/admin/seller-applications', label: 'Seller Applications', icon: Clock, color: 'text-[#183D33]', bg: 'bg-[#E7EDE7]' },
          ].map(({ href, label, icon: Icon, color, bg }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 p-4 bg-white border border-[#D9E2DA] rounded-xl hover:border-[#6B7E6B] hover:shadow-sm transition-all"
            >
              <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', bg)}>
                <Icon size={15} className={cn('', color)} aria-hidden="true" />
              </div>
              <span className="text-[13px] font-[600] font-sans text-[#0F241D] leading-snug">{label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
