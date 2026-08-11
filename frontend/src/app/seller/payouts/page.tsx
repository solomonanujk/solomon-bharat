'use client';

import { Badge } from '@/components/ui/Badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { useMyPayouts, useMyPayoutSummary } from '@/modules/payouts';
import { formatCurrency } from '@/utils/formatCurrency';

const STATUS_VARIANT: Record<string, 'success' | 'warning'> = {
  PAID: 'success',
  PENDING: 'warning',
};

export default function SellerPayoutsPage() {
  const { data: summary } = useMyPayoutSummary();
  const { data: payouts, isLoading } = useMyPayouts();

  return (
    <div>
      <h1 className="font-serif text-h3 text-text-primary">Payouts</h1>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-card border border-border bg-bg-surface p-6">
          <p className="text-caption font-semibold uppercase tracking-[0.05em] text-text-muted">Total Earned</p>
          <p className="mt-2 font-serif text-h2 text-text-primary">
            {summary ? formatCurrency(summary.totalEarned) : '—'}
          </p>
        </div>
        <div className="rounded-card border border-border bg-bg-surface p-6">
          <p className="text-caption font-semibold uppercase tracking-[0.05em] text-text-muted">Pending Payout</p>
          <p className="mt-2 font-serif text-h2 text-text-primary">
            {summary ? formatCurrency(summary.pendingPayout) : '—'}
          </p>
        </div>
        <div className="rounded-card border border-border bg-bg-surface p-6">
          <p className="text-caption font-semibold uppercase tracking-[0.05em] text-text-muted">Last Payout</p>
          <p className="mt-2 font-serif text-h2 text-text-primary">
            {summary?.lastPayout ? formatCurrency(summary.lastPayout.amount) : '—'}
          </p>
        </div>
      </div>

      <p className="mt-6 text-small text-text-muted">
        Payouts are processed manually by Solomon Bharat and marked paid once completed.
      </p>

      {isLoading && <p className="mt-6 text-small text-text-muted">Loading&hellip;</p>}

      {payouts && payouts.data.length > 0 && (
        <div className="mt-4 rounded-card border border-border bg-bg-surface">
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
              {payouts.data.map((payout) => (
                <TableRow key={payout.id}>
                  <TableCell className="text-text-muted">#{payout.orderId.slice(0, 8)}</TableCell>
                  <TableCell className="font-medium">{formatCurrency(payout.amount)}</TableCell>
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
        </div>
      )}
    </div>
  );
}
