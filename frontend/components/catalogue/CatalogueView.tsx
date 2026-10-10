'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUpDown, Check, ChevronDown, Search, SlidersHorizontal, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Breadcrumbs, type Crumb } from '@/components/catalogue/Breadcrumbs'
import { FiltersDrawer } from '@/components/catalogue/FiltersDrawer'
import { InlineFilterSidebar } from '@/components/catalogue/InlineFilterSidebar'
import { ProductGrid, ProductGridSkeleton } from '@/components/catalogue/ProductGrid'
import { Pagination } from '@/components/catalogue/Pagination'
import { findCategoryPath } from '@/components/catalogue/CategoryFilterDrilldown'
import { moqChipLabel, priceChipLabel } from '@/components/catalogue/FilterSections'
import {
  DEFAULT_SORT,
  EMPTY_FILTERS,
  SORT_OPTIONS,
  activeFilterCount,
  useCatalogueUrlState,
  type CatalogueSort,
  type ProductFilterValues,
} from '@/components/catalogue/catalogueParams'
import { useProducts } from '@/hooks/queries/useProducts'
import { useBrandFacets } from '@/hooks/queries/useBrands'
import { useCategoryTree } from '@/hooks/queries/useCategories'
import { useAuth } from '@/hooks/useAuth'
import type { CategoryNode, ProductsParams } from '@/types'

const PAGE_SIZE = 24 // divisible by 3 and 2, so full pages never leave a ragged last row

type RootCategory = Pick<CategoryNode, 'id' | 'name' | 'children'>

function findNodeName(nodes: CategoryNode[], id: string): string | null {
  for (const node of nodes) {
    if (node.id === id) return node.name
    const nested = findNodeName(node.children ?? [], id)
    if (nested) return nested
  }
  return null
}

interface Chip {
  key: string
  label: string
  onRemove: () => void
}

/** Whole-page loading state (while the category/collection itself loads) at the
 *  final layout: heading lines, then sidebar column + 3-card grid. */
export function CataloguePageSkeleton({ breadcrumbs }: { breadcrumbs: Crumb[] }) {
  return (
    <div className="sb-container pt-4 lg:pt-6 pb-12 lg:pb-[72px]">
      <Breadcrumbs items={breadcrumbs} />
      <div className="mt-4" role="status" aria-label="Loading">
        <div className="h-[18px] w-40 rounded-[2px] bg-line/60 animate-pulse" />
        <div className="mt-2 h-[35px] lg:h-[46px] w-2/3 max-w-[480px] rounded-[2px] bg-line/60 animate-pulse" />
        <div className="mt-4 h-6 w-full max-w-[660px] rounded-[2px] bg-line/60 animate-pulse" />
      </div>
      <div className="mt-8 lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-8">
        <div className="hidden lg:block" aria-hidden="true" />
        <div>
          <div className="h-12" aria-hidden="true" />
          <div className="mt-6">
            <ProductGridSkeleton columns={3} count={6} />
          </div>
        </div>
      </div>
    </div>
  )
}

export interface CatalogueViewProps {
  breadcrumbs: Crumb[]
  eyebrow: string
  title: string
  intro?: string | null
  /** Optional media beside the heading on tablet/desktop (e.g. a collection's hero photo). */
  headerMedia?: React.ReactNode
  /** Rendered between the intro and the toolbar (e.g. subcategory links). */
  beforeToolbar?: React.ReactNode
  /** Fixed scope always sent to the API. */
  scope?: { categoryId?: string; collectionId?: string; brandSlug?: string }
  /** A category page's own category — preselected and scopes the Category facet. */
  rootCategory?: RootCategory
  /** Shows the in-page context search (category/collection pages), scoped to this page. */
  contextSearchPlaceholder?: string
  /** False when the API ignores facets in the current mode (trending). */
  facets?: boolean
  /** False when the current mode has no sort choice (trending). */
  sortable?: boolean
  /** Body text when the page has no products and nothing is filtered. */
  emptyBody: string
}

export function CatalogueView({
  breadcrumbs,
  eyebrow,
  title,
  intro,
  headerMedia,
  beforeToolbar,
  scope,
  rootCategory,
  contextSearchPlaceholder,
  facets = true,
  sortable = true,
  emptyBody,
}: CatalogueViewProps) {
  const { state, update } = useCatalogueUrlState()
  const { user, isAuthenticated } = useAuth()
  // Price filtering is for signed-in buyers/agents only — the API 400s a guest
  // request carrying minPrice/maxPrice, so for everyone else they're stripped
  // from the URL-derived query below (and the facet/chip are hidden).
  const showPrice = isAuthenticated && (user?.role === 'BUYER' || user?.role === 'AGENT')
  const { data: categoryTree = [] } = useCategoryTree()
  const { data: brandFacets = [] } = useBrandFacets()
  const isAgent = user?.role === 'AGENT'
  // Brand facet is hidden on a brand storefront (fixed by the page) and for agents (they never see brands).
  const hideBrand = !!scope?.brandSlug || isAgent
  // The Curated toggle only makes sense where marketplace products can appear.
  const showCurated = !scope?.brandSlug && !isAgent && state.sort !== 'trending'

  const filters: ProductFilterValues = useMemo(() => {
    // `curated` is a toolbar toggle independent of the facet sidebar, so it survives `facets={false}`.
    const curated = showCurated && state.filters.curated
    if (!facets) return { ...EMPTY_FILTERS, curated }
    const base = { ...state.filters, curated, brand: isAgent ? '' : state.filters.brand }
    return showPrice ? base : { ...base, priceMin: '', priceMax: '' }
  }, [facets, showPrice, showCurated, isAgent, state.filters])
  const sort: CatalogueSort = state.sort === 'featured' ? 'featured' : DEFAULT_SORT
  const apiSort: ProductsParams['sort'] = sortable ? sort : state.sort ?? undefined
  // Drawer "Clear all" must not touch the toolbar toggle, which applies immediately.
  const clearedFilters: ProductFilterValues = useMemo(() => ({ ...EMPTY_FILTERS, curated: filters.curated }), [filters.curated])

  const params: ProductsParams = useMemo(
    () => ({
      categoryId: filters.categoryId ?? scope?.categoryId,
      collectionId: scope?.collectionId,
      brand: scope?.brandSlug ?? (filters.brand || undefined),
      curated: filters.curated ? true : undefined,
      search: state.q || undefined,
      sort: apiSort,
      moqMax: filters.moqMax,
      placeOfOrigin: filters.placeOfOrigin || undefined,
      leadTime: filters.leadTime || undefined,
      minPrice: showPrice && filters.priceMin ? Number(filters.priceMin) : undefined,
      maxPrice: showPrice && filters.priceMax ? Number(filters.priceMax) : undefined,
      page: state.page,
      limit: PAGE_SIZE,
    }),
    [filters, scope?.categoryId, scope?.collectionId, scope?.brandSlug, state.q, state.page, apiSort, showPrice]
  )

  const { data, isPending, isError, refetch, isFetching } = useProducts(params)
  const products = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = data?.totalPages ?? 1

  // ─── Applied filter chips ──────────────────────────────────────────────────
  function setFilters(next: ProductFilterValues) {
    update({ filters: next })
  }

  const chips: Chip[] = []
  if (contextSearchPlaceholder && state.q) {
    chips.push({ key: 'q', label: `Search: “${state.q}”`, onRemove: () => update({ q: '' }) })
  }
  if (filters.categoryId && filters.categoryId !== rootCategory?.id) {
    const path = findCategoryPath(categoryTree, filters.categoryId)
    const name =
      (rootCategory && findNodeName(rootCategory.children ?? [], filters.categoryId)) ??
      path[path.length - 1]?.name ??
      'Selected category'
    chips.push({ key: 'category', label: name, onRemove: () => setFilters({ ...filters, categoryId: null }) })
  }
  if (filters.brand && !hideBrand) {
    const name = brandFacets.find((b) => b.slug === filters.brand)?.name ?? 'Selected brand'
    chips.push({ key: 'brand', label: `Brand: ${name}`, onRemove: () => setFilters({ ...filters, brand: '' }) })
  }
  if (filters.curated) {
    chips.push({ key: 'curated', label: 'Curated by Solomon Bharat', onRemove: () => setFilters({ ...filters, curated: false }) })
  }
  if (filters.moqMax) {
    chips.push({ key: 'moq', label: moqChipLabel(filters.moqMax), onRemove: () => setFilters({ ...filters, moqMax: undefined }) })
  }
  if (filters.placeOfOrigin) {
    chips.push({
      key: 'origin',
      label: `Made in ${filters.placeOfOrigin}`,
      onRemove: () => setFilters({ ...filters, placeOfOrigin: '' }),
    })
  }
  if (filters.leadTime) {
    chips.push({
      key: 'lead',
      label: `Lead time ${filters.leadTime}`,
      onRemove: () => setFilters({ ...filters, leadTime: '' }),
    })
  }
  if (showPrice && (filters.priceMin || filters.priceMax)) {
    chips.push({
      key: 'price',
      label: priceChipLabel(filters.priceMin, filters.priceMax),
      onRemove: () => setFilters({ ...filters, priceMin: '', priceMax: '' }),
    })
  }

  function resetFilters() {
    update({ filters: EMPTY_FILTERS, q: contextSearchPlaceholder ? '' : state.q })
  }

  const filterCount = activeFilterCount(filters, rootCategory?.id)

  // ─── Drawer (tablet/mobile) ───────────────────────────────────────────────
  const [drawer, setDrawer] = useState<null | 'filters' | 'sort'>(null)

  // ─── Context search (debounced into the URL) ───────────────────────────────
  const [searchDraft, setSearchDraft] = useState(state.q)
  const [lastUrlQ, setLastUrlQ] = useState(state.q)
  if (state.q !== lastUrlQ) {
    setLastUrlQ(state.q)
    setSearchDraft(state.q)
  }
  useEffect(() => {
    if (!contextSearchPlaceholder) return
    const next = searchDraft.trim()
    if (next === state.q) return
    const t = setTimeout(() => update({ q: next }), 350)
    return () => clearTimeout(t)
  }, [searchDraft, state.q, update, contextSearchPlaceholder])

  // ─── Pagination ────────────────────────────────────────────────────────────
  const resultsRef = useRef<HTMLDivElement>(null)
  function goToPage(page: number) {
    update({ page })
    resultsRef.current?.scrollIntoView({ block: 'start' })
  }

  const showSidebar = facets
  const columns = showSidebar ? 3 : 4

  // ─── Results body ──────────────────────────────────────────────────────────
  let body: React.ReactNode
  if (isPending) {
    body = <ProductGridSkeleton columns={columns} count={6} />
  } else if (isError && !data) {
    body = (
      <div role="alert" className="py-12 lg:py-16 max-w-[520px]">
        <h3 className="type-h3 text-ink">We couldn&apos;t load these products</h3>
        <p className="mt-2 type-body text-muted">
          Something went wrong while fetching results — usually a brief connection problem. Please try again.
        </p>
        <Button variant="primary" size="lg" className="mt-6" loading={isFetching} onClick={() => refetch()}>
          Retry
        </Button>
      </div>
    )
  } else if (products.length === 0) {
    const filtered = chips.length > 0
    body = (
      <div className="py-12 lg:py-16 max-w-[520px]">
        <h3 className="type-h3 text-ink">{filtered ? 'No products match your filters' : 'No products here yet'}</h3>
        <p className="mt-2 type-body text-muted">
          {filtered ? 'Try removing a filter or two (including Curated by Solomon Bharat), or reset them all to see everything here.' : emptyBody}
        </p>
        {filtered ? (
          <Button variant="primary" size="lg" className="mt-6" onClick={resetFilters}>
            Reset filters
          </Button>
        ) : state.page > 1 ? (
          <Button variant="secondary" size="lg" className="mt-6" onClick={() => goToPage(1)}>
            Back to page 1
          </Button>
        ) : null}
      </div>
    )
  } else {
    body = (
      <div className={isFetching ? 'opacity-60 transition-opacity duration-150' : undefined} aria-busy={isFetching || undefined}>
        <ProductGrid products={products} columns={columns} />
        <Pagination page={state.page} totalPages={totalPages} onPageChange={goToPage} />
      </div>
    )
  }

  return (
    <div className="sb-container pt-4 lg:pt-6 pb-12 lg:pb-[72px]">
      <Breadcrumbs items={breadcrumbs} />

      <header className={headerMedia ? 'mt-4 md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,320px)] lg:grid-cols-[minmax(0,1fr)_400px] md:gap-8 md:items-end' : 'mt-4'}>
        <div className="min-w-0">
          <p className="type-eyebrow text-brass-dark">{eyebrow}</p>
          <h1 className="mt-2 type-h1 text-ink break-words">{title}</h1>
          {intro && <p className="mt-4 max-w-[660px] type-body text-muted">{intro}</p>}
        </div>
        {headerMedia && <div className="hidden md:block">{headerMedia}</div>}
      </header>

      {beforeToolbar}

      <div className={showSidebar ? 'mt-8 lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-8' : 'mt-8'}>
        {showSidebar && (
          <div className="hidden lg:block">
            <InlineFilterSidebar filters={filters} onChange={setFilters} rootCategory={rootCategory} showPrice={showPrice} hideBrand={hideBrand} />
          </div>
        )}

        <div ref={resultsRef} className="min-w-0 scroll-mt-32">
          {/* Toolbar */}
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-4">
            {(facets || sortable) && (
              <div className="flex gap-3 lg:hidden">
                {facets && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="lg"
                    className="flex-1 min-w-0"
                    onClick={() => setDrawer('filters')}
                    aria-haspopup="dialog"
                  >
                    <SlidersHorizontal size={16} aria-hidden="true" />
                    <span className="sm:hidden">Filter</span>
                    <span className="hidden sm:inline">Filter products</span>
                    {filterCount > 0 && (
                      <span className="inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-forest text-white text-[12px] leading-[16px]">
                        {filterCount}
                        <span className="sr-only"> applied</span>
                      </span>
                    )}
                  </Button>
                )}
                {sortable && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="lg"
                    className="flex-1 min-w-0"
                    onClick={() => setDrawer('sort')}
                    aria-haspopup="dialog"
                  >
                    <ArrowUpDown size={16} aria-hidden="true" />
                    Sort
                    <span className="sr-only">, currently {SORT_OPTIONS.find((o) => o.value === sort)?.label}</span>
                  </Button>
                )}
              </div>
            )}

            {contextSearchPlaceholder && (
              <form
                role="search"
                className="relative w-full lg:max-w-[360px]"
                onSubmit={(e) => {
                  e.preventDefault()
                  update({ q: searchDraft.trim() })
                }}
              >
                <label htmlFor="context-search" className="sr-only">
                  {contextSearchPlaceholder}
                </label>
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted pointer-events-none" aria-hidden="true" />
                <input
                  id="context-search"
                  type="search"
                  value={searchDraft}
                  onChange={(e) => setSearchDraft(e.target.value)}
                  placeholder={contextSearchPlaceholder}
                  className="w-full h-12 pl-11 pr-4 rounded-[24px] border border-line bg-white text-[16px] leading-[24px] text-ink placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-forest"
                />
              </form>
            )}

            {showCurated && (
              <button
                type="button"
                aria-pressed={filters.curated}
                onClick={() => update({ filters: { ...filters, curated: !filters.curated, brand: '' } })}
                className={`inline-flex items-center justify-center gap-2 w-full lg:w-auto min-h-11 lg:h-12 px-5 rounded-[4px] border border-forest text-[14px] leading-[20px] font-[600] flex-shrink-0 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-forest ${
                  filters.curated ? 'bg-forest text-white hover:bg-forest-hover' : 'bg-transparent text-forest hover:bg-selected'
                }`}
              >
                {filters.curated && <Check size={16} aria-hidden="true" />}
                Curated by Solomon Bharat
              </button>
            )}

            <p className="lg:order-first lg:mr-auto text-[14px] leading-[20px] text-ink" aria-live="polite">
              {isPending ? 'Loading products…' : `${total.toLocaleString()} ${total === 1 ? 'product' : 'products'}`}
            </p>

            {sortable && (
              <div className="hidden lg:flex items-center gap-3 flex-shrink-0">
                <label htmlFor="catalogue-sort" className="text-[14px] leading-[20px] font-[600] text-ink">
                  Sort by
                </label>
                <div className="relative">
                  <select
                    id="catalogue-sort"
                    value={sort}
                    onChange={(e) => update({ sort: e.target.value === 'featured' ? 'featured' : 'newest' })}
                    className="appearance-none h-12 pl-4 pr-10 rounded-[4px] border border-line bg-white text-[14px] leading-[20px] text-ink cursor-pointer hover:border-forest focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-forest"
                  >
                    {SORT_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" aria-hidden="true" />
                </div>
              </div>
            )}
          </div>

          {/* Applied filter chips */}
          {chips.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="sr-only">Applied filters:</span>
              {chips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  onClick={chip.onRemove}
                  aria-label={`Remove filter: ${chip.label}`}
                  className="inline-flex items-center gap-2 min-h-11 lg:min-h-9 max-w-full pl-3 pr-2 rounded-[4px] bg-selected text-forest text-[14px] leading-[20px] font-[600] hover:bg-forest/[14%] transition-colors duration-150"
                >
                  <span className="min-w-0 truncate">{chip.label}</span>
                  <X size={16} aria-hidden="true" className="flex-shrink-0" />
                </button>
              ))}
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center min-h-11 lg:min-h-9 px-2 text-[14px] leading-[20px] font-[600] text-forest underline underline-offset-4"
              >
                Reset filters
              </button>
            </div>
          )}

          <div className="mt-6">{body}</div>
        </div>
      </div>

      <FiltersDrawer
        open={drawer !== null}
        onClose={() => setDrawer(null)}
        initialFocus={drawer === 'sort' ? 'sort' : 'filters'}
        filters={filters}
        clearedFilters={clearedFilters}
        sort={sort}
        showSort={sortable}
        showFilters={facets}
        rootCategory={rootCategory}
        showPrice={showPrice}
        hideBrand={hideBrand}
        onApply={(nextFilters, nextSort) => update({ filters: nextFilters, sort: sortable ? nextSort : state.sort })}
      />
    </div>
  )
}
