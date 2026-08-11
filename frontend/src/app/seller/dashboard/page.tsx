'use client';

import Link from 'next/link';
import { ApprovalStatusBadge } from '@/components/ApprovalStatusBadge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { useMySellerProfile } from '@/modules/sellers';
import { useMyProducts } from '@/modules/products';
import { useSellerOrderItems } from '@/modules/orders';
import { useMyPayoutSummary } from '@/modules/payouts';
import { formatCurrency } from '@/utils/formatCurrency';

function StatCard({ label, value }: { readonly label: string; readonly value: string | number }) {
  return (
    <div className="rounded-card border border-border bg-bg-surface p-5">
      <p className="text-caption font-semibold uppercase tracking-[0.05em] text-text-muted">{label}</p>
      <p className="mt-2 font-serif text-h2 leading-none tabular-nums text-text-primary">{value}</p>
    </div>
  );
}

function StatCardSkeleton() {
  return (
    <div className="animate-pulse rounded-card border border-border bg-bg-surface p-5">
      <div className="h-3 w-24 rounded bg-fill-subtle" />
      <div className="mt-3 h-7 w-16 rounded bg-fill-subtle" />
    </div>
  );
}

function SectionHeader({ title, href }: { readonly title: string; readonly href: string }) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="font-serif text-h4 text-text-primary">{title}</h2>
      <Link href={href} className="text-small font-semibold text-accent-secondary hover:underline">
        View all
      </Link>
    </div>
  );
}

export default function SellerDashboardPage() {
  const { data: profile } = useMySellerProfile();
  const { data: products, isLoading: productsLoading } = useMyProducts();
  const { data: orderItems, isLoading: ordersLoading } = useSellerOrderItems(1, 50);
  const { data: payoutSummary, isLoading: payoutLoading } = useMyPayoutSummary();

  const pendingCount = products?.data.filter((p) => p.approvalStatus === 'PENDING' || p.approvalStatus === 'RESUBMITTED').length ?? 0;
  const liveCount = products?.data.filter((p) => p.isPublished).length ?? 0;
  const recentSubmissions = (products?.data ?? []).slice(0, 5);
  const recentOrders = (orderItems?.data ?? []).slice(0, 5);

  const statsLoading = productsLoading || ordersLoading || payoutLoading;

  return (
    <div>
      <h1 className="font-serif text-h3 text-text-primary">
        Welcome back{profile ? `, ${profile.businessName}` : ''}
      </h1>
      <p className="mt-1 text-small text-text-muted">Here&apos;s a snapshot of your storefront on Solomon Bharat.</p>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {statsLoading ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <StatCard label="Pending Approval" value={pendingCount} />
            <StatCard label="Live Products" value={liveCount} />
            <StatCard label="Order Items" value={orderItems?.total ?? 0} />
            <StatCard label="Payout Due" value={payoutSummary ? formatCurrency(payoutSummary.pendingPayout) : '—'} />
          </>
        )}
      </div>

      <div className="mt-10">
        <SectionHeader title="Recent Product Submissions" href="/seller/products" />
        {recentSubmissions.length === 0 ? (
          <p className="mt-4 text-small text-text-muted">You haven&apos;t submitted any products yet.</p>
        ) : (
          <div className="mt-4 overflow-hidden rounded-card border border-border bg-bg-surface">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Product</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentSubmissions.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell>
                      <Link href={`/seller/products/${product.id}`} className="font-medium text-accent-secondary hover:underline">
                        {product.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-text-muted">{new Date(product.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <ApprovalStatusBadge status={product.approvalStatus} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <div className="mt-10">
        <SectionHeader title="Recent Orders" href="/seller/orders" />
        {recentOrders.length === 0 ? (
          <p className="mt-4 text-small text-text-muted">No orders yet.</p>
        ) : (
          <div className="mt-4 overflow-hidden rounded-card border border-border bg-bg-surface">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Product</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentOrders.map((item) => (
                  <TableRow key={item.orderItemId}>
                    <TableCell className="font-medium">{item.productName}</TableCell>
                    <TableCell className="tabular-nums text-text-muted">{item.quantity}</TableCell>
                    <TableCell className="text-text-muted">{item.status}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
