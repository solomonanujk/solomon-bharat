'use client';

import Link from 'next/link';
import {
  TrendingUp,
  Clock,
  CreditCard,
  ShoppingBag,
  Truck,
  Users,
  Store,
  Wallet,
  ArrowRight,
  LayoutGrid,
  Package,
  FolderTree,
  BarChart3,
} from 'lucide-react';
import { useAdminDashboard } from '@/modules/admin';
import { formatCurrency } from '@/utils/formatCurrency';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ElementType;
  accent?: boolean;
}

function StatCard({ label, value, icon: Icon, accent }: StatCardProps) {
  return (
    <div
      className={`flex flex-col gap-3 rounded-card border p-5 ${
        accent ? 'border-accent-secondary/40 bg-accent-secondary/[6%]' : 'border-border bg-bg-surface'
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-small font-medium text-text-muted">{label}</span>
        <div
          className={`flex h-8 w-8 items-center justify-center rounded ${
            accent ? 'bg-accent-secondary/10' : 'bg-fill-subtle'
          }`}
        >
          <Icon size={16} className={accent ? 'text-accent-secondary' : 'text-text-muted'} aria-hidden="true" />
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

const QUICK_LINKS: { href: string; label: string; icon: React.ElementType }[] = [
  { href: '/admin/sellers', label: 'Sellers', icon: Store },
  { href: '/admin/products', label: 'Products', icon: Package },
  { href: '/admin/orders', label: 'Orders', icon: ShoppingBag },
  { href: '/admin/collections', label: 'Collections', icon: LayoutGrid },
  { href: '/admin/categories', label: 'Categories', icon: FolderTree },
  { href: '/admin/reports', label: 'Reports', icon: BarChart3 },
];

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
          Array.from({ length: 8 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : (
          <>
            <StatCard label="Gross Merchandise Value" value={formatCurrency(summary.totalGMV)} icon={TrendingUp} />
            <StatCard
              label="Pending Product Reviews"
              value={summary.pendingProductReviews}
              icon={Clock}
              accent={summary.pendingProductReviews > 0}
            />
            <StatCard
              label="Pending Seller Applications"
              value={summary.pendingSellerApplications}
              icon={Users}
              accent={summary.pendingSellerApplications > 0}
            />
            <StatCard label="Active Orders" value={summary.activeOrders} icon={ShoppingBag} />
            <StatCard
              label="Orders Awaiting Collection"
              value={summary.ordersAwaitingCollection}
              icon={Truck}
              accent={summary.ordersAwaitingCollection > 0}
            />
            <StatCard
              label="Pending Payouts"
              value={`${summary.pendingPayoutsCount} · ${formatCurrency(summary.pendingPayoutsAmount)}`}
              icon={CreditCard}
              accent={summary.pendingPayoutsCount > 0}
            />
            <StatCard label="Total Buyers" value={summary.totalBuyers} icon={Users} />
            <StatCard label="Approved Sellers" value={summary.totalApprovedSellers} icon={Wallet} />
          </>
        )}
      </div>

      {!isLoading && summary && (
        <div className="mt-8 rounded-card border border-border bg-bg-surface p-5">
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
            <li className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
              <span className="text-small text-text-muted">Payouts pending</span>
              <Link
                href="/admin/payouts"
                className="flex items-center gap-1 text-small font-semibold text-accent-secondary hover:text-accent-secondary-hover"
              >
                {summary.pendingPayoutsCount}
                <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </li>
          </ul>
        </div>
      )}

      <div className="mt-8">
        <h2 className="mb-3 text-h4 font-serif text-text-primary">Quick Links</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {QUICK_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex flex-col items-center gap-2 rounded-card border border-border bg-bg-surface p-4 text-center transition-colors hover:bg-fill-subtle"
            >
              <link.icon size={18} className="text-accent-primary" aria-hidden="true" />
              <span className="text-small font-medium text-text-primary">{link.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
