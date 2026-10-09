'use client'

import { useId, useState } from 'react'
import { AlertCircle, Plus, Trash2 } from 'lucide-react'
import { formatINR } from '@/lib/utils'

/** Matches the backend cap on a brand's price ladder. */
export const MAX_PRICE_TIERS = 5

/** One row of a price ladder, kept as raw input strings while the brand types. */
export interface TierRow {
  moq: string
  price: string
}

export interface TierRowErrors {
  moq?: string
  price?: string
}

export interface PayloadTier {
  moq: number
  sellerPrice: number
}

function num(value: string): number {
  return value.trim() === '' ? NaN : Number(value)
}

/**
 * Same rules the backend enforces for a marketplace brand's ladder: whole-number quantities
 * strictly increasing, positive prices that never rise as quantity rises, and the first tier
 * pinned to the product MOQ (the caller passes `minQty`; row 0's quantity is ignored).
 */
export function validateTiers(rows: TierRow[], minQty: number): TierRowErrors[] {
  return rows.map((row, i) => {
    const errors: TierRowErrors = {}
    const price = num(row.price)
    if (!(price > 0)) errors.price = 'Enter a price greater than 0.'

    if (i === 0) return errors

    const moq = num(row.moq)
    if (!Number.isInteger(moq) || moq < 1) {
      errors.moq = 'Enter a whole number of units.'
    } else {
      const prevMoq = i === 1 ? minQty : num(rows[i - 1].moq)
      if (Number.isFinite(prevMoq) && moq <= prevMoq) errors.moq = `Must be more than ${prevMoq}.`
    }

    const prevPrice = num(rows[i - 1].price)
    if (!errors.price && prevPrice > 0 && price > prevPrice) {
      errors.price = `Can't be higher than the tier before (${formatINR(prevPrice)}).`
    }
    return errors
  })
}

export function hasTierErrors(errors: TierRowErrors[]): boolean {
  return errors.some((e) => e.moq || e.price)
}

/** The ladder as the backend expects it; the first tier always starts at the product MOQ. */
export function tiersToPayload(rows: TierRow[], minQty: number): PayloadTier[] {
  return rows.map((row, i) => ({ moq: i === 0 ? minQty : Number(row.moq), sellerPrice: Number(row.price) }))
}

/** Cheapest unit price in a ladder (used as the product's "from" price). */
export function cheapestTierPrice(rows: TierRow[]): number | null {
  const prices = rows.map((r) => num(r.price)).filter((p) => p > 0)
  return prices.length > 0 ? Math.min(...prices) : null
}

function previewLine(rows: TierRow[], i: number, minQty: number): string | null {
  const price = num(rows[i].price)
  const from = i === 0 ? minQty : num(rows[i].moq)
  if (!(price > 0) || !Number.isInteger(from) || from < 1) return null
  const next = rows[i + 1] ? num(rows[i + 1].moq) : NaN
  if (Number.isInteger(next) && next > from) {
    const to = next - 1
    return to === from
      ? `${from} unit${from === 1 ? '' : 's'}: ${formatINR(price)} each`
      : `${from}–${to} units: ${formatINR(price)} each`
  }
  return `${from}+ units: ${formatINR(price)} each`
}

const FIELD_CLS =
  'w-full h-12 px-3 rounded border bg-surface text-[14px] font-sans text-primary focus:outline-none focus:border-forest focus:ring-2 focus:ring-forest/20 disabled:opacity-50 disabled:cursor-not-allowed'

interface TierPriceEditorProps {
  /** Shown above the rows, e.g. the option name. */
  label?: string
  rows: TierRow[]
  /** Product MOQ — locks the first tier's quantity. */
  minQty: number
  onChange: (rows: TierRow[]) => void
  /** Show every error now (e.g. after a failed submit), not just on touched fields. */
  showAllErrors?: boolean
  disabled?: boolean
  /** When set, offers a button that copies this ladder onto every other option. */
  onApplyToAll?: () => void
}

export function TierPriceEditor({ label, rows, minQty, onChange, showAllErrors, disabled, onApplyToAll }: TierPriceEditorProps) {
  const uid = useId()
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const errors = validateTiers(rows, minQty)

  function touch(key: string) {
    setTouched((t) => (t[key] ? t : { ...t, [key]: true }))
  }
  function update(i: number, patch: Partial<TierRow>) {
    onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  }
  function addRow() {
    if (rows.length >= MAX_PRICE_TIERS) return
    const last = rows[rows.length - 1]
    const lastQty = rows.length === 1 ? minQty : num(last.moq)
    onChange([...rows, { moq: Number.isFinite(lastQty) ? String(lastQty + 1) : '', price: last.price }])
  }
  function removeRow(i: number) {
    onChange(rows.filter((_, idx) => idx !== i))
  }

  return (
    <fieldset className="min-w-0" disabled={disabled}>
      {label && <legend className="text-[14px] font-[600] font-sans text-primary mb-2">{label}</legend>}

      <div className="space-y-3">
        {rows.map((row, i) => {
          const moqId = `${uid}-moq-${i}`
          const priceId = `${uid}-price-${i}`
          const moqErr = (showAllErrors || touched[`moq-${i}`]) && errors[i].moq ? errors[i].moq : undefined
          const priceErr = (showAllErrors || touched[`price-${i}`]) && errors[i].price ? errors[i].price : undefined
          const preview = previewLine(rows, i, minQty)
          return (
            <div key={i} className="rounded-lg border border-border-warm p-3">
              <div className="flex flex-wrap items-start gap-3">
                <div className="w-[140px] max-sm:flex-1">
                  <label htmlFor={moqId} className="block text-[12px] font-[600] font-sans text-muted-text mb-1">
                    From quantity
                  </label>
                  <input
                    id={moqId}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    step={1}
                    value={i === 0 ? String(minQty) : row.moq}
                    readOnly={i === 0}
                    aria-readonly={i === 0}
                    aria-invalid={!!moqErr}
                    aria-describedby={moqErr ? `${moqId}-err` : undefined}
                    onChange={(e) => update(i, { moq: e.target.value })}
                    onBlur={() => touch(`moq-${i}`)}
                    className={`${FIELD_CLS} ${moqErr ? 'border-error' : 'border-border-warm'} ${i === 0 ? 'bg-muted-bg/40' : ''}`}
                  />
                  {i === 0 && <p className="text-[11px] font-sans text-muted-text mt-1">Your minimum order</p>}
                </div>

                <div className="w-[180px] max-sm:flex-1">
                  <label htmlFor={priceId} className="block text-[12px] font-[600] font-sans text-muted-text mb-1">
                    Price buyers pay (₹)
                  </label>
                  <div className="relative">
                    <span aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-text text-[14px]">₹</span>
                    <input
                      id={priceId}
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="0.01"
                      value={row.price}
                      aria-invalid={!!priceErr}
                      aria-describedby={priceErr ? `${priceId}-err` : undefined}
                      onChange={(e) => update(i, { price: e.target.value })}
                      onBlur={() => touch(`price-${i}`)}
                      className={`${FIELD_CLS} pl-7 ${priceErr ? 'border-error' : 'border-border-warm'}`}
                    />
                  </div>
                </div>

                {rows.length > 1 && i > 0 && (
                  <button
                    type="button"
                    onClick={() => removeRow(i)}
                    aria-label={`Remove tier ${i + 1}`}
                    className="mt-[22px] w-12 h-12 min-w-[44px] min-h-[44px] rounded border border-border-warm text-muted-text hover:text-error hover:border-error focus:outline-none focus-visible:ring-2 focus-visible:ring-forest/40 transition-colors flex items-center justify-center"
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                )}
              </div>

              {(moqErr || priceErr) && (
                <div className="mt-2 space-y-1">
                  {moqErr && (
                    <p id={`${moqId}-err`} role="alert" className="flex items-center gap-1.5 text-[12px] font-sans text-error">
                      <AlertCircle size={13} aria-hidden="true" className="flex-shrink-0" />Quantity: {moqErr}
                    </p>
                  )}
                  {priceErr && (
                    <p id={`${priceId}-err`} role="alert" className="flex items-center gap-1.5 text-[12px] font-sans text-error">
                      <AlertCircle size={13} aria-hidden="true" className="flex-shrink-0" />Price: {priceErr}
                    </p>
                  )}
                </div>
              )}

              {preview && !moqErr && !priceErr && (
                <p className="mt-2 text-[13px] font-sans text-primary" aria-live="polite">{preview}</p>
              )}
            </div>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3 mt-3">
        <button
          type="button"
          onClick={addRow}
          disabled={rows.length >= MAX_PRICE_TIERS}
          className="inline-flex items-center gap-1.5 h-11 px-4 rounded border border-border-warm text-[13px] font-[600] font-sans text-primary hover:border-forest focus:outline-none focus-visible:ring-2 focus-visible:ring-forest/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus size={14} aria-hidden="true" />Add price tier
        </button>
        {onApplyToAll && (
          <button
            type="button"
            onClick={onApplyToAll}
            className="h-11 px-4 rounded border border-border-warm text-[13px] font-[600] font-sans text-primary hover:border-forest focus:outline-none focus-visible:ring-2 focus-visible:ring-forest/40 transition-colors"
          >
            Apply these tiers to all options
          </button>
        )}
        <span className="text-[12px] font-sans text-muted-text">
          {rows.length >= MAX_PRICE_TIERS ? `Up to ${MAX_PRICE_TIERS} tiers.` : 'Bigger orders can get a lower price per unit.'}
        </span>
      </div>
    </fieldset>
  )
}
