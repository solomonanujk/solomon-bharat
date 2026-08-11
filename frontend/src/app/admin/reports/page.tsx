'use client';

import { useMemo, useState } from 'react';
import { Download, TrendingUp, PiggyBank, Wallet, Store } from 'lucide-react';
import { useAdminDashboard, useReport, useDownloadReportCsv } from '@/modules/admin';
import type {
  CategoryPerformanceRow,
  CollectionPerformanceRow,
  OrdersByCountryRow,
  OrdersByStatusRow,
  ProductPerformanceRow,
  ReportType,
  RevenueReportRow,
  SellerPerformanceRow,
} from '@/modules/admin';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
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

function ReportSection({
  title,
  reportType,
  filter,
  children,
}: {
  title: string;
  reportType: ReportType;
  filter: { from?: string; to?: string };
  children: React.ReactNode;
}) {
  const downloadCsv = useDownloadReportCsv();
  return (
    <div className="rounded-card border border-border bg-bg-surface p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-h4 font-serif text-text-primary">{title}</h2>
        <button
          type="button"
          onClick={() => downloadCsv.mutate({ type: reportType, filter })}
          disabled={downloadCsv.isPending}
          className="flex items-center gap-1.5 text-caption font-semibold text-accent-secondary hover:text-accent-secondary-hover disabled:opacity-50"
        >
          <Download size={12} aria-hidden="true" />
          Export CSV
        </button>
      </div>
      {children}
    </div>
  );
}

export default function AdminReportsPage() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const filter = useMemo(() => ({ from: from || undefined, to: to || undefined }), [from, to]);

  const { data: summary } = useAdminDashboard();
  const { data: revenue } = useReport<RevenueReportRow>('revenue', filter);
  const { data: ordersByStatus } = useReport<OrdersByStatusRow>('orders-by-status', filter);
  const { data: ordersByCountry } = useReport<OrdersByCountryRow>('orders-by-country', filter);
  const { data: sellerPerformance } = useReport<SellerPerformanceRow>('sellers-performance', filter);
  const { data: productPerformance } = useReport<ProductPerformanceRow>('products-performance', filter);
  const { data: categoryPerformance } = useReport<CategoryPerformanceRow>('categories-performance', filter);
  const { data: collectionPerformance } = useReport<CollectionPerformanceRow>('collections-performance', filter);

  const revenueRow = revenue?.[0];

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-h2 font-serif font-medium text-text-primary">Reports</h1>
          <p className="mt-1 text-small text-text-muted">Revenue, sellers, products, and catalogue performance</p>
        </div>
        <div className="flex items-end gap-3">
          <div>
            <Label htmlFor="report-from">From</Label>
            <Input id="report-from" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          </div>
          <div>
            <Label htmlFor="report-to">To</Label>
            <Input id="report-to" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          </div>
          {(from || to) && (
            <button
              type="button"
              onClick={() => {
                setFrom('');
                setTo('');
              }}
              className="h-10 text-small text-text-muted hover:text-text-primary"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total GMV" value={revenueRow ? formatCurrency(revenueRow.gmv) : '—'} icon={TrendingUp} />
        <StatCard label="Total Margin" value={revenueRow ? formatCurrency(revenueRow.adminMargin) : '—'} icon={PiggyBank} />
        <StatCard label="Seller Payouts" value={revenueRow ? formatCurrency(revenueRow.sellerPayouts) : '—'} icon={Wallet} />
        <StatCard label="Active Sellers" value={summary?.totalApprovedSellers ?? '—'} icon={Store} />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
        <ReportSection title="Orders by Status" reportType="orders-by-status" filter={filter}>
          <ul className="mt-4 divide-y divide-border">
            {ordersByStatus?.map((row) => (
              <li key={row.status} className="flex items-center justify-between py-3 text-small first:pt-0 last:pb-0">
                <span className="text-text-muted">{row.status}</span>
                <span className="font-semibold text-text-primary">{row.count}</span>
              </li>
            ))}
            {ordersByStatus?.length === 0 && <li className="py-3 text-small text-text-muted">No data for this range.</li>}
          </ul>
        </ReportSection>

        <ReportSection title="Orders by Country" reportType="orders-by-country" filter={filter}>
          <ul className="mt-4 divide-y divide-border">
            {ordersByCountry?.map((row) => (
              <li key={row.country} className="flex items-center justify-between py-3 text-small first:pt-0 last:pb-0">
                <span className="text-text-muted">{row.country}</span>
                <span className="flex items-center gap-3">
                  <span className="text-text-muted">{row.count} orders</span>
                  <span className="font-semibold text-text-primary">{formatCurrency(row.gmv)}</span>
                </span>
              </li>
            ))}
            {ordersByCountry?.length === 0 && <li className="py-3 text-small text-text-muted">No data for this range.</li>}
          </ul>
        </ReportSection>

        <ReportSection title="Top Performing Sellers" reportType="sellers-performance" filter={filter}>
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
        </ReportSection>

        <ReportSection title="Categories Performance" reportType="categories-performance" filter={filter}>
          <ul className="mt-4 divide-y divide-border">
            {categoryPerformance?.slice(0, 8).map((row) => (
              <li key={row.categoryId} className="flex items-center justify-between py-3 text-small first:pt-0 last:pb-0">
                <span className="text-text-muted">{row.name}</span>
                <span className="flex items-center gap-3">
                  <span className="text-text-muted">{row.ordersCount} orders</span>
                  <span className="font-semibold text-text-primary">{formatCurrency(row.gmv)}</span>
                </span>
              </li>
            ))}
            {categoryPerformance?.length === 0 && <li className="py-3 text-small text-text-muted">No data for this range.</li>}
          </ul>
        </ReportSection>
      </div>

      <div className="mt-6">
        <ReportSection title="Collections Performance" reportType="collections-performance" filter={filter}>
          <div className="-mx-5 mt-4 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Collection</TableHead>
                  <TableHead>Orders</TableHead>
                  <TableHead>GMV</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {collectionPerformance?.map((row) => (
                  <TableRow key={row.collectionId}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell className="text-text-muted">{row.ordersCount}</TableCell>
                    <TableCell className="text-text-muted">{formatCurrency(row.gmv)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {collectionPerformance?.length === 0 && (
              <p className="px-5 py-3 text-small text-text-muted">No data for this range.</p>
            )}
          </div>
        </ReportSection>
      </div>

      <div className="mt-6">
        <ReportSection title="Top Products" reportType="products-performance" filter={filter}>
          <div className="-mx-5 mt-4 overflow-hidden">
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
        </ReportSection>
      </div>
    </div>
  );
}
