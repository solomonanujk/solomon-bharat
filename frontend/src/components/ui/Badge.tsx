import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

export const badgeVariants = cva('inline-flex items-center rounded px-2 py-0.5 text-xs leading-tight font-medium font-sans', {
  variants: {
    variant: {
      default: 'bg-fill-subtle text-text-muted',
      success: 'bg-success/10 text-success',
      warning: 'bg-gold/[12%] text-gold',
      error: 'bg-error/10 text-error',
      accent: 'bg-accent-primary/10 text-accent-primary-hover',
      primary: 'bg-text-primary/[8%] text-text-primary',
      'solid-primary': 'bg-text-primary text-white',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge };
