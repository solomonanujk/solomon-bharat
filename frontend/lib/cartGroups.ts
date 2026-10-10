import type { CartGroup, CartLine } from '@/types/brand-orders'

const CURATED_KEY = 'curated'

/**
 * Splits cart lines by fulfiller: the curated (Solomon Bharat) group first, then one
 * group per marketplace brand. Minimum-order shortfall is computed in INR from
 * unitAdminPriceInr; the server re-checks authoritatively at checkout.
 */
export function groupCartLines(items: CartLine[]): CartGroup[] {
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
    group.subtotalInr += item.unitAdminPriceInr * item.quantity
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
