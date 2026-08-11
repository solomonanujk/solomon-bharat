const STATUS_CLASSES: Record<string, string> = {
  APPROVED: 'bg-success/10 text-success',
  REJECTED: 'bg-error/10 text-error',
  PENDING: 'bg-gold/10 text-gold',
  RESUBMITTED: 'bg-accent-secondary/10 text-accent-secondary',
};

const STATUS_LABELS: Record<string, string> = {
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  PENDING: 'Pending Review',
  RESUBMITTED: 'Resubmitted',
};

export interface ApprovalStatusBadgeProps {
  readonly status: string;
}

export function ApprovalStatusBadge({ status }: ApprovalStatusBadgeProps) {
  return (
    <span className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${STATUS_CLASSES[status] ?? ''}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}
