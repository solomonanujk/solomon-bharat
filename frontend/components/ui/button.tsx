import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

export const buttonVariants = cva(
  // Base styles applied to every button
  'inline-flex items-center justify-center rounded font-public-sans font-[600] transition-colors disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1',
  {
    variants: {
      variant: {
        primary:
          'bg-primary text-white hover:bg-primary/90',
        ghost:
          'border border-border-warm bg-transparent text-primary hover:bg-muted-bg',
        accent:
          'bg-accent text-white hover:bg-accent-hover',
        destructive:
          'bg-error text-white hover:opacity-90',
      },
      size: {
        sm: 'h-8 px-3 text-[12px]',
        md: 'h-10 px-4 text-[14px]',
        lg: 'h-12 px-6 text-[14px]',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  // When true, renders the single child element (e.g. a next/link `<Link>`)
  // with the button's classes/props merged onto it, instead of wrapping it in
  // a real <button> — avoids an <a> nested inside a <button>, which is
  // invalid HTML and breaks keyboard/screen-reader navigation.
  asChild?: boolean
}

function composeRefs<T>(...refs: Array<React.Ref<T> | undefined>) {
  return (node: T) => {
    for (const ref of refs) {
      if (!ref) continue
      if (typeof ref === 'function') ref(node)
      else (ref as React.MutableRefObject<T | null>).current = node
    }
  }
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild, children, ...props }, ref) => {
    const classes = cn(buttonVariants({ variant, size }), className)

    if (asChild) {
      const child = React.Children.only(children) as React.ReactElement<{ className?: string }> & {
        ref?: React.Ref<HTMLButtonElement>
      }
      return React.cloneElement(child, {
        ...props,
        className: cn(classes, child.props.className),
        ref: composeRefs(ref, child.ref),
      } as Partial<unknown>)
    }

    return (
      <button ref={ref} className={classes} {...props}>
        {children}
      </button>
    )
  }
)
Button.displayName = 'Button'

export { Button }
