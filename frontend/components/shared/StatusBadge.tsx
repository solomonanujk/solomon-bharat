import { cn } from '@/lib/utils'
import type {
  AgentApplicationStatus,
  ApprovalStatus,
  CategoryStatus,
  CollectionStatus,
  OrderStatus,
  PayoutStatus,
  SellerApplicationStatus,
  UserStatus,
} from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────
// Generic across every status enum in the app (orders, product approval,
// payouts, categories, collections, seller applications, user accounts) so a
// single reusable badge can render any of them consistently.

type AnyStatus =
  | OrderStatus
  | ApprovalStatus
  | PayoutStatus
  | CategoryStatus
  | CollectionStatus
  | SellerApplicationStatus
  | AgentApplicationStatus
  | UserStatus
  | (string & {})

interface StatusBadgeProps {
  status: AnyStatus
  className?: string
}

// ─── Status config ────────────────────────────────────────────────────────────
// Keyed by the raw enum string. Distinct enums never need distinct colors for
// the same word (e.g. "PENDING" is always amber, "CANCELLED"/"REJECTED" are
// always red) so one flat map covers every domain.

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  // Orders
  PENDING_PAYMENT: { label: 'Pending Payment', className: 'bg-warning/[12%] text-warning' },
  PAYMENT_RECEIVED: { label: 'Payment Received', className: 'bg-accent/10 text-accent-hover' },
  CONFIRMED: { label: 'Confirmed', className: 'bg-accent/10 text-accent-hover' },
  PROCURING: { label: 'Procuring', className: 'bg-accent/10 text-accent-hover' },
  COLLECTED: { label: 'Collected', className: 'bg-accent/10 text-accent-hover' },
  IN_TRANSIT: { label: 'In Transit', className: 'bg-accent/10 text-accent-hover' },
  DELIVERED: { label: 'Delivered', className: 'bg-success/10 text-success' },
  CANCELLED: { label: 'Cancelled', className: 'bg-error/10 text-error' },

  // Approval / seller applications
  PENDING: { label: 'Pending', className: 'bg-warning/[12%] text-warning' },
  APPROVED: { label: 'Approved', className: 'bg-success/10 text-success' },
  REJECTED: { label: 'Rejected', className: 'bg-error/10 text-error' },
  RESUBMITTED: { label: 'Resubmitted', className: 'bg-warning/[12%] text-warning' },
  MORE_INFO_REQUESTED: { label: 'More Info Requested', className: 'bg-warning/[12%] text-warning' },

  // Payouts
  PAID: { label: 'Paid', className: 'bg-success/10 text-success' },

  // Categories / users
  ACTIVE: { label: 'Active', className: 'bg-success/10 text-success' },
  ARCHIVED: { label: 'Archived', className: 'bg-muted-bg text-muted-text' },
  SUSPENDED: { label: 'Suspended', className: 'bg-error/10 text-error' },

  // Collections
  DRAFT: { label: 'Draft', className: 'bg-muted-bg text-muted-text' },
  SCHEDULED: { label: 'Scheduled', className: 'bg-warning/[12%] text-warning' },
  PUBLISHED: { label: 'Published', className: 'bg-success/10 text-success' },
}

// ─── Component ────────────────────────────────────────────────────────────────

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status as string] ?? {
    label: String(status).replace(/_/g, ' '),
    className: 'bg-muted-bg text-muted-text',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center rounded',
        'text-[12px] font-[500] font-public-sans',
        'px-2 py-0.5',
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  )
}
