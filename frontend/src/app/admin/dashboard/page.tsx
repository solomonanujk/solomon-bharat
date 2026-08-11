'use client';

import Link from 'next/link';
import { TrendingUp, Clock, CreditCard, ShoppingBag, ArrowRight } from 'lucide-react';
import { useAdminDashboard } from '@/modules/admin';
import { formatCurrency } from '@/utils/formatCurrency';

function StatCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  accent?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-card border border-border bg-bg-surface p-5">
      <div className="flex items-center justify-between">
        <span className="text-small font-medium text-text-muted">{label}</span>
        <div
          className={`flex h-8 w-8 items-center justify-center rounded ${accent ? 'bg-accent-primary/10' : 'bg-fill-subtle'}`}
        >
          <Icon size={16} className={accent ? 'text-accent-primary' : 'text-text-muted'} aria-hidden="true" />
        </div>
      </div>
      <p className="text-h3 font-serif leading-none text-text-primary">{value}</p>
    </div>
  );
}

function StatCardSkeleton() {
  return (
    <div className="animate-pulse space-y-3 rounded-card border border-border bg-bg-surface p-5">
      <div className="flex justify-between">
        <div className="h-3 w-24 rounded bg-fill-subtle" />
        <div className="h-8 w-8 rounded bg-fill-subtle" />
      </div>
      <div className="h-7 w-20 rounded bg-fill-subtle" />
    </div>
  );
}

export default function AdminDashboardPage() {
  const { data: summary, isLoading } = useAdminDashboard();

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-h2 font-serif font-medium text-text-primary">Dashboard</h1>
        <p className="mt-1 text-small text-text-muted">Platform health at a glance</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {isLoading || !summary ? (
          Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : (
          <>
            <StatCard label="Gross Merchandise Value" value={formatCurrency(summary.totalGMV)} icon={TrendingUp} accent />
            <StatCard label="Pending Product Approvals" value={summary.pendingProductReviews} icon={Clock} />
            <StatCard label="Pending Payouts" value={formatCurrency(summary.pendingPayoutsAmount)} icon={CreditCard} />
            <StatCard label="Active Orders" value={summary.activeOrders} icon={ShoppingBag} />
          </>
        )}
      </div>

      {!isLoading && summary && (
        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="rounded-card border border-border bg-bg-surface p-5">
            <h2 className="text-h4 font-serif text-text-primary">Needs Your Attention</h2>
            <ul className="mt-4 divide-y divide-border">
              <li className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                <span className="text-small text-text-muted">Products awaiting review</span>
                <Link
                  href="/admin/products"
                  className="flex items-center gap-1 text-small font-semibold text-accent-secondary hover:text-accent-secondary-hover"
                >
                  {summary.pendingProductReviews}
                  <ArrowRight size={14} aria-hidden="true" />
                </Link>
              </li>
              <li className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                <span className="text-small text-text-muted">Seller applications pending</span>
                <Link
                  href="/admin/sellers"
                  className="flex items-center gap-1 text-small font-semibold text-accent-secondary hover:text-accent-secondary-hover"
                >
                  {summary.pendingSellerApplications}
                  <ArrowRight size={14} aria-hidden="true" />
                </Link>
              </li>
              <li className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                <span className="text-small text-text-muted">Orders awaiting collection</span>
                <Link
                  href="/admin/orders"
                  className="flex items-center gap-1 text-small font-semibold text-accent-secondary hover:text-accent-secondary-hover"
                >
                  {summary.ordersAwaitingCollection}
                  <ArrowRight size={14} aria-hidden="true" />
                </Link>
              </li>
            </ul>
          </div>

          <div className="rounded-card border border-border bg-bg-surface p-5">
            <h2 className="text-h4 font-serif text-text-primary">Platform Totals</h2>
            <ul className="mt-4 divide-y divide-border">
              <li className="flex items-center justify-between py-3 first:pt-0 last:pb-0 text-small">
                <span className="text-text-muted">Total Buyers</span>
                <span className="font-semibold text-text-primary">{summary.totalBuyers}</span>
              </li>
              <li className="flex items-center justify-between py-3 first:pt-0 last:pb-0 text-small">
                <span className="text-text-muted">Approved Sellers</span>
                <span className="font-semibold text-text-primary">{summary.totalApprovedSellers}</span>
              </li>
              <li className="flex items-center justify-between py-3 first:pt-0 last:pb-0 text-small">
                <span className="text-text-muted">Pending Payouts</span>
                <span className="font-semibold text-text-primary">{summary.pendingPayoutsCount}</span>
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
