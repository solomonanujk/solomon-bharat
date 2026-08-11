'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TablePagination } from '@/components/ui/Table';
import { useMyPayouts, useMyPayoutSummary } from '@/modules/payouts';
import { formatCurrency } from '@/utils/formatCurrency';

const STATUS_VARIANT: Record<string, 'success' | 'warning'> = {
  PAID: 'success',
  PENDING: 'warning',
};

const PAGE_SIZE = 20;

function StatCard({ label, value }: { readonly label: string; readonly value: string }) {
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
      <div className="mt-3 h-7 w-20 rounded bg-fill-subtle" />
    </div>
  );
}

function SkeletonRows() {
  return (
    <div className="animate-pulse overflow-hidden rounded-card border border-border bg-bg-surface">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 border-b border-border px-4 py-3 last:border-0">
          <div className="h-4 w-1/6 rounded bg-fill-subtle" />
          <div className="h-4 w-1/6 rounded bg-fill-subtle" />
          <div className="h-5 w-16 rounded bg-fill-subtle" />
          <div className="h-4 w-1/6 rounded bg-fill-subtle" />
        </div>
      ))}
    </div>
  );
}

export default function SellerPayoutsPage() {
  const [page, setPage] = useState(1);
  const { data: summary, isLoading: summaryLoading } = useMyPayoutSummary();
  const { data: payouts, isLoading } = useMyPayouts({ page, limit: PAGE_SIZE });

  const rows = payouts?.data ?? [];
  const total = payouts?.total ?? 0;

  return (
    <div>
      <h1 className="font-serif text-h3 text-text-primary">Payouts</h1>
      <p className="mt-1 text-small text-text-muted">
        Payouts are processed manually by Solomon Bharat and marked paid once completed.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {summaryLoading ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <StatCard label="Total Earned" value={summary ? formatCurrency(summary.totalEarned) : '—'} />
            <StatCard label="Pending Payout" value={summary ? formatCurrency(summary.pendingPayout) : '—'} />
            <StatCard label="Last Payout" value={summary?.lastPayout ? formatCurrency(summary.lastPayout.amount) : '—'} />
          </>
        )}
      </div>

      {isLoading && <div className="mt-6"><SkeletonRows /></div>}

      {!isLoading && rows.length === 0 && (
        <div className="mt-6 rounded-card border border-dashed border-border py-16 text-center">
          <p className="text-body font-medium text-text-primary">No payouts yet.</p>
          <p className="mt-1 text-small text-text-muted">Payouts for delivered orders will appear here.</p>
        </div>
      )}

      {!isLoading && rows.length > 0 && (
        <div className="mt-6 overflow-hidden rounded-card border border-border bg-bg-surface">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Order</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((payout) => (
                <TableRow key={payout.id}>
                  <TableCell className="text-text-muted">#{payout.orderId.slice(0, 8)}</TableCell>
                  <TableCell className="tabular-nums font-medium">{formatCurrency(payout.amount)}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[payout.status] ?? 'default'}>
                      {payout.status === 'PAID' ? 'Paid' : 'Pending'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-text-muted">
                    {payout.paidAt ? new Date(payout.paidAt).toLocaleDateString() : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <TablePagination total={total} page={page} pageSize={PAGE_SIZE} onPageChange={setPage} />
        </div>
      )}
    </div>
  );
}
