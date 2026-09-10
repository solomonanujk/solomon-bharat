'use client'

import { useState } from 'react'
import { Search } from 'lucide-react'
import { CategoryFilterDrilldown } from '@/components/catalogue/CategoryFilterDrilldown'
import { usePlaceOfOriginFacets } from '@/hooks/queries/useProducts'
import type { ProductFilterValues } from '@/components/catalogue/FiltersDrawer'

// ─── Price range presets ────────────────────────────────────────────────────
// The API only supports a single contiguous minPrice/maxPrice range, so these
// render as checkboxes but behave as a mutually-exclusive group.

interface PriceRange {
  label: string
  min?: number
  max?: number
}

const PRICE_RANGES: PriceRange[] = [
  { label: '₹0 – ₹500', min: 0, max: 500 },
  { label: '₹500 – ₹2,000', min: 500, max: 2000 },
  { label: '₹2,000 – ₹5,000', min: 2000, max: 5000 },
  { label: '₹5,000 – ₹10,000', min: 5000, max: 10000 },
  { label: '₹10,000+', min: 10000 },
]

// Same free-text quick-picks a seller can choose from at listing time
// (components/seller-portal/ProductForm.tsx's LEAD_TIME_PRESETS) — sellers can
// also type a custom value, so this contains-matches rather than exact-matches.
const LEAD_TIME_PRESETS = ['1–3 days', '1–2 weeks', '2–4 weeks']

// ─── Section ──────────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="py-5 border-b border-border-warm">
      <p className="text-[12px] font-[600] font-public-sans text-muted-text uppercase tracking-[0.06em] mb-3">
        {title}
      </p>
      {children}
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────
// The actual filter controls (Category/Price/Made in/Lead time), with no
// Sheet/header/footer chrome — shared by the overlay `FiltersDrawer` (on
// /search) and the inline `InlineFilterSidebar` (on /categories/[slug]).

interface FilterSectionsProps {
  filters: ProductFilterValues
  onChange: (overrides: Partial<ProductFilterValues>) => void
  /** The inline sidebar (/categories/[slug]) already shows the category name as
   *  its own page heading right above this, so the "Category" section's own
   *  label would just repeat it (and doesn't match Faire's reference, which
   *  shows the drill-down as a plain list directly under that heading, no
   *  second label) — the overlay drawer (/search) has no such heading, so it
   *  keeps the label. */
  hideCategoryLabel?: boolean
  /** Overrides the default site-wide `CategoryFilterDrilldown` — used by the
   *  category detail page to show a tree scoped to just that one category
   *  (`CategorySidebarTree`) instead of the full site-wide L1 list. */
  categoryContent?: React.ReactNode
}

export function FilterSections({ filters, onChange: commit, hideCategoryLabel, categoryContent }: FilterSectionsProps) {
  const { data: placeOfOriginOptions = [] } = usePlaceOfOriginFacets()
  const [placeOfOriginSearch, setPlaceOfOriginSearch] = useState('')
  const filteredOrigins = placeOfOriginOptions.filter((v) =>
    v.toLowerCase().includes(placeOfOriginSearch.trim().toLowerCase())
  )

  const categoryDrilldown = categoryContent ?? (
    <CategoryFilterDrilldown
      value={filters.categoryId}
      onChange={(categoryId) => commit({ categoryId })}
    />
  )

  return (
    <>
      {hideCategoryLabel ? (
        <div className="pb-5 border-b border-border-warm">{categoryDrilldown}</div>
      ) : (
        <Section title="Category">{categoryDrilldown}</Section>
      )}

      <Section title="Wholesale price">
        <div className="flex flex-col gap-3">
          {PRICE_RANGES.map((range) => {
            const checked =
              filters.priceMin === (range.min?.toString() ?? '') && filters.priceMax === (range.max?.toString() ?? '')
            return (
              <label
                key={range.label}
                className="flex items-center gap-2.5 text-[14px] font-public-sans text-primary cursor-pointer select-none"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() =>
                    checked
                      ? commit({ priceMin: '', priceMax: '' })
                      : commit({ priceMin: range.min?.toString() ?? '', priceMax: range.max?.toString() ?? '' })
                  }
                  className="w-4 h-4 rounded border-border-warm text-accent focus:ring-accent focus:ring-1 accent-accent"
                />
                {range.label}
              </label>
            )
          })}
        </div>
      </Section>

      <Section title="Made in">
        <div className="relative mb-3">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-text pointer-events-none" aria-hidden="true" />
          <input
            type="search"
            value={placeOfOriginSearch}
            onChange={(e) => setPlaceOfOriginSearch(e.target.value)}
            placeholder="Search"
            aria-label="Search place of origin"
            className="w-full h-10 pl-10 pr-3 rounded-full border border-border-warm bg-bg text-[14px] font-public-sans text-primary placeholder:text-muted-text/70 focus:outline-none focus:border-accent transition-colors"
          />
        </div>
        <div className="flex flex-col gap-3 max-h-52 overflow-y-auto">
          {filteredOrigins.length === 0 ? (
            <p className="text-[13px] font-public-sans text-muted-text">No matches.</p>
          ) : (
            filteredOrigins.map((origin) => {
              const checked = filters.placeOfOrigin === origin
              return (
                <label
                  key={origin}
                  className="flex items-center gap-2.5 text-[14px] font-public-sans text-primary cursor-pointer select-none"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => commit({ placeOfOrigin: checked ? '' : origin })}
                    className="w-4 h-4 rounded border-border-warm text-accent focus:ring-accent focus:ring-1 accent-accent"
                  />
                  {origin}
                </label>
              )
            })
          )}
        </div>
      </Section>

      <Section title="Lead time">
        <div className="flex flex-col gap-3">
          {LEAD_TIME_PRESETS.map((preset) => {
            const checked = filters.leadTime === preset
            return (
              <label
                key={preset}
                className="flex items-center gap-2.5 text-[14px] font-public-sans text-primary cursor-pointer select-none"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => commit({ leadTime: checked ? '' : preset })}
                  className="w-4 h-4 rounded border-border-warm text-accent focus:ring-accent focus:ring-1 accent-accent"
                />
                {preset}
              </label>
            )
          })}
        </div>
      </Section>
    </>
  )
}
