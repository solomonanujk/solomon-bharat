'use client';

import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SheetContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const SheetContext = React.createContext<SheetContextValue>({
  open: false,
  setOpen: () => {},
});

interface SheetProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function Sheet({ open: controlledOpen, onOpenChange, defaultOpen = false, children }: SheetProps) {
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen);

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;

  const setOpen = React.useCallback(
    (value: boolean) => {
      if (!isControlled) setInternalOpen(value);
      onOpenChange?.(value);
    },
    [isControlled, onOpenChange]
  );

  React.useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, setOpen]);

  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  return <SheetContext.Provider value={{ open, setOpen }}>{children}</SheetContext.Provider>;
}

interface SheetTriggerProps {
  children: React.ReactElement<React.HTMLAttributes<HTMLElement>>;
}

function SheetTrigger({ children }: SheetTriggerProps) {
  const { setOpen } = React.useContext(SheetContext);
  return React.cloneElement(children, {
    onClick: (e: React.MouseEvent<HTMLElement>) => {
      children.props.onClick?.(e);
      setOpen(true);
    },
  });
}

interface SheetContentProps extends React.HTMLAttributes<HTMLDivElement> {
  side?: 'right' | 'bottom';
  children: React.ReactNode;
}

function SheetContent({ side = 'right', children, className, ...props }: SheetContentProps) {
  const { open, setOpen } = React.useContext(SheetContext);

  return (
    <>
      <div
        className={cn(
          'fixed inset-0 bg-text-primary/20 z-40 transition-opacity duration-300',
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />

      {side === 'right' ? (
        <div
          role="dialog"
          aria-modal="true"
          className={cn(
            'fixed right-0 top-0 h-full w-[480px] max-w-[95vw]',
            'bg-bg-surface border-l border-border z-50',
            'transform transition-transform duration-300 ease-out',
            open ? 'translate-x-0' : 'translate-x-full',
            className
          )}
          {...props}
        >
          {children}
        </div>
      ) : (
        <div
          role="dialog"
          aria-modal="true"
          className={cn(
            'fixed bottom-0 left-0 right-0',
            'bg-bg-surface border-t border-border z-50 rounded-t',
            'max-h-[85vh] overflow-y-auto',
            'transform transition-transform duration-300 ease-out',
            open ? 'translate-y-0' : 'translate-y-full',
            className
          )}
          {...props}
        >
          {children}
        </div>
      )}
    </>
  );
}

interface SheetCloseProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

function SheetClose({ className, children, onClick, ...props }: SheetCloseProps) {
  const { setOpen } = React.useContext(SheetContext);
  return (
    <button
      type="button"
      className={cn('inline-flex items-center justify-center text-text-muted hover:text-text-primary transition-colors', className)}
      onClick={(e) => {
        onClick?.(e);
        setOpen(false);
      }}
      {...props}
    >
      {children ?? <X size={18} aria-hidden="true" />}
    </button>
  );
}

function SheetHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex items-center justify-between px-6 py-4 border-b border-border', className)} {...props} />;
}

function SheetTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn('text-h4 font-medium font-serif text-text-primary', className)} {...props} />;
}

export { Sheet, SheetContent, SheetHeader, SheetTitle, SheetClose, SheetTrigger };
