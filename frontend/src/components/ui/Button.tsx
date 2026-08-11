import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

export const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-button font-sans font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-1',
  {
    variants: {
      variant: {
        primary: 'bg-accent-primary text-white hover:bg-accent-primary-hover',
        ghost: 'border border-border bg-transparent text-text-primary hover:bg-fill-subtle',
        tertiary: 'bg-transparent text-text-primary hover:bg-fill-subtle',
        accent: 'bg-accent-secondary text-white hover:bg-accent-secondary-hover',
        destructive: 'bg-error text-white hover:opacity-90',
        success: 'bg-success text-white hover:opacity-90',
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        md: 'h-10 px-4 text-sm',
        lg: 'h-12 px-6 text-sm',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /**
   * Renders the single child element (e.g. a next/link `<Link>`) with the button's classes/props
   * merged onto it, instead of wrapping it in a real `<button>` — avoids an `<a>` nested inside a
   * `<button>`, which is invalid HTML and breaks keyboard/screen-reader navigation.
   */
  asChild?: boolean;
}

function composeRefs<T>(...refs: Array<React.Ref<T> | undefined>) {
  return (node: T) => {
    for (const ref of refs) {
      if (!ref) continue;
      if (typeof ref === 'function') ref(node);
      else (ref as React.MutableRefObject<T | null>).current = node;
    }
  };
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild, children, ...props }, ref) => {
    const classes = cn(buttonVariants({ variant, size }), className);

    if (asChild) {
      const child = React.Children.only(children) as React.ReactElement<{ className?: string }> & {
        ref?: React.Ref<HTMLButtonElement>;
      };
      return React.cloneElement(child, {
        ...props,
        className: cn(classes, child.props.className),
        ref: composeRefs(ref, child.ref),
      } as Partial<unknown>);
    }

    return (
      <button ref={ref} className={classes} {...props}>
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';

export { Button };
