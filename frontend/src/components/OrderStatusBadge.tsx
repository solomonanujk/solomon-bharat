const STATUS_LABELS: Record<string, string> = {
  PENDING_PAYMENT: 'Pending Payment',
  PAYMENT_RECEIVED: 'Payment Received',
  CONFIRMED: 'Confirmed',
  PROCURING: 'Procuring',
  COLLECTED: 'Collected',
  IN_TRANSIT: 'In Transit',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
};

const STATUS_CLASSES: Record<string, string> = {
  DELIVERED: 'bg-success/10 text-success',
  CANCELLED: 'bg-error/10 text-error',
};

const DEFAULT_CLASSES = 'bg-accent-secondary/10 text-accent-secondary';

export interface OrderStatusBadgeProps {
  readonly status: string;
}

export function OrderStatusBadge({ status }: OrderStatusBadgeProps) {
  return (
    <span
      className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${STATUS_CLASSES[status] ?? DEFAULT_CLASSES}`}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}
