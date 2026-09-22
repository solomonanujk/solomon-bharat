'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import {
  Package, CheckCircle2, Clock, XCircle,
  ShoppingBag, Wallet, Hourglass, Plus,
  ArrowRight,
} from 'lucide-react'
import { useMyProducts } from '@/hooks/queries/useProducts'
import { useSellerOrderItems } from '@/hooks/queries/useOrders'
import { useMyPayoutSummary, useMyPayouts } from '@/hooks/queries/usePayouts'
import { useMySellerProfile } from '@/hooks/queries/useSellers'
import { formatINR } from '@/lib/utils'
import { ApprovalStatusBadge, OrderItemStatusBadge, PayoutStatusBadge } from '@/components/seller-portal/StatusBadges'
import { cn } from '@/lib/utils'

// ─── KPI card ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, icon: Icon, iconBg, iconColor, hint, featured }: {
  label: string
  value: string
  icon: React.ElementType
  iconBg: string
  iconColor: string
  hint?: string
  featured?: boolean
}) {
  return (
    <div className={cn(
      'rounded-xl border p-5 flex flex-col gap-3',
      featured
        ? 'bg-[#1C1A18] border-[#2E2A24]'
        : 'bg-white border-[#E5E1D8]',
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
        <p className={cn('text-[28px] font-[700] font-sans leading-none tabular-nums', featured ? 'text-white' : 'text-[#1A1A1A]')}>
          {value}
        </p>
        {hint && (
          <p className={cn('text-[11px] font-sans mt-1.5 leading-snug', featured ? 'text-[#6B6460]' : 'text-[#9CA3AF]')}>
            {hint}
          </p>
        )}
      </div>
    </div>
  )
}

function KpiSkeleton() {
  return (
    <div className="bg-white border border-[#E5E1D8] rounded-xl p-5 animate-pulse">
      <div className="h-3 bg-[#F5F0E8] rounded w-1/2 mb-4" />
      <div className="h-8 bg-[#F5F0E8] rounded w-1/3" />
    </div>
  )
}

// ─── Activity feed ────────────────────────────────────────────────────────────

interface Activity {
  id: string
  date: string
  content: React.ReactNode
}

function ActivityRow({ activity }: { activity: Activity }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5 border-b border-[#F5F0E8] last:border-0">
      <div className="min-w-0 flex-1">{activity.content}</div>
      <span className="text-[11.5px] font-sans text-[#9CA3AF] shrink-0">
        {new Date(activity.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
      </span>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SellerDashboardPage() {
  const totalQ = useMyProducts({ limit: 1 })
  const approvedQ = useMyProducts({ approvalStatus: 'APPROVED', limit: 1 })
  const pendingQ = useMyProducts({ approvalStatus: 'PENDING', limit: 1 })
  const rejectedQ = useMyProducts({ approvalStatus: 'REJECTED', limit: 1 })
  const resubmittedQ = useMyProducts({ approvalStatus: 'RESUBMITTED', limit: 1 })
  const recentProductsQ = useMyProducts({ limit: 20 })

  const orderItemsQ = useSellerOrderItems({ limit: 1 })
  const recentOrderItemsQ = useSellerOrderItems({ limit: 20 })

  const payoutSummaryQ = useMyPayoutSummary()
  const recentPayoutsQ = useMyPayouts({ limit: 20 })

  const { data: profile } = useMySellerProfile()

  const kpiLoading = totalQ.isLoading || approvedQ.isLoading || pendingQ.isLoading || rejectedQ.isLoading || resubmittedQ.isLoading

  const totalSubmitted = totalQ.data?.total ?? 0
  const totalApproved = approvedQ.data?.total ?? 0
  // RESUBMITTED rolls into PENDING per prd.md §8.3
  const totalPending = (pendingQ.data?.total ?? 0) + (resubmittedQ.data?.total ?? 0)
  const totalRejected = rejectedQ.data?.total ?? 0
  const totalOrderItems = orderItemsQ.data?.total ?? 0

  const greeting = (() => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 18) return 'Good afternoon'
    return 'Good evening'
  })()

  const sellerFirstName = profile?.businessName?.split(' ')[0] ?? 'there'

  const activity = useMemo<Activity[]>(() => {
    const items: Activity[] = []

    for (const p of recentProductsQ.data?.items ?? []) {
      items.push({
        id: `product-${p.id}`,
        date: p.updatedAt,
        content: (
          <p className="text-[13px] font-sans text-[#1A1A1A] truncate flex items-center gap-2">
            <span className="font-[600] truncate">{p.name}</span>
            <ApprovalStatusBadge status={p.approvalStatus} />
          </p>
        ),
      })
    }

    for (const item of recentOrderItemsQ.data?.items ?? []) {
      items.push({
        id: `order-${item.orderItemId}`,
        date: item.createdAt,
        content: (
          <p className="text-[13px] font-sans text-[#1A1A1A] truncate flex items-center gap-2">
            <ShoppingBag size={13} className="text-blue-500 shrink-0" aria-hidden="true" />
            Order: <span className="font-[600] truncate">{item.productName}</span>
            <span className="text-[#9CA3AF]">×{item.quantity}</span>
            <OrderItemStatusBadge status={item.status} />
          </p>
        ),
      })
    }

    for (const payout of recentPayoutsQ.data?.items ?? []) {
      items.push({
        id: `payout-${payout.id}`,
        date: payout.createdAt,
        content: (
          <p className="text-[13px] font-sans text-[#1A1A1A] truncate flex items-center gap-2">
            <Wallet size={13} className="text-emerald-600 shrink-0" aria-hidden="true" />
            Payout: <span className="font-[600]">{formatINR(payout.amount)}</span>
            <PayoutStatusBadge status={payout.status} />
          </p>
        ),
      })
    }

    return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 10)
  }, [recentProductsQ.data, recentOrderItemsQ.data, recentPayoutsQ.data])

  const activityLoading = recentProductsQ.isLoading || recentOrderItemsQ.isLoading || recentPayoutsQ.isLoading

  return (
    <div className="space-y-6">

      {/* Page header with greeting */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[12px] font-[600] font-sans text-[#A68B67] tracking-[0.06em] uppercase mb-1">
            {greeting}
          </p>
          <h1 className="text-[26px] font-[700] font-sans text-[#1A1A1A] leading-tight">
            {sellerFirstName}
          </h1>
          <p className="text-[13.5px] font-sans text-[#9CA3AF] mt-0.5">Here's what's happening with your store</p>
        </div>
        <Link
          href="/portal/products/new"
          className="flex items-center gap-2 px-4 py-2.5 bg-[#A68B67] text-white text-[13px] font-[600] font-sans rounded-lg hover:bg-[#8A7357] transition-colors shadow-sm"
        >
          <Plus size={14} aria-hidden="true" />
          Submit Product
        </Link>
      </div>

      {/* Product status KPIs */}
      <div>
        <p className="text-[11px] font-[700] font-sans text-[#A68B67] tracking-[0.1em] uppercase mb-3">Products</p>
        {kpiLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => <KpiSkeleton key={i} />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard
              label="Approved"
              value={String(totalApproved)}
              icon={CheckCircle2}
              iconBg="bg-emerald-50"
              iconColor="text-emerald-600"
            />
            <KpiCard
              label="Pending Review"
              value={String(totalPending)}
              icon={Clock}
              iconBg="bg-amber-50"
              iconColor="text-amber-600"
            />
            <KpiCard
              label="Rejected"
              value={String(totalRejected)}
              icon={XCircle}
              iconBg="bg-red-50"
              iconColor="text-red-500"
            />
            <KpiCard
              label="Total Submitted"
              value={String(totalSubmitted)}
              icon={Package}
              iconBg="bg-[#F5F0E8]"
              iconColor="text-[#A68B67]"
            />
          </div>
        )}
      </div>

      {/* Earnings KPIs */}
      <div>
        <p className="text-[11px] font-[700] font-sans text-[#A68B67] tracking-[0.1em] uppercase mb-3">Earnings</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <KpiCard
            label="Total Earnings Paid Out"
            value={payoutSummaryQ.isLoading ? '—' : formatINR(payoutSummaryQ.data?.totalEarned ?? 0)}
            icon={Wallet}
            iconBg="bg-[#A68B67]/10"
            iconColor="text-[#A68B67]"
            featured
          />
          <KpiCard
            label="Pending Payout"
            value={payoutSummaryQ.isLoading ? '—' : formatINR(payoutSummaryQ.data?.pendingPayout ?? 0)}
            icon={Hourglass}
            iconBg="bg-amber-50"
            iconColor="text-amber-600"
            hint="Will be disbursed in the next payout cycle"
          />
          <KpiCard
            label="Order Items"
            value={orderItemsQ.isLoading ? '—' : String(totalOrderItems)}
            icon={ShoppingBag}
            iconBg="bg-blue-50"
            iconColor="text-blue-600"
            hint="Total line items across all orders"
          />
        </div>
      </div>

      {/* Activity feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] font-[700] font-sans text-[#A68B67] tracking-[0.1em] uppercase">Recent Activity</p>
            <Link href="/portal/products" className="flex items-center gap-1 text-[12px] font-[600] font-sans text-[#A68B67] hover:text-[#8A7357] transition-colors">
              All products <ArrowRight size={11} />
            </Link>
          </div>
          <div className="bg-white border border-[#E5E1D8] rounded-xl px-5 py-1">
            {activityLoading ? (
              <div className="py-5 space-y-4 animate-pulse">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-4 bg-[#F5F0E8] rounded w-3/4" />
                ))}
              </div>
            ) : activity.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-[14px] font-sans text-[#9CA3AF]">Nothing to show yet.</p>
                <p className="text-[12px] font-sans text-[#9CA3AF] mt-1">
                  Product approvals, orders, and payouts will appear here.
                </p>
              </div>
            ) : (
              activity.map((a) => <ActivityRow key={a.id} activity={a} />)
            )}
          </div>
        </div>

        {/* Quick links */}
        <div>
          <p className="text-[11px] font-[700] font-sans text-[#A68B67] tracking-[0.1em] uppercase mb-3">Quick links</p>
          <div className="space-y-2">
            {[
              { href: '/portal/products/new', label: 'Submit a New Product', icon: Plus, color: 'text-[#A68B67]', bg: 'bg-[#F5F0E8]' },
              { href: '/portal/orders', label: 'View My Orders', icon: ShoppingBag, color: 'text-blue-600', bg: 'bg-blue-50' },
              { href: '/portal/payouts', label: 'Check Payouts', icon: Wallet, color: 'text-emerald-600', bg: 'bg-emerald-50' },
              { href: '/portal/settings', label: 'Update Settings', icon: ArrowRight, color: 'text-[#9CA3AF]', bg: 'bg-[#F9F7F2]' },
            ].map(({ href, label, icon: Icon, color, bg }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-3 p-3.5 bg-white border border-[#E5E1D8] rounded-xl hover:border-[#C4BDB4] hover:shadow-sm transition-all"
              >
                <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', bg)}>
                  <Icon size={14} className={color} aria-hidden="true" />
                </div>
                <span className="text-[13px] font-[500] font-sans text-[#1A1A1A]">{label}</span>
                <ArrowRight size={13} className="text-[#C4BDB4] ml-auto" aria-hidden="true" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
