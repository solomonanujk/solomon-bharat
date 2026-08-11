import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, error, ...props }, ref) => {
  return (
    <div className="w-full">
      <input
        ref={ref}
        className={cn(
          'h-10 w-full rounded-input border border-border bg-bg-surface px-3',
          'text-base font-sans text-text-primary',
          'placeholder:text-text-muted/60',
          'outline-none focus:ring-1 focus:ring-accent-primary focus:border-accent-primary',
          'transition-colors',
          'disabled:cursor-not-allowed disabled:opacity-50',
          error && 'border-error focus:ring-error focus:border-error',
          className
        )}
        {...props}
      />
      {error && <p className="mt-1 text-xs leading-tight font-normal font-sans text-error">{error}</p>}
    </div>
  );
});
Input.displayName = 'Input';

export { Input };
