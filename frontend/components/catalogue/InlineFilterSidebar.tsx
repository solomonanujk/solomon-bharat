'use client'

import { FilterSections } from '@/components/catalogue/FilterSections'
import type { ProductFilterValues } from '@/components/catalogue/catalogueParams'
import type { CategoryNode } from '@/types'

interface InlineFilterSidebarProps {
  filters: ProductFilterValues
  onChange: (filters: ProductFilterValues) => void
  rootCategory?: Pick<CategoryNode, 'id' | 'name' | 'children'>
  showPrice?: boolean
  hideBrand?: boolean
}

/**
 * Desktop (≥1024px) filter column — 220px wide, sits beside the 3-card grid.
 * Unlike the mobile drawer, changes here apply immediately (the grid is right
 * beside it, so there is nothing hidden to "apply" to).
 */
export function InlineFilterSidebar({ filters, onChange, rootCategory, showPrice, hideBrand }: InlineFilterSidebarProps) {
  return (
    <aside aria-label="Product filters" className="w-[220px]">
      <h2 className="sr-only">Filter products</h2>
      <FilterSections
        filters={filters}
        onChange={(overrides) => onChange({ ...filters, ...overrides })}
        rootCategory={rootCategory}
        showPrice={showPrice}
        hideBrand={hideBrand}
      />
    </aside>
  )
}
