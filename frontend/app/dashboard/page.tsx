'use client'

import Link from 'next/link'
import { ArrowRight, Clock, Heart, PackageCheck, ShoppingBag } from 'lucide-react'
import { AccountPageWrapper } from '@/components/shared/AccountPageWrapper'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { useFormatPrice } from '@/components/ui/Price'
import { useBuyerDashboard } from '@/hooks/queries/useBuyerDashboard'
import { useAuthStore } from '@/lib/store/useAuthStore'

// prd.md §7.3 — Overview: Active / Pending / Completed Orders + Saved
// Products KPI cards, plus a primary "Continue Browsing" CTA. There is no
// dedicated backend dashboard endpoint; useBuyerDashboard() composes these
// numbers from /orders/me + /buyers/me/wishlist.

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function KpiCard({
  icon: Icon,
  label,
  value,
  loading,
}: {
  icon: React.ElementType
  label: string
  value: number
  loading: boolean
}) {
  return (
    <div className="bg-surface border border-border-warm rounded p-5 flex items-center gap-4">
      <div className="w-11 h-11 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0 text-accent">
        <Icon size={18} aria-hidden="true" />
      </div>
      <div>
        <p className="text-[22px] font-[600] font-public-sans text-primary leading-none">
          {loading ? '—' : value}
        </p>
        <p className="text-[12px] font-public-sans text-muted-text mt-1">{label}</p>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user)
  const { data, isLoading } = useBuyerDashboard()
  const fmt = useFormatPrice()

  const firstName = user?.email?.split('@')[0] ?? 'there'

  return (
    <AccountPageWrapper title="Dashboard" description={`Welcome back, ${firstName}.`}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KpiCard icon={Clock} label="Pending Orders" value={data?.pendingOrders ?? 0} loading={isLoading} />
        <KpiCard icon={ShoppingBag} label="Active Orders" value={data?.activeOrders ?? 0} loading={isLoading} />
        <KpiCard icon={PackageCheck} label="Completed Orders" value={data?.completedOrders ?? 0} loading={isLoading} />
        <KpiCard icon={Heart} label="Saved Products" value={data?.savedProducts ?? 0} loading={isLoading} />
      </div>

      <div className="bg-surface border border-border-warm rounded p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <p className="text-[16px] font-[600] font-public-sans text-primary">Ready to source more?</p>
          <p className="text-[13px] font-public-sans text-muted-text mt-0.5">
            Browse the Solomon Bharat catalogue for your next wholesale order.
          </p>
        </div>
        <Button variant="primary" size="md" className="gap-1.5 flex-shrink-0" asChild>
          <Link href="/">
            Continue Browsing
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </Button>
      </div>

      <div className="border border-border-warm rounded bg-surface overflow-hidden">
        <div className="px-5 py-4 border-b border-border-warm flex items-center justify-between">
          <h2 className="text-[15px] font-[600] font-public-sans text-primary">Recent Orders</h2>
          <Link href="/orders" className="text-[12px] font-[600] font-public-sans text-accent hover:text-accent-hover transition-colors">
            View all
          </Link>
        </div>

        {isLoading ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-10 bg-muted-bg rounded animate-pulse" />
            ))}
          </div>
        ) : !data?.recentOrders.length ? (
          <p className="px-5 py-8 text-center text-[13px] font-public-sans text-muted-text">
            No orders yet.
          </p>
        ) : (
          <div className="divide-y divide-border-warm">
            {data.recentOrders.map((order) => (
              <Link
                key={order.id}
                href="/orders"
                className="flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-muted-bg/40 transition-colors"
              >
                <div>
                  <p className="text-[13px] font-[600] font-public-sans text-primary">
                    #{order.id.slice(0, 8).toUpperCase()}
                  </p>
                  <p className="text-[12px] font-public-sans text-muted-text mt-0.5">
                    {formatDate(order.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-[13px] font-[600] font-public-sans text-primary">
                    {fmt(order.adminPriceTotal)}
                  </span>
                  <StatusBadge status={order.status} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AccountPageWrapper>
  )
}
