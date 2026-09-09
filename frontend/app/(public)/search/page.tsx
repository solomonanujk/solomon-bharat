'use client'

import { Suspense, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { SlidersHorizontal, X } from 'lucide-react'
import { NavBar } from '@/components/shared/NavBar'
import { Footer } from '@/components/shared/Footer'
import { EmptyState } from '@/components/shared/EmptyState'
import { ProductGrid } from '@/components/catalogue/ProductGrid'
import { FilterSidebar, EMPTY_FILTERS, type ProductFilterValues } from '@/components/catalogue/FilterSidebar'
import { useInfiniteProducts } from '@/hooks/queries/useProducts'

const PAGE_SIZE = 24

const SORT_MODES: Record<string, { heading: string; empty: string }> = {
  newest: { heading: 'New Products', empty: 'No products yet — check back soon.' },
  featured: { heading: 'Bestsellers', empty: 'No featured products yet — check back soon.' },
  trending: {
    heading: 'Trending',
    empty: 'Nothing trending yet — trending is based on real orders in the last 30 days.',
  },
}

// ─── Loading skeleton — matches the category/collection detail pages ─────────

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="animate-pulse">
          <div className="aspect-square bg-[#F0EBE3] rounded-lg mb-3" />
          <div className="h-3 bg-[#F0EBE3] rounded w-1/2 mb-2" />
          <div className="h-4 bg-[#F0EBE3] rounded w-3/4 mb-2" />
          <div className="h-4 bg-[#F0EBE3] rounded w-1/3" />
        </div>
      ))}
    </div>
  )
}

// ─── Inner page (needs useSearchParams) ──────────────────────────────────────

function SearchResultsInner() {
  const searchParams = useSearchParams()
  const q = searchParams.get('q')?.trim() ?? ''
  const sortParam = searchParams.get('sort')
  const sort: 'newest' | 'featured' | 'trending' | undefined =
    sortParam === 'newest' || sortParam === 'featured' || sortParam === 'trending' ? sortParam : undefined
  const sortMode = sort ? SORT_MODES[sort] : undefined

  const [filters, setFilters] = useState<ProductFilterValues>(EMPTY_FILTERS)
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)

  const productsParams = useMemo(
    () => ({
      search: !sort && q ? q : undefined,
      sort,
      minPrice: filters.priceMin ? Number(filters.priceMin) : undefined,
      maxPrice: filters.priceMax ? Number(filters.priceMax) : undefined,
      limit: PAGE_SIZE,
    }),
    [q, sort, filters]
  )

  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteProducts(productsParams)
  const products = data?.pages.flatMap((p) => p.items) ?? []
  const total = data?.pages[0]?.total ?? 0

  const activeFilterCount = filters.priceMin || filters.priceMax ? 1 : 0

  if (!q && !sort) {
    return (
      <div className="min-h-screen bg-bg flex flex-col">
        <NavBar />
        <main className="flex-1 flex items-center justify-center">
          <EmptyState
            title="Search Solomon Bharat"
            description="Use the search bar above to find products by name, description, or material."
          />
        </main>
        <Footer />
      </div>
    )
  }

  const heading = sortMode?.heading ?? `Results for “${q}”`
  const emptyDescription = sortMode?.empty ?? `Nothing matched "${q}". Try a different search term or adjust your filters.`

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <NavBar />

      <main className="flex-1">
        <div className="max-w-[1280px] mx-auto w-full px-4 py-8">
          <h1 className="font-playfair text-[28px] sm:text-[36px] font-[600] text-primary leading-tight mb-1">
            {heading}
          </h1>
          <p className="font-public-sans text-[14px] text-muted-text mb-6">
            {isLoading ? 'Loading…' : `${total} product${total === 1 ? '' : 's'} found`}
          </p>

          {/* Mobile filter toggle */}
          <div className="lg:hidden mb-4">
            <button
              type="button"
              onClick={() => setMobileFiltersOpen(true)}
              className="inline-flex items-center gap-2 h-9 px-4 rounded-full border border-[#D0C8BE] text-[13px] font-[500] font-public-sans text-muted-text hover:text-primary hover:border-primary transition-colors"
            >
              <SlidersHorizontal size={14} />
              Filters
              {activeFilterCount > 0 && (
                <span className="min-w-[18px] h-[18px] rounded-full bg-primary text-white text-[10px] font-[700] inline-flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>

          {/* Content: sidebar + grid */}
          <div className="flex gap-8">
            <div className="hidden lg:block sticky top-20 lg:top-[124px] self-start w-60 flex-shrink-0 py-6 pr-6 border-r border-border-warm max-h-[calc(100vh-5rem)] overflow-y-auto overflow-x-hidden">
              <FilterSidebar filters={filters} onFilterChange={setFilters} />
            </div>

            <div className="flex-1 min-w-0">
              {isLoading ? (
                <LoadingSkeleton />
              ) : products.length === 0 ? (
                <EmptyState
                  title="No products found"
                  description={emptyDescription}
                />
              ) : (
                <ProductGrid
                  products={products}
                  totalCount={total}
                  hasMore={!!hasNextPage}
                  isLoadingMore={isFetchingNextPage}
                  onLoadMore={fetchNextPage}
                />
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Mobile filter drawer */}
      {mobileFiltersOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileFiltersOpen(false)} />
          <div className="absolute right-0 top-0 bottom-0 w-[280px] bg-surface overflow-y-auto p-5 shadow-xl">
            <div className="flex items-center justify-between mb-5">
              <span className="text-[15px] font-[600] font-public-sans text-primary">Filters</span>
              <button type="button" onClick={() => setMobileFiltersOpen(false)}>
                <X size={18} className="text-muted-text" />
              </button>
            </div>
            <FilterSidebar filters={filters} onFilterChange={setFilters} />
          </div>
        </div>
      )}

      <Footer />
    </div>
  )
}

// ─── Page (Suspense wrapper for useSearchParams) ──────────────────────────────

export default function SearchPage() {
  return (
    <Suspense>
      <SearchResultsInner />
    </Suspense>
  )
}
