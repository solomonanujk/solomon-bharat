'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { Package, CheckCircle2, Clock, XCircle, ShoppingBag, Wallet, Hourglass } from 'lucide-react'
import { useMyProducts } from '@/hooks/queries/useProducts'
import { useSellerOrderItems } from '@/hooks/queries/useOrders'
import { useMyPayoutSummary, useMyPayouts } from '@/hooks/queries/usePayouts'
import { formatINR } from '@/lib/utils'
import { ApprovalStatusBadge, OrderItemStatusBadge, PayoutStatusBadge } from '@/components/seller-portal/StatusBadges'

// ─── KPI card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, icon: Icon, hint }: {
  label: string; value: string; icon: React.ElementType; hint?: string
}) {
  return (
    <div className="bg-surface border border-border-warm rounded p-5">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[12px] leading-[1.3] font-public-sans text-muted-text">{label}</p>
        <Icon size={14} className="text-accent" aria-hidden="true" />
      </div>
      <p className="text-[26px] font-[600] font-public-sans text-primary leading-none tabular-nums">
        {value}
      </p>
      {hint && <p className="text-[11px] font-public-sans text-muted-text mt-2">{hint}</p>}
    </div>
  )
}

function StatCardSkeleton() {
  return (
    <div className="bg-surface border border-border-warm rounded p-5 animate-pulse">
      <div className="h-3 bg-muted-bg rounded w-1/2 mb-3" />
      <div className="h-7 bg-muted-bg rounded w-1/3" />
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
    <div className="flex items-center justify-between gap-4 py-3 border-b border-border-warm last:border-0">
      <div className="min-w-0">{activity.content}</div>
      <span className="text-[12px] font-public-sans text-muted-text shrink-0">
        {new Date(activity.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
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

  const kpiLoading = totalQ.isLoading || approvedQ.isLoading || pendingQ.isLoading || rejectedQ.isLoading || resubmittedQ.isLoading
  const totalSubmitted = totalQ.data?.total ?? 0
  const totalApproved = approvedQ.data?.total ?? 0
  // RESUBMITTED products are back in the admin review queue, same as PENDING —
  // rolled into one "Pending" KPI per prd.md §8.3 (which lists only Approved/Pending/Rejected).
  const totalPending = (pendingQ.data?.total ?? 0) + (resubmittedQ.data?.total ?? 0)
  const totalRejected = rejectedQ.data?.total ?? 0

  // useSellerOrderItems returns order ITEMS, not distinct orders — this counts
  // line items linked to the seller's products, not unique orders.
  const totalOrderItems = orderItemsQ.data?.total ?? 0

  const activity = useMemo<Activity[]>(() => {
    const items: Activity[] = []

    for (const p of recentProductsQ.data?.items ?? []) {
      items.push({
        id: `product-${p.id}`,
        date: p.updatedAt,
        content: (
          <p className="text-[13px] font-public-sans text-primary truncate">
            <span className="font-[600]">{p.name}</span>{' '}
            <span className="text-muted-text">—</span>{' '}
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
          <p className="text-[13px] font-public-sans text-primary truncate flex items-center gap-2">
            Order for <span className="font-[600]">{item.productName}</span> × {item.quantity}
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
          <p className="text-[13px] font-public-sans text-primary truncate flex items-center gap-2">
            Payout of <span className="font-[600]">{formatINR(payout.amount)}</span>
            <PayoutStatusBadge status={payout.status} />
          </p>
        ),
      })
    }

    return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 8)
  }, [recentProductsQ.data, recentOrderItemsQ.data, recentPayoutsQ.data])

  const activityLoading = recentProductsQ.isLoading || recentOrderItemsQ.isLoading || recentPayoutsQ.isLoading

  return (
    <div>
      <h1 className="text-[24px] leading-[1.3] font-[500] font-playfair text-primary mb-6">
        Dashboard
      </h1>

      {/* KPI cards */}
      {kpiLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
          {Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
          <StatCard label="Products Submitted" value={String(totalSubmitted)} icon={Package} />
          <StatCard label="Approved" value={String(totalApproved)} icon={CheckCircle2} />
          <StatCard label="Pending Review" value={String(totalPending)} icon={Clock} />
          <StatCard label="Rejected" value={String(totalRejected)} icon={XCircle} />
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard
          label="Order Items Linked"
          value={orderItemsQ.isLoading ? '—' : String(totalOrderItems)}
          icon={ShoppingBag}
          hint="Line items across orders containing your products"
        />
        <StatCard
          label="Total Earnings Paid Out"
          value={payoutSummaryQ.isLoading ? '—' : formatINR(payoutSummaryQ.data?.totalEarned ?? 0)}
          icon={Wallet}
        />
        <StatCard
          label="Pending Payout"
          value={payoutSummaryQ.isLoading ? '—' : formatINR(payoutSummaryQ.data?.pendingPayout ?? 0)}
          icon={Hourglass}
        />
      </div>

      {/* Recent activity */}
      <section>
        <h2 className="text-[14px] leading-[1.4] font-[600] font-public-sans text-primary mb-3">
          Recent Activity
        </h2>
        <div className="bg-surface border border-border-warm rounded px-5">
          {activityLoading ? (
            <div className="py-4 space-y-3 animate-pulse">
              {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-4 bg-muted-bg rounded w-2/3" />)}
            </div>
          ) : activity.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-[14px] font-public-sans text-muted-text">Nothing to show yet.</p>
              <p className="text-[12px] font-public-sans text-muted-text mt-1">
                Product approvals, orders, and payouts will appear here.
              </p>
            </div>
          ) : (
            activity.map((a) => <ActivityRow key={a.id} activity={a} />)
          )}
        </div>
      </section>

      <div className="flex items-center gap-4 mt-6">
        <Link href="/portal/products/new" className="text-[13px] font-[600] font-public-sans text-accent hover:opacity-70 transition-opacity">
          Submit a new product →
        </Link>
      </div>
    </div>
  )
}
