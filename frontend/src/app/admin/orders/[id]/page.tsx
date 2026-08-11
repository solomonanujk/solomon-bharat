'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { OrderStatusBadge } from '@/components/OrderStatusBadge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import {
  useAdminOrder,
  useCollectOrder,
  useConfirmOrder,
  useDeliverOrder,
  useProcureOrder,
  useShipOrder,
} from '@/modules/orders';
import { formatCurrency } from '@/utils/formatCurrency';

const NEXT_ACTION: Record<string, { label: string; status: string } | undefined> = {
  PAYMENT_RECEIVED: { label: 'Confirm Order', status: 'CONFIRMED' },
  CONFIRMED: { label: 'Move to Procuring', status: 'PROCURING' },
  PROCURING: { label: 'Mark Collected', status: 'COLLECTED' },
  COLLECTED: { label: 'Mark In Transit', status: 'IN_TRANSIT' },
  IN_TRANSIT: { label: 'Mark Delivered', status: 'DELIVERED' },
};

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
  const [trackingNumber, setTrackingNumber] = useState('');

  if (isLoading || !order) {
    return <p className="text-small text-text-muted">Loading&hellip;</p>;
  }

  const nextAction = NEXT_ACTION[order.status];
  const isPending = confirmMutation.isPending || procureMutation.isPending || collectMutation.isPending || shipMutation.isPending || deliverMutation.isPending;

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
    </div>
  );
}
