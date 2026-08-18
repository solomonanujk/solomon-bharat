'use client'

import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { ProductGrid } from '@/components/catalogue/ProductGrid'
import { FilterSidebar, EMPTY_FILTERS, type ProductFilterValues } from '@/components/catalogue/FilterSidebar'
import { AgentProductCard } from '@/components/agent-portal/AgentProductCard'
import { CatalogueBuilder } from '@/components/agent-portal/CatalogueBuilder'
import { useInfiniteAgentProducts } from '@/hooks/queries/useProducts'

const PAGE_SIZE = 24

// ─── Page ─────────────────────────────────────────────────────────────────────
// PDF catalogue builder — same browsing grid as /agent/products, but each card
// carries a selection checkbox and a sticky bar (CatalogueBuilder) at the
// bottom generates a PDF from the current selection via the backend.

export default function AgentCataloguePage() {
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<ProductFilterValues>(EMPTY_FILTERS)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const productsParams = useMemo(
    () => ({
      search: search || undefined,
      minPrice: filters.priceMin ? Number(filters.priceMin) : undefined,
      maxPrice: filters.priceMax ? Number(filters.priceMax) : undefined,
      limit: PAGE_SIZE,
    }),
    [search, filters]
  )

  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteAgentProducts(productsParams)

  const products = data?.pages.flatMap((p) => p.items) ?? []
  const total = data?.pages[0]?.total ?? 0

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-2">
        <h1 className="text-[24px] leading-[1.3] font-[500] font-playfair text-primary">
          Build a Catalogue
        </h1>

        <div className="relative w-full sm:w-[320px] flex-shrink-0">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-text" aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products..."
            className="w-full h-10 pl-10 pr-4 border border-border-warm rounded-full text-[13px] font-public-sans placeholder:text-muted-text/50 bg-surface focus:outline-none focus:border-accent transition-colors"
          />
        </div>
      </div>
      <p className="text-[13px] font-public-sans text-muted-text mb-6">
        Select the products you want to showcase, then generate a shareable PDF catalogue.
      </p>

      <div className="flex gap-8">
        <div className="hidden lg:block sticky top-20 self-start w-60 flex-shrink-0 py-1">
          <FilterSidebar filters={filters} onFilterChange={setFilters} />
        </div>

        <div className="flex-1 min-w-0">
          {isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="aspect-square bg-muted-bg rounded-sm mb-3" />
                  <div className="h-3 bg-muted-bg rounded w-1/2 mb-2" />
                  <div className="h-4 bg-muted-bg rounded w-3/4 mb-2" />
                  <div className="h-4 bg-muted-bg rounded w-1/3" />
                </div>
              ))}
            </div>
          ) : (
            <ProductGrid
              products={products}
              totalCount={total}
              hasMore={!!hasNextPage}
              isLoadingMore={isFetchingNextPage}
              onLoadMore={fetchNextPage}
              renderItem={(product) => (
                <AgentProductCard
                  product={product}
                  selected={selectedIds.has(product.id)}
                  onToggleSelect={toggleSelect}
                />
              )}
            />
          )}
        </div>
      </div>

      <CatalogueBuilder
        selectedIds={selectedIds}
        onClearSelection={() => setSelectedIds(new Set())}
      />
    </div>
  )
}
