'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FilterSections } from '@/components/catalogue/FilterSections'
import { FilterGroup } from '@/components/catalogue/filterControls'
import {
  SORT_OPTIONS,
  type CatalogueSort,
  type ProductFilterValues,
} from '@/components/catalogue/catalogueParams'
import type { CategoryNode } from '@/types'

// Re-exported for older import sites.
export { EMPTY_FILTERS, activeFilterCount, type ProductFilterValues } from '@/components/catalogue/catalogueParams'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

interface FiltersDrawerProps {
  open: boolean
  onClose: () => void
  /** Which control opened the drawer — "sort" moves focus to the sort options. */
  initialFocus?: 'filters' | 'sort'
  /** Currently applied filters (the draft starts from these each time it opens). */
  filters: ProductFilterValues
  /** What "Clear" resets the draft to (a category page keeps its own category). */
  clearedFilters: ProductFilterValues
  sort: CatalogueSort
  /** False when the current mode has no sort choice (e.g. trending). */
  showSort?: boolean
  /** False when the current mode accepts no facets (the drawer then holds sort only). */
  showFilters?: boolean
  rootCategory?: Pick<CategoryNode, 'id' | 'name' | 'children'>
  showPrice?: boolean
  onApply: (filters: ProductFilterValues, sort: CatalogueSort) => void
}

/**
 * Tablet/mobile (<1024px) filter + sort drawer. Full height, max 360px wide,
 * 24px padding; Close at the top, Clear + Apply at the bottom. Selections are
 * staged in a draft and only take effect on Apply. Focus is trapped while open,
 * Escape closes, and focus returns to whichever button opened it.
 */
export function FiltersDrawer(props: FiltersDrawerProps) {
  // Only ever opened by a user interaction, so `document` exists whenever
  // `open` is true. Mounting the panel only while open means the draft
  // re-seeds from the applied filters every time, and nothing off-screen is
  // focusable.
  if (!props.open || typeof document === 'undefined') return null
  return createPortal(<DrawerPanel {...props} />, document.body)
}

function DrawerPanel({
  onClose,
  initialFocus = 'filters',
  filters,
  clearedFilters,
  sort,
  showSort = true,
  showFilters = true,
  rootCategory,
  showPrice,
  onApply,
}: FiltersDrawerProps) {
  const [draft, setDraft] = useState<ProductFilterValues>(filters)
  const [draftSort, setDraftSort] = useState<CatalogueSort>(sort)
  const panelRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const sortGroupRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const sortName = useId()

  // Initial focus, body scroll lock, and focus return on unmount.
  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null
    if (initialFocus === 'sort' && sortGroupRef.current) {
      sortGroupRef.current.querySelector<HTMLInputElement>('input:checked')?.focus()
    } else {
      closeRef.current?.focus()
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    // The drawer is a <1024px pattern; if the viewport grows past that while
    // it's open, close it so the desktop sidebar takes over and scroll unlocks.
    const desktop = window.matchMedia('(min-width: 1024px)')
    const onViewportChange = (e: MediaQueryListEvent) => {
      if (e.matches) onClose()
    }
    desktop.addEventListener('change', onViewportChange)
    return () => {
      desktop.removeEventListener('change', onViewportChange)
      document.body.style.overflow = previousOverflow
      previouslyFocused?.focus()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on open
  }, [])

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') {
      e.stopPropagation()
      onClose()
      return
    }
    if (e.key !== 'Tab' || !panelRef.current) return
    const focusables = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (el) => el.offsetParent !== null
    )
    if (focusables.length === 0) return
    const first = focusables[0]
    const last = focusables[focusables.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  return (
    <div className="fixed inset-0 z-50 lg:hidden" onKeyDown={handleKeyDown}>
      <div className="absolute inset-0 bg-ink/40" aria-hidden="true" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="absolute inset-y-0 left-0 flex flex-col w-full max-w-[360px] bg-white border-r border-line"
      >
        <div className="flex items-center justify-between gap-4 px-6 pt-6 pb-4 border-b border-line">
          <h2 id={titleId} className="type-h3 text-ink">
            {showFilters ? 'Filter products' : 'Sort products'}
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 min-h-11 px-2 -mr-2 rounded-[4px] text-[14px] leading-[20px] font-[600] text-forest hover:bg-forest/[8%] transition-colors duration-150"
          >
            <X size={18} aria-hidden="true" />
            Close
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-6 py-6">
          {showSort && (
            <div ref={sortGroupRef}>
              <FilterGroup title="Sort by">
                {SORT_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className="flex items-center gap-3 min-h-11 cursor-pointer text-[14px] leading-[20px] text-ink"
                  >
                    <input
                      type="radio"
                      name={sortName}
                      value={option.value}
                      checked={draftSort === option.value}
                      onChange={() => setDraftSort(option.value)}
                      className="w-[18px] h-[18px] accent-forest cursor-pointer"
                    />
                    <span className={draftSort === option.value ? 'text-forest font-[600]' : undefined}>
                      {option.label}
                    </span>
                  </label>
                ))}
              </FilterGroup>
            </div>
          )}
          {showFilters && (
            <div className={showSort ? 'pt-6 border-t border-line' : undefined}>
              <FilterSections
                filters={draft}
                onChange={(overrides) => setDraft((d) => ({ ...d, ...overrides }))}
                rootCategory={rootCategory}
                showPrice={showPrice}
              />
            </div>
          )}
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-line pb-[max(16px,env(safe-area-inset-bottom))]">
          <Button
            type="button"
            variant="secondary"
            size="lg"
            className="flex-1"
            onClick={() => {
              setDraft(clearedFilters)
              setDraftSort(SORT_OPTIONS[0].value)
            }}
          >
            Clear
          </Button>
          <Button
            type="button"
            variant="primary"
            size="lg"
            className="flex-1"
            onClick={() => {
              onApply(draft, draftSort)
              onClose()
            }}
          >
            Apply
          </Button>
        </div>
      </div>
    </div>
  )
}
