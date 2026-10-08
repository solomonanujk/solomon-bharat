'use client'

import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Shared filter primitives for the catalogue sidebar + drawer.
 * Checkbox: 18px square, 2px corner, forest fill with a white tick when checked,
 * inside a 44px label row. Selected state is never colour-only — the tick (and
 * font weight on category rows) carries it too.
 */

export function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="py-6 border-b border-line first:pt-0 last:border-b-0 min-w-0">
      <legend className="float-left w-full mb-2 text-[14px] leading-[20px] font-[600] text-ink">{title}</legend>
      <div className="clear-left">{children}</div>
    </fieldset>
  )
}

interface FilterCheckboxProps {
  label: string
  checked: boolean
  onChange: () => void
}

export function FilterCheckbox({ label, checked, onChange }: FilterCheckboxProps) {
  return (
    <label className="flex items-center gap-3 min-h-11 cursor-pointer select-none text-[14px] leading-[20px] text-ink">
      <span className="relative flex-shrink-0 w-[18px] h-[18px]">
        <input
          type="checkbox"
          checked={checked}
          onChange={onChange}
          className="peer absolute inset-0 m-0 appearance-none rounded-[2px] border border-muted bg-white cursor-pointer checked:bg-forest checked:border-forest focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-forest"
        />
        <Check
          size={14}
          strokeWidth={3}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 m-auto text-white opacity-0 peer-checked:opacity-100"
        />
      </span>
      <span className={cn('min-w-0 break-words', checked && 'text-forest font-[600]')}>{label}</span>
    </label>
  )
}

interface FilterOptionButtonProps {
  label: string
  active: boolean
  onClick: () => void
  indent?: 0 | 1 | 2
  emphasis?: boolean
}

const INDENT = { 0: 'pl-2', 1: 'pl-6', 2: 'pl-10' } as const

/** A single-select option row (category tree). */
export function FilterOptionButton({ label, active, onClick, indent = 0, emphasis }: FilterOptionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex w-full items-center justify-between gap-2 min-h-11 lg:min-h-9 pr-2 rounded-[4px] text-left text-[14px] leading-[20px] transition-colors duration-150',
        INDENT[indent],
        active
          ? 'bg-selected text-forest font-[600]'
          : cn('text-ink hover:bg-ink/[5%]', emphasis && 'font-[600]')
      )}
    >
      <span className="min-w-0 break-words">{label}</span>
      {active && <Check size={16} aria-hidden="true" className="flex-shrink-0" />}
    </button>
  )
}

/** Underlined text-style toggle ("Show more"). */
export function FilterTextButton({ children, onClick, indent = 0 }: { children: React.ReactNode; onClick: () => void; indent?: 0 | 1 }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'min-h-11 lg:min-h-9 text-left text-[14px] leading-[20px] font-[600] text-forest underline underline-offset-4',
        indent === 1 ? 'pl-6' : 'pl-2'
      )}
    >
      {children}
    </button>
  )
}
