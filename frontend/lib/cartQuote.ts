import type { CartQuote, QuoteLine, QuoteLineStatus } from '@/types'

/** Minimal shape of a cart line the quote logic needs. */
export interface QuotableItem {
  productId: string
  variantId?: string
  quantity: number
  unitAdminPriceInr: number
  /** A sample line (sample price, no MOQ). */
  isSample?: boolean
}

/** 'PENDING' = no quote line for the cart's current quantity yet (first load or a just-changed quantity). */
export type ResolvedStatus = QuoteLineStatus | 'PENDING'

export interface ResolvedLine {
  status: ResolvedStatus
  /** Unit price to display — quoted when known, otherwise the stored price (estimate). */
  unitPriceInr: number
  /** Line total to display and sum. Non-OK quoted lines contribute 0 (the server gave no price). */
  lineTotalInr: number
  /** Minimum order quantity from the quote when known. */
  moq: number | null
  message?: string
  /** True when unit/total are the server's exact figures for this quantity. */
  quoted: boolean
}

export function lineKey(productId: string, variantId?: string | null, isSample?: boolean): string {
  return `${productId}:${variantId ?? ''}${isSample ? ':sample' : ''}`
}

/** Stable key for a set of cart lines: product/variant/quantity triples only (never prices). */
export function quoteKey(items: QuotableItem[]): string {
  return items.map((i) => `${lineKey(i.productId, i.variantId, i.isSample)}:${i.quantity}`).join('|')
}

export function findQuoteLine(
  quote: CartQuote | undefined,
  productId: string,
  variantId?: string | null,
  isSample?: boolean
): QuoteLine | undefined {
  return quote?.lines.find(
    (l) => l.productId === productId && (l.variantId ?? null) === (variantId ?? null) && !!l.isSample === !!isSample
  )
}

/**
 * Merges a cart line with its quote line. A quote line computed for a different
 * quantity than the cart now holds is stale: it is ignored for status, and — if it
 * was priced — its unit price is used only as an estimate.
 */
export function resolveLine(item: QuotableItem, quoteLine: QuoteLine | undefined): ResolvedLine {
  const fallback = item.unitAdminPriceInr
  if (!quoteLine) {
    return { status: 'PENDING', unitPriceInr: fallback, lineTotalInr: fallback * item.quantity, moq: null, quoted: false }
  }
  if (quoteLine.quantity !== item.quantity) {
    const unit = quoteLine.status === 'OK' && quoteLine.unitPriceInr != null ? quoteLine.unitPriceInr : fallback
    return { status: 'PENDING', unitPriceInr: unit, lineTotalInr: unit * item.quantity, moq: quoteLine.moq, quoted: false }
  }
  if (quoteLine.status === 'OK' && quoteLine.unitPriceInr != null) {
    return {
      status: 'OK',
      unitPriceInr: quoteLine.unitPriceInr,
      lineTotalInr: quoteLine.lineTotalInr ?? quoteLine.unitPriceInr * item.quantity,
      moq: quoteLine.moq,
      quoted: true,
    }
  }
  return {
    status: quoteLine.status === 'OK' ? 'PENDING' : quoteLine.status,
    unitPriceInr: fallback,
    lineTotalInr: 0,
    moq: quoteLine.moq,
    message: quoteLine.message,
    quoted: false,
  }
}

export function resolveAll<T extends QuotableItem>(
  items: T[],
  quote: CartQuote | undefined
): { item: T; resolved: ResolvedLine }[] {
  return items.map((item) => ({ item, resolved: resolveLine(item, findQuoteLine(quote, item.productId, item.variantId, item.isSample)) }))
}

/** True when some line has a definitive non-OK quote status. */
export function hasBlockingLine(resolved: ResolvedLine[]): boolean {
  return resolved.some((r) => r.status !== 'OK' && r.status !== 'PENDING')
}

/** Updates to push back into the cart store: quoted unit price and MOQ for lines whose quote matches the current quantity. */
export interface QuotedSync {
  productId: string
  variantId?: string
  isSample?: boolean
  unitPriceInr?: number
  moq: number
}

export function quoteSyncUpdates(items: QuotableItem[], quote: CartQuote | undefined): QuotedSync[] {
  const out: QuotedSync[] = []
  for (const item of items) {
    const q = findQuoteLine(quote, item.productId, item.variantId, item.isSample)
    if (!q || q.quantity !== item.quantity) continue
    out.push({
      productId: item.productId,
      variantId: item.variantId,
      isSample: item.isSample,
      unitPriceInr: q.status === 'OK' ? q.unitPriceInr : undefined,
      moq: q.moq,
    })
  }
  return out
}
