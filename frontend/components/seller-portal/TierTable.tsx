'use client'

import { useState } from 'react'
import { AlertCircle, Plus, Trash2 } from 'lucide-react'
import type { LadderEvaluation, TierField, TierRow } from '@/components/seller-portal/productPricing'

const CELL_INPUT =
  'w-full h-11 px-3 rounded border bg-surface text-[14px] font-sans text-ink placeholder:text-muted-text/50 focus:outline-none focus-visible:border-forest focus-visible:ring-2 focus-visible:ring-forest/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed read-only:bg-muted-bg/40'

interface TierTableProps {
  /** Unique per table on the page; prefixes input/error ids. */
  idPrefix: string
  /** Names the table for assistive tech, e.g. "Volume pricing" or "Volume pricing for Red / Large". */
  ariaLabel: string
  rows: TierRow[]
  evaluation: LadderEvaluation
  /** Header for the price column (differs by seller type). */
  priceHeader: string
  onAdd: () => void
  onRemove: (id: string) => void
  onUpdate: (id: string, field: TierField, value: string) => void
  /** Show every error now (after a failed submit), not just on fields the user has touched. */
  showAllErrors: boolean
  /** Admin-create: also show the Buyer Price and Agent Price columns. */
  showAdminPricing?: boolean
  /** Locked by a pending pricing review: values stay visible, nothing can be changed. */
  disabled?: boolean
  /** Read-only view: values visible, no editing and no add/remove. */
  readOnly?: boolean
  /** Optional cap on the number of tiers; Add is disabled at the cap. */
  maxTiers?: number
  onApplyToAll?: () => void
}

export function TierTable({
  idPrefix, ariaLabel, rows, evaluation, priceHeader, onAdd, onRemove, onUpdate, showAllErrors,
  showAdminPricing, disabled, readOnly, maxTiers, onApplyToAll,
}: TierTableProps) {
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const locked = !!disabled || !!readOnly
  const atCap = maxTiers !== undefined && rows.length >= maxTiers

  function touch(id: string, field: TierField) {
    setTouched((t) => (t[`${id}:${field}`] ? t : { ...t, [`${id}:${field}`]: true }))
  }
  function errorFor(row: TierRow, field: TierField): string | undefined {
    const msg = evaluation.rowErrors[row.id]?.[field]
    return msg && (showAllErrors || touched[`${row.id}:${field}`]) ? msg : undefined
  }

  function cell(row: TierRow, index: number, field: TierField, props: { step?: string; placeholder: string; label: string; prefix?: boolean }) {
    const inputId = `${idPrefix}-${row.id}-${field}`
    const err = errorFor(row, field)
    return (
      <td className="px-3 pt-2 pb-0 align-top">
        <div className="relative">
          {props.prefix && (
            <span aria-hidden="true" className="absolute left-3 top-[13px] text-muted-text text-[14px]">&#8377;</span>
          )}
          <input
            id={inputId}
            type="number"
            inputMode={field === 'moq' ? 'numeric' : 'decimal'}
            min={field === 'moq' ? 1 : 0}
            step={field === 'moq' ? 1 : '0.01'}
            value={row[field]}
            disabled={disabled}
            readOnly={readOnly}
            placeholder={props.placeholder}
            aria-label={`Tier ${index + 1} ${props.label}`}
            aria-invalid={err ? true : undefined}
            aria-describedby={err ? `${inputId}-err` : undefined}
            onChange={(e) => onUpdate(row.id, field, e.target.value)}
            onBlur={() => touch(row.id, field)}
            className={`${CELL_INPUT} ${props.prefix ? 'pl-7' : ''} ${err ? 'border-error' : 'border-border-warm'}`}
          />
        </div>
        {/* Fixed-height slot: an error appearing never shifts the rows below it. */}
        <div className="min-h-[34px] pt-1">
          {err && (
            <p id={`${inputId}-err`} role="alert" className="flex items-start gap-1 text-[12px] leading-[16px] font-sans text-error">
              <AlertCircle size={12} aria-hidden="true" className="flex-shrink-0 mt-[2px]" />
              <span>{err}</span>
            </p>
          )}
        </div>
      </td>
    )
  }

  const ladderMessage = showAllErrors ? evaluation.message : undefined

  return (
    <div>
      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full text-[13px] font-sans" aria-label={ariaLabel}>
          <thead>
            <tr className="bg-muted-bg/40 border-b border-line">
              <th scope="col" className="text-left py-2.5 px-3 font-[600] text-muted-text whitespace-nowrap min-w-[140px]">Min order qty</th>
              <th scope="col" className="text-left py-2.5 px-3 font-[600] text-muted-text whitespace-nowrap min-w-[190px]">{priceHeader}</th>
              {showAdminPricing && (
                <>
                  <th scope="col" className="text-left py-2.5 px-3 font-[600] text-muted-text whitespace-nowrap min-w-[160px]">Buyer Price (&#8377;)</th>
                  <th scope="col" className="text-left py-2.5 px-3 font-[600] text-muted-text whitespace-nowrap min-w-[160px]">Agent Price (&#8377;)</th>
                </>
              )}
              <th scope="col" className="py-2.5 px-2 w-[60px]"><span className="sr-only">Remove tier</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((row, i) => (
              <tr key={row.id}>
                {cell(row, i, 'moq', { placeholder: 'e.g. 50', label: 'minimum order quantity' })}
                {cell(row, i, 'sellerPrice', { placeholder: 'e.g. 400', label: 'price per unit', prefix: true })}
                {showAdminPricing && cell(row, i, 'adminPrice', { placeholder: 'e.g. 550', label: 'buyer price', prefix: true })}
                {showAdminPricing && cell(row, i, 'agentPrice', { placeholder: 'e.g. 480', label: 'agent price', prefix: true })}
                <td className="px-2 pt-2 pb-0 align-top text-center">
                  {!locked && (
                    <button
                      type="button"
                      onClick={() => onRemove(row.id)}
                      aria-label={`Remove tier ${i + 1}`}
                      className="w-11 h-11 rounded text-muted-text hover:text-error focus:outline-none focus-visible:ring-2 focus-visible:ring-forest/40 transition-colors inline-flex items-center justify-center"
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Reserved line for ladder-level messages and non-blocking notes. */}
      <div className="min-h-[20px] mt-2 space-y-1" aria-live="polite">
        {ladderMessage && (
          <p role="alert" className="flex items-center gap-1.5 text-[12px] font-sans text-error">
            <AlertCircle size={12} aria-hidden="true" className="flex-shrink-0" />{ladderMessage}
          </p>
        )}
        {evaluation.warnings.map((w) => (
          <p key={w} className="text-[12px] font-sans text-muted-text">{w}</p>
        ))}
      </div>

      {!locked && (
        <div className="flex flex-wrap items-center gap-3 mt-1">
          <button
            type="button"
            onClick={onAdd}
            disabled={atCap}
            className="inline-flex items-center gap-1.5 h-11 px-4 rounded border border-border-warm text-[13px] font-[600] font-sans text-ink hover:border-forest focus:outline-none focus-visible:ring-2 focus-visible:ring-forest/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus size={14} aria-hidden="true" />Add price tier
          </button>
          {onApplyToAll && (
            <button
              type="button"
              onClick={onApplyToAll}
              className="h-11 px-4 rounded border border-border-warm text-[13px] font-[600] font-sans text-ink hover:border-forest focus:outline-none focus-visible:ring-2 focus-visible:ring-forest/40 transition-colors"
            >
              Apply these tiers to all options
            </button>
          )}
          {atCap && <span className="text-[12px] font-sans text-muted-text">Up to {maxTiers} tiers.</span>}
        </div>
      )}
    </div>
  )
}
