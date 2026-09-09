'use client'

import { use, useState, useMemo } from 'react'
import Link from 'next/link'
import { Search, SlidersHorizontal, X, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { NavBar } from '@/components/shared/NavBar'
import { Footer } from '@/components/shared/Footer'
import { EmptyState } from '@/components/shared/EmptyState'
import { ProductGrid } from '@/components/catalogue/ProductGrid'
import { FilterSidebar, EMPTY_FILTERS, type ProductFilterValues } from '@/components/catalogue/FilterSidebar'
import { useCategory, useCategoryTree } from '@/hooks/queries/useCategories'
import { useInfiniteProducts } from '@/hooks/queries/useProducts'
import type { CategoryNode } from '@/types'

const PAGE_SIZE = 24

/** Flattens the tree into an id lookup so a sidebar item (which only carries
 *  its own fields from useCategory) can find its real children for expansion. */
function buildNodeMap(nodes: CategoryNode[]): Map<string, CategoryNode> {
  const map = new Map<string, CategoryNode>()
  function walk(list: CategoryNode[]) {
    for (const n of list) {
      map.set(n.id, n)
      if (n.children?.length) walk(n.children)
    }
  }
  walk(nodes)
  return map
}

// ─── Subcategory list item (expandable if it has its own children) ───────────

function SubcategoryItem({
  category: c,
  node,
  isActive,
  onNavigate,
}: {
  category: { id: string; slug: string; name: string }
  node: CategoryNode | undefined
  isActive: boolean
  onNavigate?: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const children = node?.children ?? []
  const hasChildren = children.length > 0

  return (
    <li>
      <div className="flex items-center gap-1">
        <Link
          href={`/categories/${c.slug}`}
          onClick={onNavigate}
          className={cn(
            'flex-1 block py-2.5 text-[14px] font-public-sans transition-colors',
            isActive ? 'font-[600] text-primary underline underline-offset-2' : 'text-muted-text hover:text-primary'
          )}
        >
          {c.name}
        </Link>
        {hasChildren && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            aria-label={expanded ? `Collapse ${c.name}` : `Expand ${c.name}`}
            className="p-1.5 -mr-1.5 text-muted-text hover:text-primary transition-colors"
          >
            <ChevronRight size={14} className={cn('transition-transform duration-150', expanded && 'rotate-90')} aria-hidden="true" />
          </button>
        )}
      </div>
      {hasChildren && expanded && (
        <ul className="flex flex-col pl-4 pb-1">
          {children.map((grandchild) => (
            <li key={grandchild.id}>
              <Link
                href={`/categories/${grandchild.slug}`}
                onClick={onNavigate}
                className="block py-1.5 text-[13px] font-public-sans text-muted-text hover:text-primary transition-colors"
              >
                {grandchild.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CategoryDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<ProductFilterValues>(EMPTY_FILTERS)
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const [showFilters, setShowFilters] = useState(true)

  const { data: category, isLoading: categoryLoading } = useCategory(slug)
  const { data: tree = [] } = useCategoryTree()
  const nodeMap = useMemo(() => buildNodeMap(tree), [tree])

  const productsParams = useMemo(
    () => ({
      categoryId: category?.id,
      search: search || undefined,
      minPrice: filters.priceMin ? Number(filters.priceMin) : undefined,
      maxPrice: filters.priceMax ? Number(filters.priceMax) : undefined,
      limit: PAGE_SIZE,
    }),
    [category?.id, search, filters]
  )

  const {
    data,
    isLoading: productsLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteProducts(productsParams)
  const products = data?.pages.flatMap((p) => p.items) ?? []
  const total = data?.pages[0]?.total ?? 0

  const activeFilterCount = filters.priceMin || filters.priceMax ? 1 : 0

  function handleFilterChange(next: ProductFilterValues) {
    setFilters(next)
  }

  if (categoryLoading) {
    return (
      <div className="min-h-screen bg-bg flex flex-col">
        <NavBar />
        <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8">
          <LoadingSkeleton />
        </main>
        <Footer />
      </div>
    )
  }

  if (!category) {
    return (
      <div className="min-h-screen bg-bg flex flex-col">
        <NavBar />
        <main className="flex-1 flex items-center justify-center">
          <EmptyState
            title="Category not found"
            description="This category may have been removed or the link is incorrect."
            action={{ label: 'Back to Home', onClick: () => { window.location.href = '/' } }}
          />
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <NavBar />

      <main className="flex-1">
        <div className="max-w-[1280px] mx-auto w-full px-4 py-8">
          {/* Breadcrumb + title — no banner image */}
          <nav className="flex items-center gap-1.5 text-[13px] font-public-sans text-accent mb-3">
            <Link href="/" className="hover:text-accent-hover transition-colors">Home</Link>
            {category.breadcrumb?.map((c, i) => {
              const isLast = i === category.breadcrumb.length - 1
              return (
                <span key={c.id} className="flex items-center gap-1.5">
                  <span className="text-muted-text">/</span>
                  {isLast ? (
                    <span className="text-primary">{c.name}</span>
                  ) : (
                    <Link href={`/categories/${c.slug}`} className="hover:text-accent-hover transition-colors">
                      {c.name}
                    </Link>
                  )}
                </span>
              )
            })}
          </nav>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-2">
            <h1 className="font-playfair text-[36px] sm:text-[46px] font-[600] text-primary leading-tight">
              {category.name}
            </h1>

            {/* Context search */}
            <div className="relative w-full sm:w-[320px] flex-shrink-0">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-text" aria-hidden="true" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`Search in ${category.name}...`}
                className="w-full h-10 pl-10 pr-4 border border-border-warm rounded-full text-[13px] font-public-sans placeholder:text-muted-text/50 bg-surface focus:outline-none focus:border-accent transition-colors"
              />
            </div>
          </div>
          {category.description && (
            <p className="font-public-sans text-[14px] text-muted-text max-w-[560px] mb-6">
              {category.description}
            </p>
          )}

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

          {/* Desktop show/hide filters toggle */}
          <div className="hidden lg:flex mb-4">
            <button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              className="inline-flex items-center gap-2 h-9 px-4 rounded-full bg-primary text-white text-[13px] font-[500] font-public-sans hover:bg-primary/90 transition-colors"
            >
              <SlidersHorizontal size={14} />
              {showFilters ? 'Hide filters' : 'Show filters'}
            </button>
          </div>

          {/* Content: sidebar + grid */}
          <div className="flex gap-8">
            {showFilters && (
            <div className="hidden lg:block sticky top-20 lg:top-[124px] self-start w-60 flex-shrink-0 py-6 pr-6 border-r border-border-warm max-h-[calc(100vh-5rem)] overflow-y-auto overflow-x-hidden">
              {/* Subcategories — this level's children, or (on a leaf) itself as the active item */}
              <div className="mb-6 pb-4 border-b border-border-warm">
                <p className="font-playfair font-[600] text-primary text-[15px] leading-snug pb-3 border-b-2 border-border-warm mb-1">
                  {category.children.length > 0 ? category.name : 'This category'}
                </p>
                <ul className="flex flex-col pl-3">
                  {(category.children.length > 0 ? category.children : [category]).map((c) => (
                    <SubcategoryItem
                      key={c.id}
                      category={c}
                      node={nodeMap.get(c.id)}
                      isActive={c.slug === category.slug}
                    />
                  ))}
                </ul>
              </div>

              <FilterSidebar filters={filters} onFilterChange={handleFilterChange} />
            </div>
            )}

            <div className="flex-1 min-w-0">
              {productsLoading ? (
                <LoadingSkeleton />
              ) : products.length === 0 ? (
                <EmptyState
                  title="No products found"
                  description={activeFilterCount > 0 || search ? 'Try adjusting your filters or search.' : `No products in ${category.name} yet.`}
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

            <div className="mb-6 pb-4 border-b border-border-warm">
              <p className="font-playfair font-[600] text-primary text-[15px] leading-snug pb-3 border-b-2 border-border-warm mb-1">
                {category.children.length > 0 ? category.name : 'This category'}
              </p>
              <ul className="flex flex-col pl-3">
                {(category.children.length > 0 ? category.children : [category]).map((c) => (
                  <SubcategoryItem
                    key={c.id}
                    category={c}
                    node={nodeMap.get(c.id)}
                    isActive={c.slug === category.slug}
                    onNavigate={() => setMobileFiltersOpen(false)}
                  />
                ))}
              </ul>
            </div>

            <FilterSidebar filters={filters} onFilterChange={handleFilterChange} />
          </div>
        </div>
      )}

      <Footer />
    </div>
  )
}
