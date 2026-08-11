'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, Circle, AlertTriangle } from 'lucide-react';
import { OrderStatusBadge } from '@/components/OrderStatusBadge';
import { useMyOrder } from '@/modules/orders';
import { formatCurrency } from '@/utils/formatCurrency';

const TIMELINE_STEPS = ['CONFIRMED', 'PROCURING', 'COLLECTED', 'IN_TRANSIT', 'DELIVERED'] as const;

const TIMELINE_LABELS: Record<(typeof TIMELINE_STEPS)[number], string> = {
  CONFIRMED: 'Confirmed',
  PROCURING: 'Procuring',
  COLLECTED: 'Collected',
  IN_TRANSIT: 'In Transit',
  DELIVERED: 'Delivered',
};

function stepIndexForStatus(status: string): number {
  if (status === 'PENDING_PAYMENT' || status === 'PAYMENT_RECEIVED') return -1;
  return TIMELINE_STEPS.indexOf(status as (typeof TIMELINE_STEPS)[number]);
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

  const reachedIndex = stepIndexForStatus(order.status);
  const isCancelled = order.status === 'CANCELLED';

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

      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-h2 text-text-primary">Order #{order.id.slice(0, 8)}</h1>
        <OrderStatusBadge status={order.status} />
      </div>
      <p className="mt-1 text-small text-text-muted">Placed on {new Date(order.createdAt).toLocaleDateString()}</p>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px] lg:items-start">
        <div className="space-y-8">
          <section className="rounded-card border border-border bg-bg-surface p-6">
            <h2 className="text-caption font-semibold uppercase tracking-[0.08em] text-text-muted">Items</h2>
            <div className="mt-4 space-y-4">
              {order.items.map((item) => (
                <div key={item.id} className="flex items-center gap-3">
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded border border-border bg-bg-primary">
                    {item.productImage && (
                      <Image src={item.productImage} alt={item.productName} fill className="object-cover" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-text-primary">{item.productName}</p>
                    <p className="text-small text-text-muted">
                      Qty {item.quantity} &middot; {formatCurrency(item.unitAdminPrice)} each
                    </p>
                  </div>
                  <p className="shrink-0 font-semibold text-text-primary">{formatCurrency(item.lineAdminTotal)}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-between border-t border-border pt-4">
              <span className="font-semibold text-text-muted">Total</span>
              <span className="text-body-lg font-semibold text-text-primary">
                {formatCurrency(order.adminPriceTotal)}
              </span>
            </div>
          </section>

          {isCancelled ? (
            <div className="flex items-start gap-3 rounded-card border border-error bg-error/10 p-4">
              <AlertTriangle size={16} className="mt-0.5 shrink-0 text-error" aria-hidden="true" />
              <div>
                <p className="font-semibold text-error">Order Cancelled</p>
                <p className="mt-0.5 text-small text-text-muted">
                  {order.cancelledReason ?? 'This order was cancelled. Any payment will be refunded.'}
                </p>
              </div>
            </div>
          ) : (
            <section className="rounded-card border border-border bg-bg-surface p-6">
              <h2 className="text-caption font-semibold uppercase tracking-[0.08em] text-text-muted">
                Status Timeline
              </h2>
              <ol className="mt-4 space-y-4">
                {TIMELINE_STEPS.map((step, index) => {
                  const reached = reachedIndex >= index;
                  const isCurrent = reachedIndex === index;
                  return (
                    <li key={step} className="flex items-start gap-3">
                      <div className="mt-0.5 shrink-0">
                        {reached ? (
                          <CheckCircle2
                            size={18}
                            aria-hidden="true"
                            className={isCurrent ? 'text-accent-primary' : 'text-success'}
                          />
                        ) : (
                          <Circle size={18} aria-hidden="true" className="text-border" />
                        )}
                      </div>
                      <p
                        className={
                          reached
                            ? isCurrent
                              ? 'font-semibold text-accent-primary'
                              : 'font-medium text-text-primary'
                            : 'text-text-muted'
                        }
                      >
                        {TIMELINE_LABELS[step]}
                      </p>
                    </li>
                  );
                })}
              </ol>
            </section>
          )}
        </div>

        <aside className="space-y-6 rounded-card border border-border bg-bg-surface p-6 lg:sticky lg:top-8">
          <div>
            <h2 className="font-serif text-h4 text-text-primary">Order Summary</h2>
            <div className="mt-4 space-y-2 text-small">
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
            <div className="border-t border-border pt-4">
              <p className="text-caption font-semibold uppercase tracking-[0.05em] text-text-muted">
                Tracking Number
              </p>
              <p className="mt-1 font-medium text-text-primary">{order.trackingNumber}</p>
              {order.expectedCollectionDate && (
                <p className="mt-1 text-small text-text-muted">
                  Expected collection: {new Date(order.expectedCollectionDate).toLocaleDateString()}
                </p>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
