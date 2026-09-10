'use client'

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetClose } from '@/components/ui/sheet'
import { FilterSections } from '@/components/catalogue/FilterSections'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProductFilterValues {
  priceMin: string
  priceMax: string
  categoryId: string | null
  placeOfOrigin: string
  leadTime: string
  /** Set via the standalone "Low minimum" pill, not a drawer/sidebar section. */
  moqMax?: number
}

export const EMPTY_FILTERS: ProductFilterValues = {
  priceMin: '',
  priceMax: '',
  categoryId: null,
  placeOfOrigin: '',
  leadTime: '',
  moqMax: undefined,
}

export function activeFilterCount(filters: ProductFilterValues): number {
  let count = 0
  if (filters.priceMin || filters.priceMax) count += 1
  if (filters.categoryId) count += 1
  if (filters.placeOfOrigin) count += 1
  if (filters.leadTime) count += 1
  if (filters.moqMax) count += 1
  return count
}

// ─── Component ────────────────────────────────────────────────────────────────
// Every change applies immediately (the page's product query re-runs live as
// you toggle filters, same as the results grid behind the drawer) — there's no
// staged/draft state here. The bottom button just closes the drawer; the count
// on it reflects the page's own already-live total.

interface FiltersDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  filters: ProductFilterValues
  onChange: (filters: ProductFilterValues) => void
  /** The page's own current result count (already reflects `filters` live). */
  totalCount: number
}

export function FiltersDrawer({ open, onOpenChange, filters, onChange, totalCount }: FiltersDrawerProps) {
  function commit(overrides: Partial<ProductFilterValues>) {
    onChange({ ...filters, ...overrides })
  }

  const filterCount = activeFilterCount(filters)
  const hasActiveFilters = filterCount > 0

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="flex flex-col w-[400px]">
        <SheetHeader>
          {hasActiveFilters ? (
            <p className="text-[16px] font-[600] font-public-sans text-primary">
              {filterCount} filter{filterCount === 1 ? '' : 's'} applied
            </p>
          ) : (
            <SheetTitle>Filters</SheetTitle>
          )}
          <div className="flex items-center gap-4">
            {hasActiveFilters && (
              <button
                type="button"
                onClick={() => onChange(EMPTY_FILTERS)}
                className="text-[13px] font-[500] font-public-sans text-primary underline underline-offset-2 hover:opacity-70 transition-opacity"
              >
                Clear all
              </button>
            )}
            <SheetClose />
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6">
          <FilterSections filters={filters} onChange={commit} />
        </div>

        <div className="p-4 border-t border-border-warm">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="w-full h-12 rounded bg-primary text-white text-[14px] font-[600] font-public-sans hover:bg-[#2a2a2a] transition-colors"
          >
            Show {totalCount.toLocaleString()} product{totalCount === 1 ? '' : 's'}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
