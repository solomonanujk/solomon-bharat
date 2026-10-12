'use client'

import Link from 'next/link'
import { AlertCircle } from 'lucide-react'
import type { ResolvedLine } from '@/lib/cartQuote'

interface CartLineNoticeProps {
  resolved: ResolvedLine
  productSlug: string
  /** Cart page passes actions; checkout shows text plus a link back to the cart. */
  onRemove?: () => void
  onSetQuantity?: (qty: number) => void
}

const ACTION_CLASS =
  'inline-flex items-center justify-center min-h-[44px] sm:min-h-[36px] px-3 rounded border border-forest text-forest text-[12.5px] font-[600] font-sans hover:bg-selected transition-colors'

/** Inline per-line explanation for a non-OK quote status — icon + text, never colour alone. */
export function CartLineNotice({ resolved, productSlug, onRemove, onSetQuantity }: CartLineNoticeProps) {
  const { status } = resolved
  if (status === 'OK' || status === 'PENDING') return null

  const productHref = `/products/${productSlug}`
  let text: string
  switch (status) {
    case 'OPTION_CHANGED':
      text = 'This option was changed by the seller — choose it again'
      break
    case 'UNAVAILABLE':
      text = 'No longer available'
      break
    case 'CHOOSE_OPTION':
      text = 'Choose an option'
      break
    case 'BELOW_MOQ':
      text = `Minimum order is ${resolved.moq ?? ''}`.trim()
      break
  }

  const removeButton = onRemove ? (
    <button type="button" onClick={onRemove} className={ACTION_CLASS}>
      Remove
    </button>
  ) : null

  return (
    <div role="alert" className="mt-3 rounded border border-error/40 bg-white px-3 py-2.5">
      <p className="flex items-start gap-2 text-[13px] font-sans text-error">
        <AlertCircle size={15} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
        <span>{text}</span>
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {(status === 'OPTION_CHANGED' || status === 'CHOOSE_OPTION') && (
          <>
            <Link href={productHref} className={ACTION_CLASS}>
              Choose option
            </Link>
            {removeButton}
          </>
        )}
        {status === 'UNAVAILABLE' && removeButton}
        {status === 'BELOW_MOQ' && resolved.moq != null && onSetQuantity && (
          <button type="button" onClick={() => onSetQuantity(resolved.moq as number)} className={ACTION_CLASS}>
            Set to {resolved.moq}
          </button>
        )}
        {!onRemove && !onSetQuantity && (
          <Link href="/cart" className={ACTION_CLASS}>
            Fix in cart
          </Link>
        )}
      </div>
    </div>
  )
}
