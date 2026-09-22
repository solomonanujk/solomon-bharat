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
        ? 'bg-[#1C1A18] border-[#2E2A24]'
        : 'bg-white border-[#E5E1D8] hover:border-[#C4BDB4] hover:shadow-sm',
    )}>
      <div className="flex items-center justify-between">
        <span className={cn('text-[12px] font-[500] font-sans', featured ? 'text-[#9A9189]' : 'text-[#6B6460]')}>
          {label}
        </span>
        <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', iconBg)}>
          <Icon size={15} className={iconColor} aria-hidden="true" />
        </div>
      </div>
      <div>
        <p className={cn('text-[30px] font-[700] font-sans leading-none tabular-nums', featured ? 'text-white' : 'text-[#1A1A1A]')}>
          {value}
        </p>
        {sub && (
          <p className={cn('text-[11.5px] font-sans mt-1.5', featured ? 'text-[#6B6460]' : 'text-[#9CA3AF]')}>
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
    <div className="bg-white border border-[#E5E1D8] rounded-xl p-5 space-y-3 animate-pulse">
      <div className="flex justify-between">
        <div className="h-3 bg-[#F5F0E8] rounded w-28" />
        <div className="w-8 h-8 bg-[#F5F0E8] rounded-lg" />
      </div>
      <div className="h-8 bg-[#F5F0E8] rounded w-20" />
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
      className="flex items-center justify-between p-4 bg-white border border-[#E5E1D8] rounded-xl hover:border-[#C4BDB4] hover:shadow-sm transition-all"
    >
      <div className="flex items-center gap-3">
        <div className={cn(
          'w-8 h-8 rounded-lg flex items-center justify-center text-[13px] font-[700]',
          urgency === 'high' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'
        )}>
          {count > 99 ? '99+' : count}
        </div>
        <span className="text-[13.5px] font-[500] font-sans text-[#1A1A1A]">{label}</span>
      </div>
      <ArrowRight size={14} className="text-[#C4BDB4]" aria-hidden="true" />
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
    <div className="bg-white border border-[#E5E1D8] rounded-xl p-5">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-[15px] font-[600] font-sans text-[#1A1A1A]">Revenue Over Time</h2>
          <p className="text-[12px] font-sans text-[#9CA3AF] mt-0.5">Gross Merchandise Value (INR)</p>
        </div>
        <Link
          href="/admin/reports"
          className="flex items-center gap-1.5 text-[12px] font-[600] font-sans text-[#A68B67] hover:text-[#8A7357] transition-colors"
        >
          <BarChart3 size={13} aria-hidden="true" />
          Full reports
        </Link>
      </div>

      {isLoading ? (
        <div className="h-[160px] bg-[#F5F0E8]/40 rounded-lg animate-pulse" />
      ) : !usable || data.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-[13px] font-sans text-[#9CA3AF]">
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
                    className="w-full bg-[#A68B67]/20 group-hover:bg-[#A68B67] rounded-t-md transition-colors"
                    style={{ height: `${pct}%` }}
                  />
                  <span className="text-[9px] font-sans text-[#C4BDB4] group-hover:text-[#A68B67] transition-colors truncate w-full text-center">
                    {label.length > 6 ? label.slice(0, 6) : label}
                  </span>
                </div>
              )
            })}
          </div>
          <div className="mt-3 pt-3 border-t border-[#F5F0E8] flex items-center gap-6">
            <p className="text-[12px] font-sans text-[#9CA3AF]">
              Total <span className="font-[600] text-[#1A1A1A] ml-1">{formatINR(total)}</span>
            </p>
            {values.length > 1 && (
              <p className="text-[12px] font-sans text-[#9CA3AF]">
                Avg <span className="font-[600] text-[#1A1A1A] ml-1">{formatINR(Math.round(total / values.length))}</span>
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
    stats.pendingSellerApplications > 0 && { label: 'Seller applications awaiting review', count: stats.pendingSellerApplications, href: '/admin/seller-applications', urgency: 'high' as const },
    stats.pendingProductReviews > 0 && { label: 'Products awaiting approval', count: stats.pendingProductReviews, href: '/admin/products?approvalStatus=PENDING', urgency: 'high' as const },
    stats.ordersAwaitingCollection > 0 && { label: 'Orders awaiting collection', count: stats.ordersAwaitingCollection, href: '/admin/orders', urgency: 'medium' as const },
    stats.pendingPayoutsCount > 0 && { label: 'Payouts pending disbursement', count: stats.pendingPayoutsCount, href: '/admin/payouts', urgency: 'medium' as const },
  ].filter(Boolean) as { label: string; count: number; href: string; urgency: 'high' | 'medium' }[] : []

  return (
    <div className="space-y-7">

      {/* Page header */}
      <div>
        <h1 className="text-[26px] font-[700] font-sans text-[#1A1A1A] leading-tight">Admin Overview</h1>
        <p className="text-[13.5px] font-sans text-[#9CA3AF] mt-1">Platform health at a glance</p>
      </div>

      {/* Attention banner */}
      {!isLoading && pendingActions.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 flex gap-3">
          <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="flex-1">
            <p className="text-[13px] font-[600] font-sans text-amber-900 mb-3">
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
        <p className="text-[11px] font-[700] font-sans text-[#A68B67] tracking-[0.1em] uppercase mb-3">Key metrics</p>
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => <KpiCardSkeleton key={i} />)
          ) : stats ? (
            <>
              <KpiCard
                label="Total GMV"
                value={formatINR(stats.totalGMV)}
                icon={TrendingUp}
                iconBg="bg-[#A68B67]/10"
                iconColor="text-[#A68B67]"
                sub="All time"
                featured
              />
              <KpiCard
                label="Active Orders"
                value={stats.activeOrders.toLocaleString()}
                icon={ShoppingBag}
                iconBg="bg-blue-50"
                iconColor="text-blue-600"
                href="/admin/orders"
              />
              <KpiCard
                label="Pending Payout Value"
                value={formatINR(stats.pendingPayoutsAmount)}
                icon={CreditCard}
                iconBg="bg-amber-50"
                iconColor="text-amber-600"
                sub="Awaiting disbursement"
                href="/admin/payouts"
              />
              <KpiCard
                label="Total Buyers"
                value={stats.totalBuyers.toLocaleString()}
                icon={Users}
                iconBg="bg-emerald-50"
                iconColor="text-emerald-600"
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
              iconBg="bg-purple-50"
              iconColor="text-purple-600"
              href="/admin/sellers"
            />
            <KpiCard
              label="Orders Awaiting Collection"
              value={stats.ordersAwaitingCollection}
              icon={PackageCheck}
              iconBg="bg-orange-50"
              iconColor="text-orange-600"
              href="/admin/orders"
            />
            <KpiCard
              label="Pending Payouts Count"
              value={stats.pendingPayoutsCount}
              icon={Package}
              iconBg="bg-pink-50"
              iconColor="text-pink-600"
              href="/admin/payouts"
            />
          </>
        ) : null}
      </div>

      {/* Revenue chart */}
      <RevenueChart />

      {/* Quick actions */}
      <div>
        <p className="text-[11px] font-[700] font-sans text-[#A68B67] tracking-[0.1em] uppercase mb-3">Quick actions</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { href: '/admin/products?approvalStatus=PENDING', label: 'Review Pending Products', icon: FileCheck, color: 'text-blue-600', bg: 'bg-blue-50' },
            { href: '/admin/orders', label: 'View New Orders', icon: ShoppingCart, color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { href: '/admin/payouts', label: 'Process Payouts', icon: CreditCard, color: 'text-amber-600', bg: 'bg-amber-50' },
            { href: '/admin/seller-applications', label: 'Seller Applications', icon: Clock, color: 'text-red-600', bg: 'bg-red-50' },
          ].map(({ href, label, icon: Icon, color, bg }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 p-4 bg-white border border-[#E5E1D8] rounded-xl hover:border-[#C4BDB4] hover:shadow-sm transition-all"
            >
              <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', bg)}>
                <Icon size={15} className={cn('', color)} aria-hidden="true" />
              </div>
              <span className="text-[13px] font-[600] font-sans text-[#1A1A1A] leading-snug">{label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
