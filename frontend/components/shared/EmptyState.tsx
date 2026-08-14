import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

// ─── Types ────────────────────────────────────────────────────────────────────

interface EmptyStateProps {
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
  className?: string
}

// ─── Illustration ─────────────────────────────────────────────────────────────

function EmptyIllustration() {
  return (
    <svg
      width="64"
      height="64"
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Box outline */}
      <rect
        x="12"
        y="16"
        width="40"
        height="34"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Box lid flap */}
      <path
        d="M12 24 L32 29 L52 24"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Lines below suggesting content */}
      <line
        x1="20"
        y1="36"
        x2="44"
        y2="36"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <line
        x1="20"
        y1="41"
        x2="38"
        y2="41"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <line
        x1="20"
        y1="46"
        x2="30"
        y2="46"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export function EmptyState({ title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center py-16 px-4',
        className
      )}
    >
      <span className="text-border-warm">
        <EmptyIllustration />
      </span>

      <p className="mt-4 text-[16px] font-[600] font-public-sans text-primary">
        {title}
      </p>

      {description && (
        <p className="mt-1 text-[14px] font-public-sans text-muted-text max-w-[320px]">
          {description}
        </p>
      )}

      {action && (
        <Button
          variant="primary"
          className="mt-4"
          onClick={action.onClick}
        >
          {action.label}
        </Button>
      )}
    </div>
  )
}
