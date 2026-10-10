'use client'

import { AlertCircle, CheckCircle2 } from 'lucide-react'
import { useFormatPrice } from '@/components/ui/Price'
import type { CartGroup } from '@/types/brand-orders'

/**
 * Minimum-order progress for one brand group. Conveys state with an icon and text,
 * not colour alone. The server re-checks at checkout; this is a convenience.
 */
export function BrandMinOrderNotice({ group }: { group: CartGroup }) {
  const fmt = useFormatPrice()
  if (!group.brand || group.minOrderValueInr <= 0) return null
  const met = group.shortfallInr <= 0
  const pct = Math.min(100, Math.round((group.subtotalInr / group.minOrderValueInr) * 100))

  return (
    <div role="status" className="mt-3 rounded border border-line bg-ivory px-3 py-2.5">
      <p className="flex items-start gap-2 text-[13px] font-sans text-ink">
        {met ? (
          <CheckCircle2 size={15} className="mt-0.5 flex-shrink-0 text-forest" aria-hidden="true" />
        ) : (
          <AlertCircle size={15} className="mt-0.5 flex-shrink-0 text-error" aria-hidden="true" />
        )}
        <span>
          {met
            ? `You've met ${group.brand.name}'s minimum order of ${fmt(group.minOrderValueInr)}.`
            : `Add ${fmt(group.shortfallInr)} more to meet ${group.brand.name}'s minimum order of ${fmt(group.minOrderValueInr)}.`}
        </span>
      </p>
      <div
        className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-line"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label={`Progress toward ${group.brand.name}'s minimum order`}
      >
        <div className={`h-full ${met ? 'bg-forest' : 'bg-brass-deep'}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

/** Sentence listing every unmet brand — used to explain a disabled checkout button. */
export function useUnmetMessage(unmet: CartGroup[]): string | null {
  const fmt = useFormatPrice()
  if (unmet.length === 0) return null
  return `Minimum order not met: ${unmet
    .map((g) => `${g.brand?.name} (add ${fmt(g.shortfallInr)} more)`)
    .join('; ')}.`
}
