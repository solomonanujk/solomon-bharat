'use client'

import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export const buttonVariants = cva(
  // Base styles applied to every button. 4px radius, Hanken 14/20/600, 150ms
  // colour-only transitions, 2px focus outline with a 3px offset (white on forest
  // grounds via the on-forest variants). Disabled = line fill + muted label.
  'inline-flex items-center justify-center gap-2 rounded-[4px] border font-sans font-[600] text-[14px] leading-[20px] transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-forest disabled:pointer-events-none disabled:bg-line disabled:border-line disabled:text-muted',
  {
    variants: {
      variant: {
        /** Primary on light grounds: forest fill, white label. */
        primary:
          'bg-forest border-forest text-white hover:bg-forest-hover hover:border-forest-hover',
        /** Secondary on light grounds: white fill, forest label + border. */
        secondary:
          'bg-white border-forest text-forest hover:bg-forest/[8%]',
        /** Quiet outline for low-emphasis actions on light grounds. */
        ghost:
          'border-line bg-transparent text-ink hover:bg-ink/[8%]',
        /** Legacy alias of primary — brass is never a button fill. */
        accent:
          'bg-forest border-forest text-white hover:bg-forest-hover hover:border-forest-hover',
        /** Primary on forest grounds: white fill, forest label. */
        onForest:
          'bg-white border-white text-forest hover:bg-ivory hover:border-ivory focus-visible:outline-white',
        /** Primary on forest grounds, ivory fill (final CTA, seller hero). */
        onForestIvory:
          'bg-ivory border-ivory text-forest hover:bg-white hover:border-white focus-visible:outline-white',
        /** Secondary on forest grounds: transparent, white label + border. */
        outlineOnForest:
          'bg-transparent border-white text-white hover:bg-white/[8%] focus-visible:outline-white',
        destructive:
          'bg-error border-error text-white hover:opacity-90',
      },
      size: {
        sm: 'h-9 px-4 text-[13px]',
        md: 'h-10 px-5',
        lg: 'min-h-12 py-3 px-6',
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
  /** Keeps the button's size, swaps the label for a spinner + "Working...", and
   *  disables it so repeat submits are blocked. */
  loading?: boolean
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
  ({ className, variant, size, asChild, loading, disabled, children, ...props }, ref) => {
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
      <button ref={ref} className={classes} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
        {loading ? (
          <>
            <Loader2 size={16} className="animate-spin" aria-hidden="true" />
            Working...
          </>
        ) : (
          children
        )}
      </button>
    )
  }
)
Button.displayName = 'Button'

export { Button }
