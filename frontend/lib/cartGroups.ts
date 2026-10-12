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
    }
    group.items.push(item)
    group.subtotalInr += resolveLine(item, findQuoteLine(quote, item.productId, item.variantId)).lineTotalInr
  }
  const groups = [...map.values()]
  for (const g of groups) {
    g.shortfallInr = g.minOrderValueInr > 0 ? Math.max(0, g.minOrderValueInr - g.subtotalInr) : 0
  }
  return groups.sort((a, b) => (a.brand === null ? -1 : 0) - (b.brand === null ? -1 : 0))
}

export function unmetGroups(groups: CartGroup[]): CartGroup[] {
  return groups.filter((g) => g.brand && g.shortfallInr > 0)
}
