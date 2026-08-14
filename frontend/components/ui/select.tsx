'use client'

import * as React from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Context ──────────────────────────────────────────────────────────────────

interface SelectContextValue {
  open: boolean
  setOpen: (open: boolean) => void
  value: string
  setValue: (value: string) => void
  displayValue: string
  setDisplayValue: (label: string) => void
  placeholder: string
}

const SelectContext = React.createContext<SelectContextValue>({
  open: false,
  setOpen: () => {},
  value: '',
  setValue: () => {},
  displayValue: '',
  setDisplayValue: () => {},
  placeholder: 'Select...',
})

// ─── Root ─────────────────────────────────────────────────────────────────────

interface SelectProps {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  placeholder?: string
  children: React.ReactNode
}

function Select({
  value: controlledValue,
  defaultValue = '',
  onValueChange,
  placeholder = 'Select...',
  children,
}: SelectProps) {
  const [open, setOpen] = React.useState(false)
  const [internalValue, setInternalValue] = React.useState(defaultValue)
  const [displayValue, setDisplayValue] = React.useState('')

  const isControlled = controlledValue !== undefined
  const value = isControlled ? controlledValue : internalValue

  const setValue = React.useCallback(
    (val: string) => {
      if (!isControlled) setInternalValue(val)
      onValueChange?.(val)
      setOpen(false)
    },
    [isControlled, onValueChange]
  )

  // Close on outside click
  const containerRef = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <SelectContext.Provider value={{ open, setOpen, value, setValue, displayValue, setDisplayValue, placeholder }}>
      <div ref={containerRef} className="relative w-full">
        {children}
      </div>
    </SelectContext.Provider>
  )
}

// ─── Value Display ────────────────────────────────────────────────────────────

function SelectValue({ placeholder }: { placeholder?: string }) {
  const ctx = React.useContext(SelectContext)
  const label = ctx.displayValue || placeholder || ctx.placeholder
  return (
    <span className={ctx.value ? 'text-primary' : 'text-muted-text/60'}>
      {ctx.value ? ctx.displayValue || ctx.value : label}
    </span>
  )
}

// ─── Trigger ──────────────────────────────────────────────────────────────────

interface SelectTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

function SelectTrigger({ className, children, ...props }: SelectTriggerProps) {
  const { open, setOpen } = React.useContext(SelectContext)

  return (
    <button
      type="button"
      aria-expanded={open}
      aria-haspopup="listbox"
      onClick={() => setOpen(!open)}
      className={cn(
        'h-10 w-full px-3 border border-border-warm rounded bg-surface',
        'text-[14px] font-public-sans text-primary',
        'flex items-center justify-between cursor-pointer',
        'hover:border-primary/30 transition-colors',
        'focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    >
      {children}
      <ChevronDown
        size={16}
        className={cn('text-muted-text ml-2 flex-shrink-0 transition-transform duration-200', open && 'rotate-180')}
        aria-hidden="true"
      />
    </button>
  )
}

// ─── Content (Dropdown) ───────────────────────────────────────────────────────

interface SelectContentProps extends React.HTMLAttributes<HTMLDivElement> {}

function SelectContent({ className, children, ...props }: SelectContentProps) {
  const { open } = React.useContext(SelectContext)

  if (!open) return null

  return (
    <div
      role="listbox"
      className={cn(
        'absolute mt-1 bg-surface border border-border-warm rounded',
        'shadow-[0_4px_20px_rgba(26,26,26,0.04)] z-10 min-w-full',
        'max-h-60 overflow-y-auto',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

// ─── Item ─────────────────────────────────────────────────────────────────────

interface SelectItemProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string
}

function SelectItem({ value, className, children, ...props }: SelectItemProps) {
  const ctx = React.useContext(SelectContext)
  const isSelected = ctx.value === value

  const handleClick = () => {
    ctx.setDisplayValue(typeof children === 'string' ? children : value)
    ctx.setValue(value)
  }

  return (
    <div
      role="option"
      aria-selected={isSelected}
      onClick={handleClick}
      className={cn(
        'px-3 py-2 text-[14px] font-public-sans text-primary cursor-pointer',
        'flex items-center justify-between',
        'hover:bg-muted-bg transition-colors',
        isSelected && 'bg-muted-bg font-[600]',
        className
      )}
      {...props}
    >
      {children}
      {isSelected && <Check size={14} className="text-accent ml-2 flex-shrink-0" aria-hidden="true" />}
    </div>
  )
}

export { Select, SelectTrigger, SelectContent, SelectItem, SelectValue }
