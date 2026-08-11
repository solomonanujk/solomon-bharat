'use client';

import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DialogContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const DialogContext = React.createContext<DialogContextValue>({
  open: false,
  setOpen: () => {},
});

interface DialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function Dialog({ open: controlledOpen, onOpenChange, defaultOpen = false, children }: DialogProps) {
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

  return <DialogContext.Provider value={{ open, setOpen }}>{children}</DialogContext.Provider>;
}

interface DialogTriggerProps {
  children: React.ReactElement<React.HTMLAttributes<HTMLElement>>;
  asChild?: boolean;
}

function DialogTrigger({ children }: DialogTriggerProps) {
  const { setOpen } = React.useContext(DialogContext);
  return React.cloneElement(children, {
    onClick: (e: React.MouseEvent<HTMLElement>) => {
      children.props.onClick?.(e);
      setOpen(true);
    },
  });
}

interface DialogContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  showClose?: boolean;
}

function DialogContent({ children, className, showClose = true, ...props }: DialogContentProps) {
  const { open, setOpen } = React.useContext(DialogContext);

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-text-primary/20 backdrop-blur-[12px] z-50"
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
          'bg-bg-surface rounded-modal border border-border',
          'shadow-[0_4px_20px_rgba(26,26,26,0.04)]',
          'z-50 max-w-[800px] w-full mx-4',
          'max-h-[90vh] overflow-y-auto',
          className
        )}
        {...props}
      >
        {showClose && (
          <DialogClose className="absolute right-4 top-4 text-text-muted hover:text-text-primary transition-colors">
            <X size={18} aria-hidden="true" />
            <span className="sr-only">Close</span>
          </DialogClose>
        )}
        {children}
      </div>
    </>
  );
}

interface DialogCloseProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

function DialogClose({ className, children, onClick, ...props }: DialogCloseProps) {
  const { setOpen } = React.useContext(DialogContext);
  return (
    <button
      type="button"
      className={cn('inline-flex items-center justify-center', className)}
      onClick={(e) => {
        onClick?.(e);
        setOpen(false);
      }}
      {...props}
    >
      {children}
    </button>
  );
}

function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col gap-1.5 px-6 pt-6 pb-4', className)} {...props} />;
}

function DialogTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2 className={cn('text-h4 font-medium font-serif text-text-primary', className)} {...props} />
  );
}

function DialogDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn('text-sm leading-snug font-normal font-sans text-text-muted', className)} {...props} />
  );
}

function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('flex items-center justify-end gap-3 px-6 py-4 border-t border-border', className)} {...props} />
  );
}

export { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose, DialogFooter, DialogTrigger };
