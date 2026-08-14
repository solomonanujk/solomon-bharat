import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

export const badgeVariants = cva(
  'inline-flex items-center rounded px-2 py-0.5 text-[12px] leading-[1.3] font-[500] font-public-sans',
  {
    variants: {
      variant: {
        default:
          'bg-muted-bg text-muted-text',
        success:
          'bg-success/10 text-success',
        warning:
          'bg-warning/[12%] text-warning',
        error:
          'bg-error/10 text-error',
        accent:
          'bg-accent/10 text-accent-hover',
        primary:
          'bg-primary/[8%] text-primary',
        'solid-primary':
          'bg-primary text-white',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge }
