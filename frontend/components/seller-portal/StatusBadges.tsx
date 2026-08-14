'use client'

import { Badge, type BadgeProps } from '@/components/ui/badge'
import type { ApprovalStatus, OrderStatus, PayoutStatus } from '@/types'

// ─── Product approval status ──────────────────────────────────────────────────

const APPROVAL_CONFIG: Record<ApprovalStatus, { label: string; variant: NonNullable<BadgeProps['variant']> }> = {
  PENDING: { label: 'Pending Review', variant: 'warning' },
  APPROVED: { label: 'Approved', variant: 'success' },
  REJECTED: { label: 'Rejected', variant: 'error' },
  RESUBMITTED: { label: 'Resubmitted — Pending Review', variant: 'accent' },
}

export function ApprovalStatusBadge({ status, className }: { status: ApprovalStatus; className?: string }) {
  const config = APPROVAL_CONFIG[status] ?? { label: status, variant: 'default' as const }
  return (
    <Badge variant={config.variant} className={className}>
      {config.label}
    </Badge>
  )
}

// ─── Payout status ─────────────────────────────────────────────────────────────

const PAYOUT_CONFIG: Record<PayoutStatus, { label: string; variant: NonNullable<BadgeProps['variant']> }> = {
  PAID: { label: 'Paid', variant: 'success' },
  PENDING: { label: 'Pending', variant: 'warning' },
}

export function PayoutStatusBadge({ status, className }: { status: PayoutStatus; className?: string }) {
  const config = PAYOUT_CONFIG[status] ?? { label: status, variant: 'default' as const }
  return (
    <Badge variant={config.variant} className={className}>
      {config.label}
    </Badge>
  )
}

// ─── Order (item) status — note: this is the NEW order lifecycle from
// types/index.ts, distinct from the older OrderStatus values still referenced
// by components/shared/StatusBadge.tsx and lib/utils.ts#getStatusColor (those
// two are stale against the current enum and are left untouched — out of
// scope here; the seller portal uses this local badge instead). ────────────

const ORDER_STATUS_CONFIG: Record<OrderStatus, { label: string; variant: NonNullable<BadgeProps['variant']> }> = {
  PENDING_PAYMENT: { label: 'Pending Payment', variant: 'default' },
  PAYMENT_RECEIVED: { label: 'Payment Received', variant: 'accent' },
  CONFIRMED: { label: 'Confirmed', variant: 'accent' },
  PROCURING: { label: 'Procuring', variant: 'warning' },
  COLLECTED: { label: 'Collected', variant: 'warning' },
  IN_TRANSIT: { label: 'In Transit', variant: 'accent' },
  DELIVERED: { label: 'Delivered', variant: 'success' },
  CANCELLED: { label: 'Cancelled', variant: 'error' },
}

export function OrderItemStatusBadge({ status, className }: { status: OrderStatus; className?: string }) {
  const config = ORDER_STATUS_CONFIG[status] ?? { label: status, variant: 'default' as const }
  return (
    <Badge variant={config.variant} className={className}>
      {config.label}
    </Badge>
  )
}
