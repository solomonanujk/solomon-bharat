'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Check } from 'lucide-react';
import { OrderStatusBadge } from '@/components/OrderStatusBadge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { useMyOrder } from '@/modules/orders';
import { formatCurrency } from '@/utils/formatCurrency';

const TRACKER_STAGES = ['Processing', 'Shipped', 'Delivered'] as const;

function stageIndexForStatus(status: string): number {
  if (status === 'DELIVERED') return 2;
  if (status === 'IN_TRANSIT') return 1;
  if (status === 'CANCELLED') return -1;
  return 0;
}

export interface OrderDetailPageProps {
  readonly params: { id: string };
}

export default function BuyerOrderDetailPage({ params }: OrderDetailPageProps) {
  const { data: order, isLoading } = useMyOrder(params.id);
  const searchParams = useSearchParams();
  const justConfirmed = searchParams.get('confirmed') === '1';

  if (isLoading || !order) {
    return <p className="text-body text-text-muted">Loading&hellip;</p>;
  }

  const currentStage = stageIndexForStatus(order.status);

  return (
    <div>
      {justConfirmed && (
        <div className="mb-6 rounded-card border border-success bg-success/10 p-4 text-small text-success">
          Thank you &mdash; your order has been placed successfully.
        </div>
      )}

      <p className="text-small text-text-muted">
        <Link href="/orders" className="hover:text-accent-primary hover:underline">
          Orders
        </Link>{' '}
        / Order #{order.id.slice(0, 8)}
      </p>

      <div className="mt-2 flex items-center justify-between">
        <h1 className="font-serif text-h2 text-text-primary">Order #{order.id.slice(0, 8)}</h1>
        <OrderStatusBadge status={order.status} />
      </div>
      <p className="mt-1 text-small text-text-muted">Placed on {new Date(order.createdAt).toLocaleDateString()}</p>

      {order.status !== 'CANCELLED' ? (
        <div className="mt-8 flex items-center">
          {TRACKER_STAGES.map((stage, index) => (
            <div key={stage} className="flex flex-1 items-center last:flex-none">
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold ${
                    index <= currentStage ? 'bg-accent-primary text-white' : 'border border-border bg-bg-surface text-text-muted'
                  }`}
                >
                  {index < currentStage ? <Check size={14} aria-hidden="true" /> : index + 1}
                </div>
                <p className="mt-2 text-caption font-medium text-text-muted">{stage}</p>
              </div>
              {index < TRACKER_STAGES.length - 1 && (
                <div
                  className={`mx-2 h-0.5 flex-1 ${index < currentStage ? 'bg-accent-primary' : 'bg-fill-subtle'}`}
                />
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-8 rounded-card border border-error bg-error/10 p-4 text-small text-error">
          Cancelled: {order.cancelledReason}
        </div>
      )}

      <div className="mt-10 overflow-hidden rounded-card border border-border bg-bg-surface">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Product</TableHead>
              <TableHead>Quantity</TableHead>
              <TableHead>Unit Price</TableHead>
              <TableHead className="text-right">Line Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {order.items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded border border-border bg-bg-primary">
                      {item.productImage && (
                        <Image src={item.productImage} alt={item.productName} fill className="object-cover" />
                      )}
                    </div>
                    <span className="text-text-primary">{item.productName}</span>
                  </div>
                </TableCell>
                <TableCell className="text-text-muted">{item.quantity}</TableCell>
                <TableCell className="text-text-muted">{formatCurrency(item.unitAdminPrice)}</TableCell>
                <TableCell className="text-right font-medium text-text-primary">
                  {formatCurrency(item.lineAdminTotal)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="mt-6 flex justify-end">
        <div className="w-full max-w-xs space-y-2 rounded-card border border-border bg-bg-surface p-4 text-small">
          <div className="flex justify-between text-text-muted">
            <span>Subtotal</span>
            <span>{formatCurrency(order.adminPriceTotal)}</span>
          </div>
          <div className="flex justify-between border-t border-border pt-2 font-semibold text-text-primary">
            <span>Total</span>
            <span>{formatCurrency(order.adminPriceTotal)}</span>
          </div>
          <p className="text-caption text-text-muted">Paid via PayPal</p>
        </div>
      </div>

      {order.trackingNumber && (
        <div className="mt-6 rounded-card border border-border bg-bg-surface p-4 text-small">
          <p className="font-semibold uppercase tracking-[0.05em] text-caption text-text-muted">Tracking Number</p>
          <p className="mt-1 font-medium text-text-primary">{order.trackingNumber}</p>
          {order.expectedCollectionDate && (
            <p className="mt-1 text-text-muted">
              Expected collection: {new Date(order.expectedCollectionDate).toLocaleDateString()}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
