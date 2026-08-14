'use client'

import { useState, useCallback } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Price range presets ────────────────────────────────────────────────────
// The API only supports a single contiguous minPrice/maxPrice range, so these
// render as checkboxes but behave as a mutually-exclusive group — selecting
// one clears any other, matching what the backend can actually filter on.

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

const VISIBLE_RANGES_COLLAPSED = 4

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProductFilterValues {
  priceMin: string
  priceMax: string
}

export const EMPTY_FILTERS: ProductFilterValues = {
  priceMin: '',
  priceMax: '',
}

interface FilterSidebarProps {
  filters: ProductFilterValues
  onFilterChange: (filters: ProductFilterValues) => void
}

// ─── Section heading ──────────────────────────────────────────────────────────

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[12px] font-[500] font-public-sans text-muted-text uppercase tracking-[0.05em] mb-3">
      {children}
    </p>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────
// Price filter sidebar for category & collection listing pages. Deliberately
// does not include material/MOQ/brand-minimum/ships-to filters — not in scope
// for the public marketplace.

export function FilterSidebar({ filters, onFilterChange }: FilterSidebarProps) {
  const [local, setLocal] = useState(filters)
  const [showAllRanges, setShowAllRanges] = useState(false)

  const commit = useCallback(
    (overrides: Partial<ProductFilterValues> = {}) => {
      const next = { ...local, ...overrides }
      setLocal(next)
      onFilterChange(next)
    },
    [local, onFilterChange]
  )

  function handleClearAll() {
    setLocal(EMPTY_FILTERS)
    onFilterChange(EMPTY_FILTERS)
  }

  const hasActiveFilters = local.priceMin !== '' || local.priceMax !== ''

  return (
    <aside
      className={cn(
        'w-60 flex-shrink-0',
        'bg-bg',
        'overflow-y-auto overflow-x-hidden'
      )}
      aria-label="Product filters"
    >
      <div className="flex items-center justify-between mb-5">
        <p className="text-[12px] font-[700] font-public-sans text-primary uppercase tracking-[0.06em]">
          Filters
        </p>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={handleClearAll}
            title="Clear all filters"
            aria-label="Clear all filters"
            className="w-6 h-6 rounded flex items-center justify-center text-muted-text hover:text-primary hover:bg-muted-bg transition-colors"
          >
            <X size={14} aria-hidden />
          </button>
        )}
      </div>

      {/* Price Range — preset checkboxes, mutually exclusive (single min/max supported by the API) */}
      <div className="mb-6">
        <SectionHeading>Wholesale price</SectionHeading>
        <div className="flex flex-col gap-3">
          {(showAllRanges ? PRICE_RANGES : PRICE_RANGES.slice(0, VISIBLE_RANGES_COLLAPSED)).map((range) => {
            const checked =
              local.priceMin === (range.min?.toString() ?? '') && local.priceMax === (range.max?.toString() ?? '')
            return (
              <label
                key={range.label}
                className="flex items-center gap-2.5 text-[14px] font-public-sans text-primary cursor-pointer select-none"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => {
                    if (checked) {
                      commit({ priceMin: '', priceMax: '' })
                    } else {
                      commit({ priceMin: range.min?.toString() ?? '', priceMax: range.max?.toString() ?? '' })
                    }
                  }}
                  className="w-4 h-4 rounded border-border-warm text-accent focus:ring-accent focus:ring-1 accent-accent"
                />
                {range.label}
              </label>
            )
          })}
        </div>
        {PRICE_RANGES.length > VISIBLE_RANGES_COLLAPSED && (
          <button
            type="button"
            onClick={() => setShowAllRanges((v) => !v)}
            className="mt-3 text-[13px] font-[600] font-public-sans text-primary underline underline-offset-2 hover:text-accent transition-colors"
          >
            {showAllRanges ? 'Show less' : 'Show more'}
          </button>
        )}
      </div>
    </aside>
  )
}
