'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Label } from '@/components/ui/Label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TablePagination } from '@/components/ui/Table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/Dialog';
import { useAdminPayouts, useMarkPayoutPaid, useAddPayoutNotes } from '@/modules/payouts';
import type { AdminPayout, PayoutStatus } from '@/modules/payouts';
import { formatCurrency } from '@/utils/formatCurrency';

const TABS: { key: PayoutStatus | 'ALL'; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'PENDING', label: 'Pending' },
  { key: 'PAID', label: 'Paid' },
];

type DialogState = { type: 'mark-paid' | 'notes'; payout: AdminPayout } | null;

export default function AdminPayoutsPage() {
  const [tab, setTab] = useState<PayoutStatus | 'ALL'>('ALL');
  const [page, setPage] = useState(1);
  const { data: payouts, isLoading } = useAdminPayouts(tab === 'ALL' ? { page } : { status: tab, page });
  const markPaidMutation = useMarkPayoutPaid();
  const addNotesMutation = useAddPayoutNotes();

  const [dialog, setDialog] = useState<DialogState>(null);
  const [dialogValue, setDialogValue] = useState('');

  function handleTabChange(value: PayoutStatus | 'ALL') {
    setTab(value);
    setPage(1);
  }

  function openDialog(type: NonNullable<DialogState>['type'], payout: AdminPayout) {
    setDialog({ type, payout });
    setDialogValue(type === 'notes' ? payout.notes ?? '' : '');
  }

  async function handleDialogSubmit() {
    if (!dialog) return;
    if (dialog.type === 'mark-paid') {
      await markPaidMutation.mutateAsync({ id: dialog.payout.id, notes: dialogValue.trim() || undefined });
    } else {
      if (!dialogValue.trim()) return;
      await addNotesMutation.mutateAsync({ id: dialog.payout.id, notes: dialogValue.trim() });
    }
    setDialog(null);
    setDialogValue('');
  }

  const dialogPending = markPaidMutation.isPending || addNotesMutation.isPending;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-h2 font-serif font-medium text-text-primary">Payouts</h1>
        <p className="mt-1 text-small text-text-muted">
          Payouts are generated automatically when an order is collected from the seller, and processed manually
          via bank transfer.
        </p>
      </div>

      <Tabs value={tab} onValueChange={(v) => handleTabChange(v as PayoutStatus | 'ALL')}>
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
                        <Button
                          type="button"
                          size="sm"
                          className="border-success/40 bg-success/5 text-success hover:bg-success/10"
                          variant="ghost"
                          onClick={() => openDialog('mark-paid', payout)}
                        >
                          Mark Paid
                        </Button>
                      )}
                      <button
                        type="button"
                        onClick={() => openDialog('notes', payout)}
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
          <TablePagination total={payouts.total} page={page} onPageChange={setPage} />
        </div>
      )}

      <Dialog open={dialog !== null} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent>
          {dialog && (
            <>
              <DialogHeader>
                <DialogTitle>{dialog.type === 'mark-paid' ? 'Mark payout as paid' : 'Edit payout notes'}</DialogTitle>
                <DialogDescription>
                  {dialog.type === 'mark-paid'
                    ? `Confirm ${formatCurrency(dialog.payout.amount)} was transferred to ${dialog.payout.seller.businessName}.`
                    : `Internal notes for this payout to ${dialog.payout.seller.businessName}.`}
                </DialogDescription>
              </DialogHeader>
              <div className="px-6 pb-2">
                <Label htmlFor="payout-notes">Notes</Label>
                <textarea
                  id="payout-notes"
                  value={dialogValue}
                  onChange={(event) => setDialogValue(event.target.value)}
                  rows={3}
                  placeholder="Reference number, bank details, or other context…"
                  className="w-full rounded-input border border-border bg-bg-surface px-3 py-2 text-body text-text-primary outline-none transition-colors focus:border-accent-primary focus:ring-1 focus:ring-accent-primary"
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setDialog(null)}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleDialogSubmit}
                  disabled={dialogPending || (dialog.type === 'notes' && !dialogValue.trim())}
                >
                  {dialog.type === 'mark-paid' ? 'Confirm Paid' : 'Save Notes'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
