'use client'

import { FilterSections } from '@/components/catalogue/FilterSections'
import { CategorySidebarTree } from '@/components/catalogue/CategorySidebarTree'
import type { ProductFilterValues } from '@/components/catalogue/FiltersDrawer'
import type { CategoryNode } from '@/types'

interface InlineFilterSidebarProps {
  /** The current category page's own category — scopes the Category section
   *  to just this subtree instead of the full site-wide list. */
  categoryRoot: Pick<CategoryNode, 'id' | 'name' | 'children'>
  filters: ProductFilterValues
  onChange: (filters: ProductFilterValues) => void
}

/**
 * Desktop-only docked filter column for /categories/[slug] (Faire's category page
 * uses an inline sidebar rather than an overlay drawer here). /search keeps the
 * overlay `FiltersDrawer` — both share the same `FilterSections` controls.
 *
 * The category-name heading + "Clear all" live in the pill row above (same row
 * as "Hide filters"/sort, matching Faire's layout — the heading sits at this
 * column's own x-position, not stacked in a second row above it), not here.
 */
export function InlineFilterSidebar({ categoryRoot, filters, onChange }: InlineFilterSidebarProps) {
  function commit(overrides: Partial<ProductFilterValues>) {
    onChange({ ...filters, ...overrides })
  }

  return (
    <div className="w-[260px] flex-shrink-0">
      <FilterSections
        filters={filters}
        onChange={commit}
        hideCategoryLabel
        categoryContent={
          <CategorySidebarTree
            root={categoryRoot}
            value={filters.categoryId}
            onChange={(categoryId) => commit({ categoryId })}
          />
        }
      />
    </div>
  )
}
