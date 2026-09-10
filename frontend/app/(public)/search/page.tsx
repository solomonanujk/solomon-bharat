'use client'

import { Suspense, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { SlidersHorizontal } from 'lucide-react'
import { NavBar } from '@/components/shared/NavBar'
import { Footer } from '@/components/shared/Footer'
import { EmptyState } from '@/components/shared/EmptyState'
import { ProductGrid } from '@/components/catalogue/ProductGrid'
import { FiltersDrawer, EMPTY_FILTERS, activeFilterCount, type ProductFilterValues } from '@/components/catalogue/FiltersDrawer'
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
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
      {Array.from({ length: 15 }).map((_, i) => (
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
  const [filtersOpen, setFiltersOpen] = useState(false)

  const productsParams = useMemo(
    () => ({
      search: !sort && q ? q : undefined,
      sort,
      categoryId: filters.categoryId ?? undefined,
      minPrice: filters.priceMin ? Number(filters.priceMin) : undefined,
      maxPrice: filters.priceMax ? Number(filters.priceMax) : undefined,
      placeOfOrigin: filters.placeOfOrigin || undefined,
      leadTime: filters.leadTime || undefined,
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

  const filterCount = activeFilterCount(filters)

  if (!q && !sort) {
    return (
      <div className="min-h-screen bg-bg flex flex-col">
        <NavBar initialSearchQuery={q} />
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

  const emptyDescription = sortMode?.empty ?? `Nothing matched "${q}". Try a different search term or adjust your filters.`

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <NavBar initialSearchQuery={q} />

      <main className="flex-1">
        <div className="max-w-[1280px] mx-auto w-full px-4 sm:px-6 lg:px-16 py-8">
          {/* Filter pill row */}
          <div className="flex items-center gap-2 mb-6">
            <button
              type="button"
              onClick={() => setFiltersOpen(true)}
              className="inline-flex items-center gap-2 h-9 px-4 rounded-full border border-[#D0C8BE] text-[13px] font-[400] font-public-sans text-muted-text hover:text-primary hover:border-primary transition-colors"
            >
              <SlidersHorizontal size={14} />
              All filters
              {filterCount > 0 && (
                <span className="min-w-[18px] h-[18px] rounded-full bg-primary text-white text-[10px] font-[600] inline-flex items-center justify-center">
                  {filterCount}
                </span>
              )}
            </button>
          </div>

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
              columns={5}
            />
          )}
        </div>
      </main>

      <FiltersDrawer
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        filters={filters}
        onChange={setFilters}
        totalCount={total}
      />

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
