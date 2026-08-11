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
    <div className="rounded-card border border-border bg-bg-surface p-6">
      <p className="text-caption font-semibold uppercase tracking-[0.05em] text-text-muted">{label}</p>
      <p className="mt-2 font-serif text-h2 text-text-primary">{value}</p>
    </div>
  );
}

export default function SellerDashboardPage() {
  const { data: profile } = useMySellerProfile();
  const { data: products } = useMyProducts();
  const { data: orderItems } = useSellerOrderItems(1, 50);
  const { data: payoutSummary } = useMyPayoutSummary();

  const pendingCount = products?.data.filter((p) => p.approvalStatus === 'PENDING' || p.approvalStatus === 'RESUBMITTED').length ?? 0;
  const liveCount = products?.data.filter((p) => p.isPublished).length ?? 0;
  const recentSubmissions = (products?.data ?? []).slice(0, 5);
  const recentOrders = (orderItems?.data ?? []).slice(0, 5);

  return (
    <div>
      <h1 className="font-serif text-h3 text-text-primary">
        Welcome back{profile ? `, ${profile.businessName}` : ''}
      </h1>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
        <StatCard label="Pending Approval" value={pendingCount} />
        <StatCard label="Live Products" value={liveCount} />
        <StatCard label="Order Items" value={orderItems?.total ?? 0} />
        <StatCard label="Payout Due" value={payoutSummary ? formatCurrency(payoutSummary.pendingPayout) : '—'} />
      </div>

      <div className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-h4 text-text-primary">Recent Product Submissions</h2>
          <Link href="/seller/products" className="text-small font-medium text-accent-secondary hover:underline">
            View all
          </Link>
        </div>
        {recentSubmissions.length === 0 ? (
          <p className="mt-4 text-small text-text-muted">You haven&apos;t submitted any products yet.</p>
        ) : (
          <div className="mt-4 rounded-card border border-border bg-bg-surface">
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
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-h4 text-text-primary">Recent Orders</h2>
          <Link href="/seller/orders" className="text-small font-medium text-accent-secondary hover:underline">
            View all
          </Link>
        </div>
        {recentOrders.length === 0 ? (
          <p className="mt-4 text-small text-text-muted">No orders yet.</p>
        ) : (
          <div className="mt-4 rounded-card border border-border bg-bg-surface">
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
                    <TableCell className="text-text-muted">{item.quantity}</TableCell>
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
