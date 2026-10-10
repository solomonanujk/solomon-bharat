'use client'

// ─── Shared styling for the "Apply to sell your product" wizard ───────────────
// Uses the site's real design tokens (primary, accent, border-warm, muted-bg,
// muted-text) — no one-off colors.

export const APPLY_INPUT_CLS =
  'w-full h-11 px-3.5 rounded-lg border border-border-warm bg-surface text-[14px] font-sans text-primary placeholder:text-muted-text/50 focus:outline-none focus:border-accent transition-colors disabled:opacity-50'

export const APPLY_TEXTAREA_CLS =
  'w-full px-3.5 py-2.5 rounded-lg border border-border-warm bg-surface text-[14px] font-sans text-primary placeholder:text-muted-text/50 focus:outline-none focus:border-accent transition-colors resize-none disabled:opacity-50'

export const APPLY_SELECT_CLS =
  'w-full h-11 px-3.5 rounded-lg border border-border-warm bg-surface text-[14px] font-sans text-primary focus:outline-none focus:border-accent transition-colors disabled:opacity-50'

export const APPLY_LABEL_CLS = 'block text-[13.5px] font-[600] font-sans text-primary mb-1.5'

export function RequiredMark() {
  return <span className="text-error ml-0.5">*</span>
}

/** A radio/checkbox-style pill — dot + label, filled/accent when selected. Used
 *  for every single- and multi-select choice field in this wizard (Yes/No,
 *  category tags, platform tags, GST status, etc.) — same selected/unselected
 *  convention as the seller portal's choice buttons (ProductForm.tsx). */
export function ChoicePill({
  label,
  selected,
  onClick,
  disabled,
}: {
  label: string
  selected: boolean
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={`inline-flex items-center gap-2 h-10 px-4 rounded-full border text-[13.5px] font-[500] font-sans transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
        selected ? 'bg-forest border-primary text-white' : 'bg-surface border-border-warm text-primary hover:border-primary'
      }`}
    >
      <span
        className={`w-2 h-2 rounded-full flex-shrink-0 ${selected ? 'bg-white' : 'bg-border-warm'}`}
        aria-hidden="true"
      />
      {label}
    </button>
  )
}

export function StepField({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div>
      <label className={APPLY_LABEL_CLS}>
        {label}
        {required && <RequiredMark />}
      </label>
      {children}
    </div>
  )
}

/** 48px variants for the marketplace path. */
export const APPLY_INPUT_LG_CLS = APPLY_INPUT_CLS.replace('h-11', 'h-12')
export const APPLY_SELECT_LG_CLS = APPLY_SELECT_CLS.replace('h-11', 'h-12')

/** aria props linking an input to its hint and error text (ids `${id}-hint` / `${id}-error`). */
export function fieldA11y(id: string, error?: string, hint?: string) {
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(' ')
  return {
    id,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': describedBy || undefined,
  } as const
}

export function FormField({
  id,
  label,
  required,
  error,
  hint,
  children,
}: {
  id: string
  label: string
  required?: boolean
  error?: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label htmlFor={id} className={APPLY_LABEL_CLS}>
        {label}
        {required && <RequiredMark />}
      </label>
      {children}
      {hint && (
        <p id={`${id}-hint`} className="font-sans text-[12.5px] leading-[1.5] text-muted-text mt-1.5">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="font-sans text-[13px] leading-[1.4] text-error mt-1.5 flex items-start gap-1.5">
          <span aria-hidden="true" className="font-[700]">!</span>
          <span>{error}</span>
        </p>
      )}
    </div>
  )
}

export function StepHeader({ step, title, subtitle }: { step: number; title: string; subtitle: string }) {
  return (
    <div className="mb-7">
      <p className="text-[11px] font-[700] font-sans uppercase tracking-[0.1em] mb-2 text-accent">
        Step {step} of 4
      </p>
      <h2 className="font-display font-[700] text-primary text-[26px] leading-tight">{title}</h2>
      <p className="font-sans text-[13.5px] text-muted-text mt-1">{subtitle}</p>
    </div>
  )
}
