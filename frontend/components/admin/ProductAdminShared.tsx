'use client'

import { useMemo, useState } from 'react'
import { cn, formatINR } from '@/lib/utils'
import type { AdminProduct, CategoryNode, ProductPriceTier, ProposedPriceTier, ProposedVariant } from '@/types'

// ─── Category flattening (leaf nodes only) ─────────────────────────────────────

export interface FlatCategory {
  id: string
  label: string
}

export function flattenLeaves(nodes: CategoryNode[], trail: string[] = []): FlatCategory[] {
  return nodes.flatMap((node) => {
    const path = [...trail, node.name]
    if (!node.children || node.children.length === 0) {
      return [{ id: node.id, label: path.join(' / ') }]
    }
    return flattenLeaves(node.children, path)
  })
}

// ─── Small presentational helpers ──────────────────────────────────────────────

export function Section({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('bg-white border border-[#D9E2DA] rounded-xl overflow-hidden', className)}>
      <div className="px-5 py-3 border-b border-[#D9E2DA] bg-[#E7EDE7]/40">
        <h3 className="text-[12px] font-[600] font-sans text-[#183D33B3] uppercase tracking-[0.06em]">{title}</h3>
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </div>
  )
}

export function Field({ label, value }: { label: string; value?: React.ReactNode }) {
  if (value === undefined || value === null || value === '') return null
  return (
    <div>
      <p className="text-[11px] font-[600] font-sans text-[#183D33B3] uppercase tracking-[0.06em] mb-0.5">{label}</p>
      <div className="text-[13.5px] font-sans text-[#0F241D] leading-[1.5] whitespace-pre-wrap break-words">{value}</div>
    </div>
  )
}

// ─── Tier pricing (shared by the read-only display and the editable admin forms) ─

export interface TierRow {
  key: string
  groupLabel: string | null
  tier: ProductPriceTier
  /** flat = the product's own tiers; variant = a variant's tiers; base = the product has no
   *  tiers yet and is priced from its MOQ and seller price (the backend creates the tier). */
  kind?: 'flat' | 'variant' | 'base'
}

/** Flattens a product's pricing into one list of tiers — its own flat tiers if it
 *  has no variants, or each variant's own tiers (grouped by variant label) if it does. */
export function collectAllTiers(product: AdminProduct): TierRow[] {
  const flat: TierRow[] = product.priceTiers
    .filter((t) => t.id)
    .map((t) => ({ key: t.id!, groupLabel: product.variants.length ? 'All options' : null, tier: t, kind: 'flat' as const }))
  const variant: TierRow[] = product.variants.flatMap((v) =>
    (v.priceTiers ?? [])
      .filter((t) => t.id)
      .map((t) => ({ key: t.id!, groupLabel: `${v.type}: ${v.value}`, tier: t, kind: 'variant' as const })),
  )
  if (flat.length + variant.length > 0) return [...flat, ...variant]
  // No tiers saved: one row priced from the product's own MOQ and seller price.
  return [
    {
      key: 'base',
      groupLabel: null,
      kind: 'base',
      tier: {
        id: 'base',
        moq: product.moq,
        sellerPrice: product.sellerPrice,
        adminPrice: product.adminPrice ?? null,
        agentPrice: product.agentPrice ?? null,
      } as ProductPriceTier,
    },
  ]
}

export function useTierPriceForm(product: AdminProduct) {
  const allTiers = useMemo(() => collectAllTiers(product), [product])
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(allTiers.map(({ key, tier }) => [key, tier.adminPrice != null ? String(tier.adminPrice) : '']))
  )
  const [agentValues, setAgentValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(allTiers.map(({ key, tier }) => [key, tier.agentPrice != null ? String(tier.agentPrice) : '']))
  )

  function setValue(key: string, value: string) {
    setValues((v) => ({ ...v, [key]: value }))
  }

  function setAgentValue(key: string, value: string) {
    setAgentValues((v) => ({ ...v, [key]: value }))
  }

  const priced = allTiers.filter(({ key }) => values[key] && Number(values[key]) > 0)
  const hasAnyPriced = priced.length > 0
  // Approving needs a buyer price on EVERY tier (the server rejects anything less);
  // "Update Prices" can still fix a single tier, so it keeps using hasAnyPriced.
  const missingCount = allTiers.length - priced.length
  const allPriced = allTiers.length > 0 && missingCount === 0

  function buildPayload() {
    const toInput = (key: string) => {
      const input: { id: string; adminPrice: number; agentPrice?: number } = { id: key, adminPrice: Number(values[key]) }
      if (agentValues[key]) {
        input.agentPrice = Number(agentValues[key])
      }
      return input
    }
    // Flat and base rows are the product's own tiers; variant rows go separately.
    const priceTiers = priced.filter((r) => r.kind !== 'variant').map(({ key }) => toInput(key))
    const variantPriceTiers = priced.filter((r) => r.kind === 'variant').map(({ key }) => toInput(key))
    return {
      ...(priceTiers.length ? { priceTiers } : {}),
      ...(variantPriceTiers.length ? { variantPriceTiers } : {}),
    }
  }

  return { allTiers, values, setValue, agentValues, setAgentValue, buildPayload, hasAnyPriced, allPriced, missingCount }
}

/**
 * Same shape as collectAllTiers, but for a seller's PROPOSED pricing/variant change —
 * the tiers are JSON, not real DB rows yet, so each gets a synthetic key by array
 * position (`flat-0`, `variant-0-tier-1`, ...) instead of a real tier id. The backend's
 * approvePricingChange resolves these same keys back onto the proposal when creating
 * the real rows, so this key scheme must match exactly.
 */
export function tierRowsFromProposal(change: {
  proposedPriceTiers: ProposedPriceTier[]
  proposedVariants: ProposedVariant[]
}): TierRow[] {
  if (change.proposedVariants.length === 0) {
    return change.proposedPriceTiers.map((t, i) => ({
      key: `flat-${i}`,
      groupLabel: null,
      tier: { id: `flat-${i}`, moq: t.moq, sellerPrice: t.sellerPrice, adminPrice: null, agentPrice: null },
    }))
  }
  return change.proposedVariants.flatMap((v, vi) =>
    (v.priceTiers ?? []).map((t, ti) => ({
      key: `variant-${vi}-tier-${ti}`,
      groupLabel: `${v.type}: ${v.value}`,
      tier: { id: `variant-${vi}-tier-${ti}`, moq: t.moq, sellerPrice: t.sellerPrice, adminPrice: null, agentPrice: null },
    }))
  )
}

/** Same editable-tier-form state as useTierPriceForm, sourced from a pending change's
 *  proposed tiers instead of a live product's real ones. */
export function useChangeRequestPriceForm(change: {
  proposedPriceTiers: ProposedPriceTier[]
  proposedVariants: ProposedVariant[]
}) {
  const allTiers = useMemo(() => tierRowsFromProposal(change), [change])
  const [values, setValues] = useState<Record<string, string>>({})
  const [agentValues, setAgentValues] = useState<Record<string, string>>({})

  function setValue(key: string, value: string) {
    setValues((v) => ({ ...v, [key]: value }))
  }

  function setAgentValue(key: string, value: string) {
    setAgentValues((v) => ({ ...v, [key]: value }))
  }

  const priced = allTiers.filter(({ key }) => values[key] && Number(values[key]) > 0)
  const hasAnyPriced = priced.length > 0
  // Approving a pricing change needs a buyer price on every proposed tier.
  const missingCount = allTiers.length - priced.length
  const allPriced = allTiers.length > 0 && missingCount === 0

  function buildPayload() {
    const tierInputs = priced.map(({ key }) => {
      const input: { id: string; adminPrice: number; agentPrice?: number } = { id: key, adminPrice: Number(values[key]) }
      if (agentValues[key]) {
        input.agentPrice = Number(agentValues[key])
      }
      return input
    })
    return change.proposedVariants.length === 0
      ? { priceTiers: tierInputs }
      : { variantPriceTiers: tierInputs }
  }

  return { allTiers, values, setValue, agentValues, setAgentValue, buildPayload, hasAnyPriced, allPriced, missingCount }
}

export function TierPriceTable({ tiers, values, onChange, agentValues, onAgentChange, editable, disabled }: {
  tiers: TierRow[]
  values?: Record<string, string>
  onChange?: (key: string, value: string) => void
  agentValues?: Record<string, string>
  onAgentChange?: (key: string, value: string) => void
  editable?: boolean
  disabled?: boolean
}) {
  const groups = useMemo(() => {
    const map = new Map<string | null, TierRow[]>()
    for (const row of tiers) {
      const arr = map.get(row.groupLabel) ?? []
      arr.push(row)
      map.set(row.groupLabel, arr)
    }
    return Array.from(map.entries())
  }, [tiers])

  if (tiers.length === 0) {
    return <p className="text-[13px] font-sans text-[#183D33B3]">No price tiers set.</p>
  }

  return (
    <div className="space-y-4">
      {groups.map(([label, groupTiers]) => (
        <div key={label ?? 'flat'} className="space-y-1.5">
          {label && <p className="text-[12.5px] font-[600] font-sans text-[#0F241D]">{label}</p>}
          <div className="rounded border border-[#D9E2DA] overflow-hidden">
            <table className="w-full text-[12.5px] font-sans">
              <thead>
                <tr className="bg-[#E7EDE7]/40 border-b border-[#D9E2DA]">
                  <th className="text-left py-1.5 px-2.5 font-[600] text-[#183D33B3]">MOQ</th>
                  <th className="text-left py-1.5 px-2.5 font-[600] text-[#183D33B3]">Seller Price</th>
                  <th className="text-left py-1.5 px-2.5 font-[600] text-[#183D33B3]">Buyer Price (you set)</th>
                  <th className="text-left py-1.5 px-2.5 font-[600] text-[#183D33B3]">Agent Price (optional)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D9E2DA]">
                {groupTiers.map(({ key, tier }) => (
                  <tr key={key}>
                    <td className="px-2.5 py-1.5 text-[#0F241D]">{tier.moq}</td>
                    <td className="px-2.5 py-1.5 text-[#0F241D]">{formatINR(tier.sellerPrice)}</td>
                    <td className="px-2.5 py-1.5">
                      {editable ? (
                        <input
                          type="number"
                          min={1}
                          disabled={disabled}
                          value={values?.[key] ?? ''}
                          onChange={(e) => onChange?.(key, e.target.value)}
                          placeholder="e.g. 500"
                          className="w-24 h-7 px-2 rounded border border-[#D9E2DA] bg-white text-[12.5px] font-sans text-[#0F241D] focus:outline-none focus:border-[#183D33] transition-colors disabled:opacity-50"
                        />
                      ) : tier.adminPrice != null ? (
                        <span className="text-[#0F241D] font-[600]">{formatINR(tier.adminPrice)}</span>
                      ) : (
                        <span className="italic text-[#183D33B3]">not set</span>
                      )}
                    </td>
                    <td className="px-2.5 py-1.5">
                      {editable ? (
                        <input
                          type="number"
                          min={1}
                          disabled={disabled}
                          value={agentValues?.[key] ?? ''}
                          onChange={(e) => onAgentChange?.(key, e.target.value)}
                          placeholder="e.g. 500"
                          className="w-24 h-7 px-2 rounded border border-[#D9E2DA] bg-white text-[12.5px] font-sans text-[#0F241D] focus:outline-none focus:border-[#183D33] transition-colors disabled:opacity-50"
                        />
                      ) : tier.agentPrice != null ? (
                        <span className="text-[#0F241D] font-[600]">{formatINR(tier.agentPrice)}</span>
                      ) : (
                        <span className="italic text-[#183D33B3]">not set</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  )
}
