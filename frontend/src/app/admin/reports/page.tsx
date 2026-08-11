'use client';

import { TrendingUp, PiggyBank, Wallet, Store } from 'lucide-react';
import { useAdminDashboard, useReport } from '@/modules/admin';
import { OrdersByStatusRow, ProductPerformanceRow, RevenueReportRow, SellerPerformanceRow } from '@/modules/admin/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { formatCurrency } from '@/utils/formatCurrency';

function StatCard({ label, value, icon: Icon }: { label: string; value: string | number; icon: React.ElementType }) {
  return (
    <div className="flex flex-col gap-3 rounded-card border border-border bg-bg-surface p-5">
      <div className="flex items-center justify-between">
        <span className="text-small font-medium text-text-muted">{label}</span>
        <div className="flex h-8 w-8 items-center justify-center rounded bg-fill-subtle">
          <Icon size={16} className="text-text-muted" aria-hidden="true" />
        </div>
      </div>
      <p className="text-h3 font-serif leading-none text-text-primary">{value}</p>
    </div>
  );
}

export default function AdminReportsPage() {
  const { data: summary } = useAdminDashboard();
  const { data: revenue } = useReport<RevenueReportRow>('revenue');
  const { data: ordersByStatus } = useReport<OrdersByStatusRow>('orders-by-status');
  const { data: sellerPerformance } = useReport<SellerPerformanceRow>('sellers-performance');
  const { data: productPerformance } = useReport<ProductPerformanceRow>('products-performance');

  const revenueRow = revenue?.[0];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-h2 font-serif font-medium text-text-primary">Reports</h1>
        <p className="mt-1 text-small text-text-muted">Revenue, sellers, and product performance</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total GMV" value={revenueRow ? formatCurrency(revenueRow.gmv) : '—'} icon={TrendingUp} />
        <StatCard label="Total Margin" value={revenueRow ? formatCurrency(revenueRow.adminMargin) : '—'} icon={PiggyBank} />
        <StatCard label="Seller Payouts" value={revenueRow ? formatCurrency(revenueRow.sellerPayouts) : '—'} icon={Wallet} />
        <StatCard label="Active Sellers" value={summary?.totalApprovedSellers ?? '—'} icon={Store} />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-card border border-border bg-bg-surface p-5">
          <h2 className="text-h4 font-serif text-text-primary">Orders by Status</h2>
          <ul className="mt-4 divide-y divide-border">
            {ordersByStatus?.map((row) => (
              <li key={row.status} className="flex items-center justify-between py-3 text-small first:pt-0 last:pb-0">
                <span className="text-text-muted">{row.status}</span>
                <span className="font-semibold text-text-primary">{row.count}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-card border border-border bg-bg-surface p-5">
          <h2 className="text-h4 font-serif text-text-primary">Top Performing Sellers</h2>
          <ul className="mt-4 divide-y divide-border">
            {sellerPerformance
              ?.slice()
              .sort((a, b) => Number(b.totalPayout) - Number(a.totalPayout))
              .slice(0, 5)
              .map((row) => (
                <li key={row.sellerId} className="flex items-center justify-between py-3 text-small first:pt-0 last:pb-0">
                  <span className="text-text-muted">{row.businessName}</span>
                  <span className="font-semibold text-text-primary">{formatCurrency(row.totalPayout)}</span>
                </li>
              ))}
          </ul>
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-h4 font-serif text-text-primary">Top Products</h2>
        <div className="mt-4 overflow-hidden rounded-card border border-border bg-bg-surface">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Orders</TableHead>
                <TableHead>Units Sold</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {productPerformance?.slice(0, 10).map((row) => (
                <TableRow key={row.productId}>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell className="text-text-muted">{row.ordersCount}</TableCell>
                  <TableCell className="text-text-muted">{row.unitsSold}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
