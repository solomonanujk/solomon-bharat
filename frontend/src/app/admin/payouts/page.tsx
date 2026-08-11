'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { useAdminPayouts, useMarkPayoutPaid, useAddPayoutNotes } from '@/modules/payouts';
import type { PayoutStatus } from '@/modules/payouts';
import { formatCurrency } from '@/utils/formatCurrency';

const TABS: { key: PayoutStatus | 'ALL'; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'PENDING', label: 'Pending' },
  { key: 'PAID', label: 'Paid' },
];

export default function AdminPayoutsPage() {
  const [tab, setTab] = useState<PayoutStatus | 'ALL'>('ALL');
  const { data: payouts, isLoading } = useAdminPayouts(tab === 'ALL' ? {} : { status: tab });
  const markPaidMutation = useMarkPayoutPaid();
  const addNotesMutation = useAddPayoutNotes();

  function handleMarkPaid(id: string) {
    const notes = window.prompt('Notes for this payout (optional):') ?? undefined;
    markPaidMutation.mutate({ id, notes: notes || undefined });
  }

  function handleAddNotes(id: string, currentNotes: string | null) {
    const notes = window.prompt('Payout notes:', currentNotes ?? '');
    if (notes) addNotesMutation.mutate({ id, notes });
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-h2 font-serif font-medium text-text-primary">Payouts</h1>
        <p className="mt-1 text-small text-text-muted">
          Payouts are generated automatically when an order is collected from the seller, and processed manually
          via bank transfer.
        </p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as PayoutStatus | 'ALL')}>
        <TabsList>
          {TABS.map((t) => (
            <TabsTrigger key={t.key} value={t.key}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {isLoading && <p className="mt-6 text-small text-text-muted">Loading&hellip;</p>}

      {payouts && payouts.data.length === 0 && <p className="mt-6 text-small text-text-muted">No payouts found.</p>}

      {payouts && payouts.data.length > 0 && (
        <div className="mt-6 overflow-hidden rounded-card border border-border bg-bg-surface">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Seller</TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Paid On</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {payouts.data.map((payout) => (
                <TableRow key={payout.id} className="align-top">
                  <TableCell className="font-semibold">{payout.seller.businessName}</TableCell>
                  <TableCell className="text-text-muted">#{payout.orderId.slice(0, 8)}</TableCell>
                  <TableCell className="font-medium">{formatCurrency(payout.amount)}</TableCell>
                  <TableCell>
                    <Badge variant={payout.status === 'PAID' ? 'success' : 'warning'}>
                      {payout.status === 'PAID' ? 'Paid' : 'Pending'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-text-muted">
                    {payout.paidAt ? new Date(payout.paidAt).toLocaleDateString() : '—'}
                  </TableCell>
                  <TableCell className="max-w-xs text-text-muted">{payout.notes || '—'}</TableCell>
                  <TableCell>
                    <div className="flex flex-col items-end gap-2">
                      {payout.status === 'PENDING' && (
                        <button
                          type="button"
                          onClick={() => handleMarkPaid(payout.id)}
                          disabled={markPaidMutation.isPending}
                          className="text-caption font-semibold text-accent-primary hover:text-accent-primary-hover"
                        >
                          Mark Paid
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleAddNotes(payout.id, payout.notes)}
                        disabled={addNotesMutation.isPending}
                        className="text-caption font-semibold text-accent-secondary hover:text-accent-secondary-hover"
                      >
                        Edit Notes
                      </button>
                    </div>
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
