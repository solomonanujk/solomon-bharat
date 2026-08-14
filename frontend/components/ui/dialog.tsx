'use client'

import * as React from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Context ──────────────────────────────────────────────────────────────────

interface DialogContextValue {
  open: boolean
  setOpen: (open: boolean) => void
}

const DialogContext = React.createContext<DialogContextValue>({
  open: false,
  setOpen: () => {},
})

// ─── Root ─────────────────────────────────────────────────────────────────────

interface DialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  defaultOpen?: boolean
  children: React.ReactNode
}

function Dialog({ open: controlledOpen, onOpenChange, defaultOpen = false, children }: DialogProps) {
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen)

  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : internalOpen

  const setOpen = React.useCallback(
    (value: boolean) => {
      if (!isControlled) setInternalOpen(value)
      onOpenChange?.(value)
    },
    [isControlled, onOpenChange]
  )

  // Close on Escape
  React.useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, setOpen])

  // Prevent body scroll when open
  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  return (
    <DialogContext.Provider value={{ open, setOpen }}>
      {children}
    </DialogContext.Provider>
  )
}

// ─── Trigger ──────────────────────────────────────────────────────────────────

interface DialogTriggerProps {
  children: React.ReactElement<React.HTMLAttributes<HTMLElement>>
  asChild?: boolean
}

function DialogTrigger({ children }: DialogTriggerProps) {
  const { setOpen } = React.useContext(DialogContext)
  return React.cloneElement(children, {
    onClick: (e: React.MouseEvent<HTMLElement>) => {
      children.props.onClick?.(e)
      setOpen(true)
    },
  })
}

// ─── Portal / Content ─────────────────────────────────────────────────────────

interface DialogContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  showClose?: boolean
}

function DialogContent({ children, className, showClose = true, ...props }: DialogContentProps) {
  const { open, setOpen } = React.useContext(DialogContext)

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-primary/20 backdrop-blur-[12px] z-50"
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />
      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
          'bg-surface rounded border border-border-warm',
          'shadow-[0_4px_20px_rgba(26,26,26,0.04)]',
          'z-50 max-w-[800px] w-full mx-4',
          'max-h-[90vh] overflow-y-auto',
          className
        )}
        {...props}
      >
        {showClose && (
          <DialogClose className="absolute right-4 top-4 text-muted-text hover:text-primary transition-colors">
            <X size={18} aria-hidden="true" />
            <span className="sr-only">Close</span>
          </DialogClose>
        )}
        {children}
      </div>
    </>
  )
}

// ─── Close ────────────────────────────────────────────────────────────────────

interface DialogCloseProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

function DialogClose({ className, children, onClick, ...props }: DialogCloseProps) {
  const { setOpen } = React.useContext(DialogContext)
  return (
    <button
      type="button"
      className={cn('inline-flex items-center justify-center', className)}
      onClick={(e) => {
        onClick?.(e)
        setOpen(false)
      }}
      {...props}
    >
      {children}
    </button>
  )
}

// ─── Header ───────────────────────────────────────────────────────────────────

function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex flex-col gap-1.5 px-6 pt-6 pb-4', className)}
      {...props}
    />
  )
}

// ─── Title ────────────────────────────────────────────────────────────────────

function DialogTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn(
        'text-[24px] leading-[1.3] font-[500] font-playfair text-primary',
        className
      )}
      {...props}
    />
  )
}

// ─── Description ──────────────────────────────────────────────────────────────

function DialogDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn(
        'text-[14px] leading-[1.4] font-[400] font-public-sans text-muted-text',
        className
      )}
      {...props}
    />
  )
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'flex items-center justify-end gap-3 px-6 py-4 border-t border-border-warm',
        className
      )}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
  DialogFooter,
  DialogTrigger,
}
