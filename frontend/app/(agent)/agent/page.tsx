'use client'

import Link from 'next/link'
import { ShoppingBag, Wallet, Package, BookOpen } from 'lucide-react'
import { useMyOrders } from '@/hooks/queries/useOrders'
import { formatINR } from '@/lib/utils'

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

function QuickLink({ href, label, icon: Icon }: { href: string; label: string; icon: React.ElementType }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 bg-surface border border-border-warm rounded p-5 hover:border-accent transition-colors"
    >
      <div className="w-9 h-9 rounded-full bg-muted-bg flex items-center justify-center shrink-0">
        <Icon size={16} className="text-accent" aria-hidden="true" />
      </div>
      <span className="text-[14px] font-[600] font-public-sans text-primary">{label}</span>
    </Link>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
// Simple summary composed from data already available — no dedicated
// dashboard-summary endpoint exists for agents.

export default function AgentDashboardPage() {
  const recentOrdersQ = useMyOrders({ limit: 20 })

  const orders = recentOrdersQ.data?.items ?? []
  const totalOrders = recentOrdersQ.data?.total ?? 0
  const recentValue = orders.reduce((sum, o) => sum + o.adminPriceTotal, 0)

  return (
    <div>
      <h1 className="text-[24px] leading-[1.3] font-[500] font-playfair text-primary mb-6">
        Dashboard
      </h1>

      {recentOrdersQ.isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          <StatCard label="Total Orders" value={String(totalOrders)} icon={ShoppingBag} />
          <StatCard
            label="Recent Order Value"
            value={formatINR(recentValue)}
            icon={Wallet}
            hint="Sum of your most recent orders"
          />
        </div>
      )}

      <h2 className="text-[14px] leading-[1.4] font-[600] font-public-sans text-primary mb-3">
        Quick Links
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <QuickLink href="/agent/products" label="Browse Products" icon={Package} />
        <QuickLink href="/agent/catalogue" label="Build a Catalogue" icon={BookOpen} />
        <QuickLink href="/agent/orders" label="View Orders" icon={ShoppingBag} />
      </div>
    </div>
  )
}
