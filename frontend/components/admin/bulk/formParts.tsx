import { cn } from '@/lib/utils'

/** Form pieces shared by the two Bulk Messages wizards (admin look: forest on white). */

export const inputCls =
  'w-full h-9 px-3 rounded-lg border border-[#D9E2DA] bg-white text-[13px] font-sans text-[#0F241D] placeholder:text-[#183D33B3] focus:outline-none focus:border-[#183D33] transition-colors disabled:bg-[#E7EDE7]/50'

export const textareaCls =
  'w-full px-3 py-2 rounded-lg border border-[#D9E2DA] bg-white text-[13px] leading-[1.5] font-sans text-[#0F241D] placeholder:text-[#183D33B3] focus:outline-none focus:border-[#183D33] transition-colors'

export function Field({
  label,
  hint,
  error,
  children,
  counter,
}: {
  label: string
  hint?: string
  error?: string | null
  children: React.ReactNode
  counter?: string
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <label className="text-[12px] font-[600] font-sans text-[#0F241D]">{label}</label>
        {counter && <span className="text-[11px] font-sans text-[#183D33B3]">{counter}</span>}
      </div>
      {children}
      {hint && !error && <p className="text-[12px] font-sans text-[#183D33B3]">{hint}</p>}
      {error && (
        <p role="alert" className="text-[12px] font-sans text-error">
          {error}
        </p>
      )}
    </div>
  )
}

export function RadioCard({
  selected,
  onSelect,
  title,
  description,
}: {
  selected: boolean
  onSelect: () => void
  title: string
  description: string
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'text-left rounded-xl border p-3.5 transition-colors',
        selected ? 'border-[#183D33] bg-[#E7EDE7]/60' : 'border-[#D9E2DA] bg-white hover:bg-[#E7EDE7]/30',
      )}
    >
      <p className="text-[13px] font-[600] font-sans text-[#0F241D]">{title}</p>
      <p className="text-[12px] font-sans text-[#183D33B3] mt-0.5">{description}</p>
    </button>
  )
}

/** Top row showing where the admin is in a wizard. */
export function Steps({ labels, current }: { labels: string[]; current: number }) {
  return (
    <div>
      <ol className="flex flex-wrap gap-x-5 gap-y-1 mb-2">
        {labels.map((label, i) => (
          <li
            key={label}
            aria-current={i === current ? 'step' : undefined}
            className={cn(
              'text-[12px] font-[600] font-sans',
              i === current ? 'text-[#0F241D]' : i < current ? 'text-[#183D33]' : 'text-[#183D33B3]/70',
            )}
          >
            {i + 1}. {label}
          </li>
        ))}
      </ol>
      <div className="h-[3px] bg-[#E7EDE7] rounded-full overflow-hidden">
        <div className="h-full bg-[#183D33] transition-all" style={{ width: `${((current + 1) / labels.length) * 100}%` }} />
      </div>
    </div>
  )
}
