import * as React from 'react'
import { cn } from '@/lib/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <div className="w-full">
        <input
          ref={ref}
          className={cn(
            // Base
            'h-10 w-full rounded border border-border-warm bg-surface px-3',
            'text-[16px] font-public-sans text-primary',
            'placeholder:text-muted-text/60',
            // Focus — override browser default, use accent ring
            'outline-none focus:ring-1 focus:ring-accent focus:border-accent',
            'transition-colors',
            'disabled:cursor-not-allowed disabled:opacity-50',
            // Error state
            error && 'border-error focus:ring-error focus:border-error',
            className
          )}
          {...props}
        />
        {error && (
          <p className="mt-1 text-[12px] leading-[1.3] font-[400] font-public-sans text-error">
            {error}
          </p>
        )}
      </div>
    )
  }
)
Input.displayName = 'Input'

export { Input }
