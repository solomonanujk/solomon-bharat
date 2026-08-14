import * as React from 'react'
import { cn } from '@/lib/utils'

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {}

const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, ...props }, ref) => {
    return (
      <label
        ref={ref}
        className={cn(
          'mb-1 block text-[12px] leading-[1.3] font-[500] font-public-sans text-muted-text',
          className
        )}
        {...props}
      />
    )
  }
)
Label.displayName = 'Label'

export { Label }
