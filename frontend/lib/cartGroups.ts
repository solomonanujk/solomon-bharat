import type { CartGroup, CartLine } from '@/types/brand-orders'
import type { CartQuote } from '@/types'
import { findQuoteLine, resolveLine } from '@/lib/cartQuote'

const CURATED_KEY = 'curated'

/**
 * Splits cart lines by fulfiller: the curated (Solomon Bharat) group first, then one
 * group per marketplace brand. Subtotals and the minimum-order shortfall (INR) use the
 * server-quoted line totals when a quote is supplied (falling back to the stored price
 * only for lines not yet quoted); the server re-checks authoritatively at checkout.
 */
export function groupCartLines(items: CartLine[], quote?: CartQuote): CartGroup[] {
  const map = new Map<string, CartGroup>()
  const wholesaleByKey = new Map<string, { has: boolean; subtotal: number }>()
  for (const item of items) {
    const brand = item.brand ?? null
    const key = brand ? `brand:${brand.id}` : CURATED_KEY
    let group = map.get(key)
    if (!group) {
      group = {
        key,
        brand,
        items: [],
        subtotalInr: 0,
        minOrderValueInr: brand ? Number(brand.minOrderValueInr) || 0 : 0,
        shortfallInr: 0,
      }
      map.set(key, group)
      wholesaleByKey.set(key, { has: false, subtotal: 0 })
    }
    group.items.push(item)
    const lineTotal = resolveLine(item, findQuoteLine(quote, item.productId, item.variantId, item.isSample)).lineTotalInr
    group.subtotalInr += lineTotal
    if (!item.isSample) {
      const w = wholesaleByKey.get(key)!
      w.has = true
      w.subtotal += lineTotal
    }
  }
  const groups = [...map.values()]
  for (const g of groups) {
    // Samples are exempt from a brand's minimum: only wholesale lines count, and a
    // samples-only order has no minimum.
    const w = wholesaleByKey.get(g.key)!
    g.shortfallInr = g.minOrderValueInr > 0 && w.has ? Math.max(0, g.minOrderValueInr - w.subtotal) : 0
  }
  return groups.sort((a, b) => (a.brand === null ? -1 : 0) - (b.brand === null ? -1 : 0))
}

export function unmetGroups(groups: CartGroup[]): CartGroup[] {
  return groups.filter((g) => g.brand && g.shortfallInr > 0)
}
