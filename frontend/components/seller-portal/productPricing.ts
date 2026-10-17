/**
 * Pure tier-pricing logic for the unified product form (seller submit/edit,
 * admin create/edit). No React, no imports — so it can be unit-checked in isolation.
 *
 * Pricing always lives in volume tiers (MOQ + price per unit): one flat ladder when the
 * product has no options, or one ladder per option when it does. The product-level
 * `moq` and `sellerPrice` the backend requires are derived from those ladders.
 */

/** Optional strict cap on a price ladder (flat and per option). */
export const MAX_BRAND_TIERS = 5

export type TierField = 'moq' | 'sellerPrice' | 'adminPrice' | 'agentPrice'

/** One editable row; raw input strings while the user types. */
export interface TierRow {
  id: string
  moq: string
  sellerPrice: string
  adminPrice: string
  agentPrice: string
}

/** A tier in the exact shape the products API accepts. */
export interface PayloadTier {
  moq: number
  sellerPrice: number
  adminPrice?: number
  agentPrice?: number
}

export type TierRowErrors = Partial<Record<TierField, string>>

export interface LadderInput {
  key: string
  rows: TierRow[]
}

export interface LadderEvaluation {
  /** Errors keyed by row id. */
  rowErrors: Record<string, TierRowErrors>
  /** Ladder-level error (nothing priced yet, too many tiers). */
  message?: string
  /** Non-blocking notes (curated sellers: price rises with quantity). */
  warnings: string[]
  /** Complete, well-formed rows sorted by MOQ ascending. */
  valid: TierRow[]
}

export interface PricingEvaluation {
  ladders: Record<string, LadderEvaluation>
  /** Lowest valid tier MOQ across every ladder, or null when nothing is priced yet. */
  productMoq: number | null
  hasErrors: boolean
}

export interface EvaluateOptions {
  /** Strict ladder rules (tier cap, first tier at MOQ). The product form passes false. */
  strict: boolean
  /** Admin-create mode: buyer (adminPrice) and agent (agentPrice) columns are in play. */
  withAdminPricing: boolean
}

export interface PricingPayload {
  /** Lowest valid tier MOQ across every ladder. */
  moq: number
  /** Cheapest tier price anywhere. */
  sellerPrice: number
  /** Flat ladder; empty when the product has options (each option carries its own). */
  priceTiers: PayloadTier[]
  /** Option ladders keyed by option key (never contains the flat 'single' key). */
  variantTiers: Record<string, PayloadTier[]>
}

export const FLAT_KEY = 'single'

function num(value: string): number {
  return value.trim() === '' ? NaN : Number(value)
}

function filled(value: string): boolean {
  return value.trim() !== ''
}

function money(n: number): string {
  return `₹${n}`
}

/** Two blank-price starter tiers (MOQ 20/30) so a fresh table shows what to fill in.
 *  Ids derive from the ladder key, so they are deterministic and safe to compute in render. */
export function starterTierRows(key: string): TierRow[] {
  return [
    { id: `${key}::tier-20`, moq: '20', sellerPrice: '', adminPrice: '', agentPrice: '' },
    { id: `${key}::tier-30`, moq: '30', sellerPrice: '', adminPrice: '', agentPrice: '' },
  ]
}

export function blankTierRow(id: string): TierRow {
  return { id, moq: '', sellerPrice: '', adminPrice: '', agentPrice: '' }
}

/** Rows for an existing product's ladder. A legacy product with no stored tiers shows its
 *  single price as one row; one with no price at all (a bare draft) gets the starter tiers. */
export function hydrateTierRows(
  key: string,
  tiers: { moq: number; sellerPrice: number | string }[] | undefined,
  fallback?: { moq: number; sellerPrice: number | string },
): TierRow[] {
  if (tiers && tiers.length > 0) {
    return [...tiers]
      .sort((a, b) => a.moq - b.moq)
      .map((t, i) => ({ id: `${key}::h${i}`, moq: String(t.moq), sellerPrice: String(t.sellerPrice), adminPrice: '', agentPrice: '' }))
  }
  if (fallback && Number(fallback.sellerPrice) > 0) {
    return [{
      id: `${key}::h0`,
      moq: String(Math.max(1, Number(fallback.moq) || 1)),
      sellerPrice: String(fallback.sellerPrice),
      adminPrice: '',
      agentPrice: '',
    }]
  }
  return starterTierRows(key)
}

/** Copies a ladder onto another key with fresh, key-scoped ids. */
export function cloneTierRows(rows: TierRow[], targetKey: string): TierRow[] {
  return rows.map((r, i) => ({ ...r, id: `${targetKey}::c${i}-${Date.now().toString(36)}` }))
}

function isActive(row: TierRow, withAdminPricing: boolean): boolean {
  return filled(row.sellerPrice) || (withAdminPricing && (filled(row.adminPrice) || filled(row.agentPrice)))
}

function evaluateLadder(rows: TierRow[], opts: EvaluateOptions): LadderEvaluation {
  const rowErrors: Record<string, TierRowErrors> = {}
  const warnings: string[] = []
  const active = rows.filter((r) => isActive(r, opts.withAdminPricing))
  const setErr = (id: string, field: TierField, msg: string) => {
    rowErrors[id] = { ...rowErrors[id], [field]: msg }
  }

  const wellFormed: TierRow[] = []
  for (const row of active) {
    const price = num(row.sellerPrice)
    const moq = num(row.moq)
    const priceOk = price > 0
    const moqOk = Number.isInteger(moq) && moq >= 1
    if (!priceOk) setErr(row.id, 'sellerPrice', 'Enter a price greater than 0.')
    if (!moqOk) setErr(row.id, 'moq', 'Enter a whole number, 1 or more.')
    if (opts.withAdminPricing) {
      if (filled(row.adminPrice) && !(num(row.adminPrice) > 0)) setErr(row.id, 'adminPrice', 'Must be greater than 0.')
      if (filled(row.agentPrice) && !(num(row.agentPrice) > 0)) setErr(row.id, 'agentPrice', 'Must be greater than 0.')
    }
    if (priceOk && moqOk) wellFormed.push(row)
  }

  const valid = [...wellFormed].sort((a, b) => Number(a.moq) - Number(b.moq))
  let message: string | undefined
  if (active.length === 0) message = 'Set a price for at least one tier.'
  if (opts.strict && active.length > MAX_BRAND_TIERS) message = `Up to ${MAX_BRAND_TIERS} price tiers.`

  for (let i = 1; i < valid.length; i += 1) {
    const prev = valid[i - 1]
    const cur = valid[i]
    if (Number(cur.moq) === Number(prev.moq)) {
      if (opts.strict) setErr(cur.id, 'moq', 'Another tier already starts at this quantity.')
      else warnings.push(`Two tiers start at ${cur.moq} units.`)
      continue
    }
    if (Number(cur.sellerPrice) > Number(prev.sellerPrice)) {
      if (opts.strict) {
        setErr(cur.id, 'sellerPrice', `Can't be higher than the ${prev.moq}-unit tier (${money(Number(prev.sellerPrice))}).`)
      } else {
        warnings.push(`The ${cur.moq}-unit tier costs more per unit than the ${prev.moq}-unit tier. Bigger orders normally get a lower price.`)
      }
    }
  }

  return { rowErrors, message, warnings, valid }
}

export function evaluatePricing(ladders: LadderInput[], opts: EvaluateOptions): PricingEvaluation {
  const result: Record<string, LadderEvaluation> = {}
  for (const l of ladders) result[l.key] = evaluateLadder(l.rows, opts)

  const lowestMoqs = Object.values(result)
    .map((e) => (e.valid.length > 0 ? Number(e.valid[0].moq) : NaN))
    .filter((n) => Number.isFinite(n))
  const productMoq = lowestMoqs.length > 0 ? Math.min(...lowestMoqs) : null

  // Strict rule: every ladder's first tier starts at the product MOQ (the lowest anywhere).
  if (opts.strict && productMoq !== null) {
    for (const e of Object.values(result)) {
      const first = e.valid[0]
      if (first && Number(first.moq) !== productMoq) {
        e.rowErrors[first.id] = {
          ...e.rowErrors[first.id],
          moq: `Every option must start at the same minimum order (${productMoq}).`,
        }
      }
    }
  }

  const hasErrors = Object.values(result).some((e) => e.message || Object.keys(e.rowErrors).length > 0)
  return { ladders: result, productMoq, hasErrors }
}

export function toPayloadTiers(valid: TierRow[], withAdminPricing: boolean): PayloadTier[] {
  return valid.map((r) => ({
    moq: Number(r.moq),
    sellerPrice: Number(r.sellerPrice),
    ...(withAdminPricing
      ? {
          adminPrice: filled(r.adminPrice) ? Number(r.adminPrice) : undefined,
          agentPrice: filled(r.agentPrice) ? Number(r.agentPrice) : undefined,
        }
      : {}),
  }))
}

/** Derives the product-level moq / sellerPrice and every ladder's payload. Null while any
 *  ladder has no valid tier yet. Callers must also check `evaluation.hasErrors` before
 *  submitting. */
export function buildPricingPayload(
  evaluation: PricingEvaluation,
  ladderKeys: string[],
  usingSingleRow: boolean,
  withAdminPricing: boolean,
): PricingPayload | null {
  if (ladderKeys.length === 0 || evaluation.productMoq === null) return null
  const all: PayloadTier[] = []
  const variantTiers: Record<string, PayloadTier[]> = {}
  let priceTiers: PayloadTier[] = []
  for (const key of ladderKeys) {
    const e = evaluation.ladders[key]
    if (!e || e.valid.length === 0) return null
    const tiers = toPayloadTiers(e.valid, withAdminPricing)
    all.push(...tiers)
    if (usingSingleRow && key === FLAT_KEY) priceTiers = tiers
    else variantTiers[key] = tiers
  }
  return {
    moq: evaluation.productMoq,
    sellerPrice: Math.min(...all.map((t) => t.sellerPrice)),
    priceTiers,
    variantTiers,
  }
}

/** True when two ladders have identical quantities and seller prices. */
export function tiersEqual(a: PayloadTier[], b: PayloadTier[]): boolean {
  if (a.length !== b.length) return false
  const norm = (t: PayloadTier[]) => [...t].sort((x, y) => x.moq - y.moq).map((x) => `${x.moq}:${x.sellerPrice}`)
  const na = norm(a)
  const nb = norm(b)
  return na.every((v, i) => v === nb[i])
}
