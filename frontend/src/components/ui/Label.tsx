import * as React from 'react';
import { cn } from '@/lib/utils';

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {}

const Label = React.forwardRef<HTMLLabelElement, LabelProps>(({ className, ...props }, ref) => {
  return (
    <label
      ref={ref}
      className={cn('mb-1 block text-xs leading-tight font-medium font-sans text-text-muted', className)}
      {...props}
    />
  );
});
Label.displayName = 'Label';

export { Label };
