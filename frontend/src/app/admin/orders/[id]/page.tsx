'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { OrderStatusBadge } from '@/components/OrderStatusBadge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/Dialog';
import {
  useAdminOrder,
  useCollectOrder,
  useConfirmOrder,
  useDeliverOrder,
  useProcureOrder,
  useShipOrder,
  useCancelOrder,
  useUpdateOrderTracking,
  useExportOrderDocuments,
} from '@/modules/orders';
import { formatCurrency } from '@/utils/formatCurrency';

const NEXT_ACTION: Record<string, { label: string; status: string } | undefined> = {
  PAYMENT_RECEIVED: { label: 'Confirm Order', status: 'CONFIRMED' },
  CONFIRMED: { label: 'Move to Procuring', status: 'PROCURING' },
  PROCURING: { label: 'Mark Collected', status: 'COLLECTED' },
  COLLECTED: { label: 'Mark In Transit', status: 'IN_TRANSIT' },
  IN_TRANSIT: { label: 'Mark Delivered', status: 'DELIVERED' },
};

const CANCELLABLE_STATUSES = new Set(['PAYMENT_RECEIVED', 'CONFIRMED']);
const TRACKING_ELIGIBLE_STATUSES = new Set(['COLLECTED', 'IN_TRANSIT', 'DELIVERED']);
const EXPORT_ELIGIBLE_STATUSES = new Set(['COLLECTED', 'IN_TRANSIT', 'DELIVERED']);

const DOCUMENT_OPTIONS = [
  { key: 'commercial_invoice', label: 'Commercial Invoice' },
  { key: 'packing_list', label: 'Packing List' },
  { key: 'certificate_of_origin', label: 'Certificate of Origin' },
  { key: 'bill_of_lading', label: 'Bill of Lading' },
];

export interface AdminOrderDetailPageProps {
  readonly params: { id: string };
}

export default function AdminOrderDetailPage({ params }: AdminOrderDetailPageProps) {
  const { data: order, isLoading } = useAdminOrder(params.id);
  const confirmMutation = useConfirmOrder();
  const procureMutation = useProcureOrder();
  const collectMutation = useCollectOrder();
  const shipMutation = useShipOrder();
  const deliverMutation = useDeliverOrder();
  const cancelMutation = useCancelOrder();
  const updateTrackingMutation = useUpdateOrderTracking();
  const exportDocsMutation = useExportOrderDocuments();

  const [trackingNumber, setTrackingNumber] = useState('');
  const [trackingEdit, setTrackingEdit] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [cancelOpen, setCancelOpen] = useState(false);
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);

  if (isLoading || !order) {
    return <p className="text-small text-text-muted">Loading&hellip;</p>;
  }

  const nextAction = NEXT_ACTION[order.status];
  const isPending =
    confirmMutation.isPending || procureMutation.isPending || collectMutation.isPending || shipMutation.isPending || deliverMutation.isPending;
  const canCancel = CANCELLABLE_STATUSES.has(order.status);
  const canUpdateTracking = TRACKING_ELIGIBLE_STATUSES.has(order.status);
  const canExportDocs = EXPORT_ELIGIBLE_STATUSES.has(order.status);

  function handleAdvance() {
    if (!order) return;
    switch (order.status) {
      case 'PAYMENT_RECEIVED':
        confirmMutation.mutate(order.id);
        break;
      case 'CONFIRMED':
        procureMutation.mutate({ id: order.id });
        break;
      case 'PROCURING':
        collectMutation.mutate(order.id);
        break;
      case 'COLLECTED':
        shipMutation.mutate({ id: order.id, trackingNumber: trackingNumber || undefined });
        break;
      case 'IN_TRANSIT':
        deliverMutation.mutate(order.id);
        break;
      default:
        break;
    }
  }

  async function handleCancel() {
    if (!cancelReason.trim()) return;
    await cancelMutation.mutateAsync({ id: order!.id, reason: cancelReason.trim() });
    setCancelOpen(false);
    setCancelReason('');
  }

  function handleUpdateTracking() {
    if (!trackingEdit.trim()) return;
    updateTrackingMutation.mutate({ id: order!.id, trackingNumber: trackingEdit.trim() });
    setTrackingEdit('');
  }

  function toggleDoc(key: string) {
    setSelectedDocs((prev) => (prev.includes(key) ? prev.filter((d) => d !== key) : [...prev, key]));
  }

  function handleExportDocs() {
    if (selectedDocs.length === 0) return;
    exportDocsMutation.mutate({ id: order!.id, documents: selectedDocs });
  }

  return (
    <div className="max-w-3xl">
      <Link
        href="/admin/orders"
        className="mb-4 flex w-fit items-center gap-1.5 text-small font-medium text-text-muted hover:text-text-primary"
      >
        <ArrowLeft size={14} aria-hidden="true" />
        Back to Orders
      </Link>

      <div className="flex items-center justify-between gap-3">
        <h1 className="text-h2 font-serif font-medium text-text-primary">Order #{order.id.slice(0, 8)}</h1>
        <OrderStatusBadge status={order.status} />
      </div>

      <div className="mt-6 overflow-hidden rounded-card border border-border bg-bg-surface">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Qty</TableHead>
              <TableHead>Seller Price</TableHead>
              <TableHead>Admin Price</TableHead>
              <TableHead>Margin</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {order.items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="relative h-10 w-10 overflow-hidden rounded bg-fill-subtle">
                      {item.product.images[0] && (
                        <Image src={item.product.images[0].url} alt={item.product.name} fill className="object-cover" />
                      )}
                    </div>
                    <span className="font-medium text-text-primary">{item.product.name}</span>
                  </div>
                </TableCell>
                <TableCell className="text-text-muted">{item.quantity}</TableCell>
                <TableCell className="text-text-muted">{formatCurrency(item.unitSellerPrice)}</TableCell>
                <TableCell className="text-text-muted">{formatCurrency(item.unitAdminPrice)}</TableCell>
                <TableCell className="font-medium">
                  {formatCurrency(Number(item.unitAdminPrice) - Number(item.unitSellerPrice))}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="mt-4 flex justify-end gap-8 rounded-card border border-border bg-bg-surface px-5 py-4">
        <div>
          <p className="text-small text-text-muted">Buyer Paid</p>
          <p className="mt-0.5 text-body font-semibold text-text-primary">{formatCurrency(order.adminPriceTotal)}</p>
        </div>
        <div>
          <p className="text-small text-text-muted">Seller Owed</p>
          <p className="mt-0.5 text-body font-semibold text-text-primary">{formatCurrency(order.sellerPriceTotal)}</p>
        </div>
        <div>
          <p className="text-small text-text-muted">Margin</p>
          <p className="mt-0.5 text-body font-semibold text-text-primary">{formatCurrency(order.adminMargin)}</p>
        </div>
      </div>

      {order.cancelledReason && (
        <p className="mt-4 rounded-card border border-error/30 bg-error/5 px-4 py-3 text-small text-error">
          Cancelled: {order.cancelledReason}
        </p>
      )}

      {nextAction && (
        <div className="mt-8 rounded-card border border-border bg-bg-surface p-4">
          {order.status === 'COLLECTED' && (
            <Input
              value={trackingNumber}
              onChange={(event) => setTrackingNumber(event.target.value)}
              placeholder="Tracking number (optional)"
              className="mb-3"
            />
          )}
          <Button type="button" onClick={handleAdvance} disabled={isPending}>
            {nextAction.label}
          </Button>
        </div>
      )}

      {order.trackingNumber && (
        <p className="mt-4 text-small text-text-muted">Tracking number: {order.trackingNumber}</p>
      )}

      {(canUpdateTracking || canExportDocs || canCancel) && (
        <div className="mt-6 space-y-5">
          {canUpdateTracking && (
            <div className="rounded-card border border-border bg-bg-surface p-4">
              <h2 className="text-small font-semibold text-text-primary">Update Tracking Number</h2>
              <div className="mt-3 flex gap-2">
                <Input
                  value={trackingEdit}
                  onChange={(event) => setTrackingEdit(event.target.value)}
                  placeholder={order.trackingNumber ?? 'Enter tracking number'}
                />
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleUpdateTracking}
                  disabled={updateTrackingMutation.isPending || !trackingEdit.trim()}
                >
                  Update
                </Button>
              </div>
            </div>
          )}

          {canExportDocs && (
            <div className="rounded-card border border-border bg-bg-surface p-4">
              <h2 className="text-small font-semibold text-text-primary">Export Documents</h2>
              <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
                {DOCUMENT_OPTIONS.map((doc) => (
                  <label key={doc.key} className="flex items-center gap-2 text-small text-text-primary">
                    <input
                      type="checkbox"
                      checked={selectedDocs.includes(doc.key)}
                      onChange={() => toggleDoc(doc.key)}
                      className="h-4 w-4 rounded border-border text-accent-primary focus:ring-accent-primary"
                    />
                    {doc.label}
                  </label>
                ))}
              </div>
              <Button
                type="button"
                variant="ghost"
                className="mt-3"
                onClick={handleExportDocs}
                disabled={exportDocsMutation.isPending || selectedDocs.length === 0}
              >
                Export Selected
              </Button>
            </div>
          )}

          {canCancel && (
            <div className="rounded-card border border-accent-secondary/30 bg-accent-secondary/5 p-4">
              <h2 className="text-small font-semibold text-text-primary">Cancel Order</h2>
              <p className="mt-1 text-caption text-text-muted">
                Cancelling releases the order from fulfillment. This cannot be undone.
              </p>
              <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
                <DialogTrigger asChild>
                  <Button type="button" variant="accent" size="sm" className="mt-3">
                    Cancel Order
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Cancel this order?</DialogTitle>
                    <DialogDescription>Provide a reason — this is recorded on the order.</DialogDescription>
                  </DialogHeader>
                  <div className="px-6 pb-2">
                    <Label htmlFor="cancel-reason">Cancellation reason</Label>
                    <textarea
                      id="cancel-reason"
                      value={cancelReason}
                      onChange={(event) => setCancelReason(event.target.value)}
                      rows={3}
                      className="w-full rounded-input border border-border bg-bg-surface px-3 py-2 text-body text-text-primary outline-none transition-colors focus:border-accent-primary focus:ring-1 focus:ring-accent-primary"
                    />
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="ghost" onClick={() => setCancelOpen(false)}>
                      Keep Order
                    </Button>
                    <Button
                      type="button"
                      variant="accent"
                      onClick={handleCancel}
                      disabled={cancelMutation.isPending || !cancelReason.trim()}
                    >
                      Confirm Cancellation
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
