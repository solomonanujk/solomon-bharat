'use client'

import { useState } from 'react'
import { Search } from 'lucide-react'
import { CategoryFilterDrilldown } from '@/components/catalogue/CategoryFilterDrilldown'
import { CategorySidebarTree } from '@/components/catalogue/CategorySidebarTree'
import { FilterCheckbox, FilterGroup } from '@/components/catalogue/filterControls'
import { usePlaceOfOriginFacets } from '@/hooks/queries/useProducts'
import { useBrandFacets } from '@/hooks/queries/useBrands'
import type { ProductFilterValues } from '@/components/catalogue/catalogueParams'
import type { CategoryNode } from '@/types'

// ─── Facet options ────────────────────────────────────────────────────────────
// Every facet maps 1:1 to a real GET /products query param:
//   Category → categoryId, Minimum order → moqMax, Made in → placeOfOrigin,
//   Lead time → leadTime, Brand → brand (one marketplace brand slug), Wholesale price → minPrice/maxPrice (signed-in buyers/agents only).
// No "Craft" facet: the API has no craft/technique filter (isHandmade, isGITagged
// and howItIsMade are not queryable), so it is omitted rather than faked.

/** Upper bounds for the `moqMax` param — filter thresholds, not product claims. */
const MOQ_OPTIONS = [10, 25, 50, 100]

// Same quick-picks a seller chooses from at listing time (seller ProductForm's
// LEAD_TIME_PRESETS). Sellers can also type a custom value, so the API
// contains-matches rather than exact-matches.
const LEAD_TIME_PRESETS = ['1–3 days', '1–2 weeks', '2–4 weeks']

// The API only supports one contiguous minPrice/maxPrice range on the buyer
// price (INR), so these behave as a mutually-exclusive group.
const PRICE_RANGES: { label: string; min?: number; max?: number }[] = [
  { label: 'Under ₹500', min: 0, max: 500 },
  { label: '₹500 – ₹2,000', min: 500, max: 2000 },
  { label: '₹2,000 – ₹5,000', min: 2000, max: 5000 },
  { label: '₹5,000 – ₹10,000', min: 5000, max: 10000 },
  { label: '₹10,000 and above', min: 10000 },
]

const ORIGIN_SEARCH_THRESHOLD = 8

interface FilterSectionsProps {
  filters: ProductFilterValues
  onChange: (overrides: Partial<ProductFilterValues>) => void
  /** A category page's own category — scopes the Category facet to its subtree
   *  (and keeps it preselected). Without it the facet lists every category. */
  rootCategory?: Pick<CategoryNode, 'id' | 'name' | 'children'>
  /** Only signed-in buyers may filter by price — guests never see price data. */
  showPrice?: boolean
  /** True on a brand storefront, where the brand is already fixed by the page, and for agents (who never see marketplace brands). */
  hideBrand?: boolean
}

export function FilterSections({ filters, onChange: emit, rootCategory, showPrice, hideBrand }: FilterSectionsProps) {
  const { data: originOptions = [] } = usePlaceOfOriginFacets()
  const { data: brandOptions = [] } = useBrandFacets()
  // Picking a brand turns the Curated toggle off (they are mutually exclusive).
  const commit = (overrides: Partial<ProductFilterValues>) =>
    emit(overrides.brand ? { ...overrides, curated: false } : overrides)
  const [originSearch, setOriginSearch] = useState('')
  const filteredOrigins = originOptions.filter((v) => v.toLowerCase().includes(originSearch.trim().toLowerCase()))

  return (
    <div className="flex flex-col">
      <FilterGroup title="Category">
        {rootCategory ? (
          <CategorySidebarTree
            root={rootCategory}
            value={filters.categoryId}
            // The page's own category is the default — keep it out of the URL.
            onChange={(categoryId) => commit({ categoryId: categoryId === rootCategory.id ? null : categoryId })}
          />
        ) : (
          <CategoryFilterDrilldown value={filters.categoryId} onChange={(categoryId) => commit({ categoryId })} />
        )}
      </FilterGroup>

      {!hideBrand && brandOptions.length > 0 && (
        <FilterGroup title="Brand">
          <div className="max-h-[264px] overflow-y-auto">
            {brandOptions.map((b) => {
              const checked = filters.brand === b.slug
              return (
                <FilterCheckbox
                  key={b.slug}
                  label={`${b.name} (${b.count})`}
                  checked={checked}
                  onChange={() => commit({ brand: checked ? '' : b.slug })}
                />
              )
            })}
          </div>
        </FilterGroup>
      )}

      <FilterGroup title="Minimum order">
        {MOQ_OPTIONS.map((max) => {
          const checked = filters.moqMax === max
          return (
            <FilterCheckbox
              key={max}
              label={`Up to ${max} units`}
              checked={checked}
              onChange={() => commit({ moqMax: checked ? undefined : max })}
            />
          )
        })}
      </FilterGroup>

      {originOptions.length > 0 && (
        <FilterGroup title="Made in">
          {originOptions.length > ORIGIN_SEARCH_THRESHOLD && (
            <div className="relative mb-2">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="search"
                value={originSearch}
                onChange={(e) => setOriginSearch(e.target.value)}
                placeholder="Find a place"
                aria-label="Find a place of origin"
                className="w-full h-11 pl-9 pr-3 rounded-[4px] border border-line bg-white text-[16px] leading-[24px] text-ink placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-forest"
              />
            </div>
          )}
          <div className="max-h-[264px] overflow-y-auto">
            {filteredOrigins.length === 0 ? (
              <p className="py-3 type-caption text-muted">No places match “{originSearch}”.</p>
            ) : (
              filteredOrigins.map((origin) => {
                const checked = filters.placeOfOrigin === origin
                return (
                  <FilterCheckbox
                    key={origin}
                    label={origin}
                    checked={checked}
                    onChange={() => commit({ placeOfOrigin: checked ? '' : origin })}
                  />
                )
              })
            )}
          </div>
        </FilterGroup>
      )}

      <FilterGroup title="Lead time">
        {LEAD_TIME_PRESETS.map((preset) => {
          const checked = filters.leadTime === preset
          return (
            <FilterCheckbox
              key={preset}
              label={preset}
              checked={checked}
              onChange={() => commit({ leadTime: checked ? '' : preset })}
            />
          )
        })}
      </FilterGroup>

      {showPrice && (
        <FilterGroup title="Wholesale price">
          {PRICE_RANGES.map((range) => {
            const min = range.min?.toString() ?? ''
            const max = range.max?.toString() ?? ''
            const checked = filters.priceMin === min && filters.priceMax === max
            return (
              <FilterCheckbox
                key={range.label}
                label={range.label}
                checked={checked}
                onChange={() => commit(checked ? { priceMin: '', priceMax: '' } : { priceMin: min, priceMax: max })}
              />
            )
          })}
        </FilterGroup>
      )}
    </div>
  )
}

/** Human labels for applied-filter chips. */
export function moqChipLabel(max: number) {
  return `MOQ up to ${max} units`
}

export function priceChipLabel(min: string, max: string) {
  const match = PRICE_RANGES.find((r) => (r.min?.toString() ?? '') === min && (r.max?.toString() ?? '') === max)
  if (match) return match.label
  if (min && max) return `₹${min} – ₹${max}`
  if (min) return `From ₹${min}`
  return `Up to ₹${max}`
}
