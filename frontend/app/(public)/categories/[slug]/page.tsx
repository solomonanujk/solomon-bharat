'use client'

import { use, useState, useMemo, useRef, useEffect, Suspense } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { ChevronDown, ChevronLeft, SlidersHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import { NavBar } from '@/components/shared/NavBar'
import { Footer } from '@/components/shared/Footer'
import { EmptyState } from '@/components/shared/EmptyState'
import { ProductGrid } from '@/components/catalogue/ProductGrid'
import { CategoryTileCarousel } from '@/components/catalogue/CategoryTileCarousel'
import { InlineFilterSidebar } from '@/components/catalogue/InlineFilterSidebar'
import { FiltersDrawer, EMPTY_FILTERS, activeFilterCount, type ProductFilterValues } from '@/components/catalogue/FiltersDrawer'
import { useCategory } from '@/hooks/queries/useCategories'
import { useInfiniteProducts } from '@/hooks/queries/useProducts'

const PAGE_SIZE = 24

type SortValue = 'featured' | 'newest' | 'trending'

const SORT_OPTIONS: { value: SortValue; label: string }[] = [
  { value: 'featured', label: 'Featured' },
  { value: 'newest', label: 'Newest' },
  { value: 'trending', label: 'Trending' },
]

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

// ─── Desktop breakpoint check ──────────────────────────────────────────────────
// `FiltersDrawer` locks body scroll whenever it's `open`, regardless of whether
// its `lg:hidden` wrapper actually renders it — so on desktop the invisible
// mobile drawer would still freeze the page's scroll the moment "All filters"
// opens the (visible, non-scroll-locking) inline sidebar instead. Gating `open`
// on the real viewport width, not just CSS, keeps the lock scoped to whichever
// one is actually shown.

function useIsDesktop(breakpointPx = 1024) {
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(`(min-width: ${breakpointPx}px)`).matches
  )
  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${breakpointPx}px)`)
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [breakpointPx])
  return isDesktop
}

// ─── Sort dropdown ────────────────────────────────────────────────────────────

function useOutsideClick(ref: React.RefObject<HTMLElement | null>, handler: () => void, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) handler()
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [ref, handler, enabled])
}

function SortDropdown({ value, onChange }: { value: SortValue; onChange: (v: SortValue) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useOutsideClick(ref, () => setOpen(false), open)
  const current = SORT_OPTIONS.find((o) => o.value === value) ?? SORT_OPTIONS[0]

  return (
    <div ref={ref} className="relative ml-auto flex-shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full border border-[#D0C8BE] text-[13px] font-public-sans text-primary hover:border-primary transition-colors"
      >
        Sort by {current.label}
        <ChevronDown size={13} className={cn('transition-transform', open && 'rotate-180')} aria-hidden="true" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 z-20 bg-surface border border-border-warm rounded shadow-[0_4px_20px_rgba(26,26,26,0.08)] py-1.5 min-w-[160px]">
          {SORT_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => { onChange(o.value); setOpen(false) }}
              className={cn(
                'w-full text-left px-4 py-2 text-[13px] font-public-sans transition-colors',
                o.value === value ? 'text-primary font-[600] bg-muted-bg' : 'text-muted-text hover:bg-muted-bg'
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Inner page (needs useSearchParams) ──────────────────────────────────────

function CategoryDetailInner({ slug }: { slug: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const sortParam = searchParams.get('sort')
  const sort: SortValue = sortParam === 'newest' || sortParam === 'featured' || sortParam === 'trending' ? sortParam : 'featured'

  function setSort(next: SortValue) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('sort', next)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  const [filters, setFilters] = useState<ProductFilterValues | null>(null)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const isDesktop = useIsDesktop()

  const { data: category, isLoading: categoryLoading } = useCategory(slug)

  // Seeds the panel's Category section with "where the shopper already is" the
  // first time the category loads — after that, further changes (a sibling
  // category, or filters like price/lead time) are the shopper's own, so they
  // aren't clobbered on every re-render.
  const effectiveFilters: ProductFilterValues = useMemo(
    () => filters ?? { ...EMPTY_FILTERS, categoryId: category?.id ?? null },
    [filters, category?.id]
  )

  const productsParams = useMemo(
    () => ({
      categoryId: effectiveFilters.categoryId ?? category?.id,
      sort,
      minPrice: effectiveFilters.priceMin ? Number(effectiveFilters.priceMin) : undefined,
      maxPrice: effectiveFilters.priceMax ? Number(effectiveFilters.priceMax) : undefined,
      placeOfOrigin: effectiveFilters.placeOfOrigin || undefined,
      leadTime: effectiveFilters.leadTime || undefined,
      limit: PAGE_SIZE,
    }),
    [category?.id, sort, effectiveFilters]
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

  const filterCount = activeFilterCount(effectiveFilters)

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
        <div className="max-w-[1280px] mx-auto w-full px-4 sm:px-6 lg:px-16 py-8">
          <CategoryTileCarousel
            categoryName={category.name}
            categorySlug={category.slug}
            categoryImage={category.heroImage}
            subcategories={category.children}
          />

          {/* Filter pill row — the category-name block on the left sits at the
              same x-position as the inline sidebar below it (same 260px width),
              matching Faire's layout where that heading lives in this row
              rather than stacked as its own row above the sidebar. */}
          <div className="flex items-center gap-2 mb-6">
            {filtersOpen && (
              <div className="hidden lg:flex items-center justify-between w-[260px] flex-shrink-0">
                <p className="text-[15px] font-[600] font-public-sans text-primary underline underline-offset-4">
                  {category.name}
                </p>
                {filterCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setFilters(EMPTY_FILTERS)}
                    className="text-[13px] font-[500] font-public-sans text-primary underline underline-offset-2 hover:opacity-70 transition-opacity"
                  >
                    Clear all
                  </button>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={() => setFiltersOpen((v) => !v)}
              className={cn(
                'inline-flex items-center gap-2 h-9 px-4 rounded-full text-[13px] font-[400] font-public-sans transition-colors',
                filtersOpen
                  ? 'bg-primary text-white'
                  : 'border border-[#D0C8BE] text-muted-text hover:text-primary hover:border-primary'
              )}
            >
              {filtersOpen ? <ChevronLeft size={14} /> : <SlidersHorizontal size={14} />}
              {filtersOpen ? 'Hide filters' : 'All filters'}
              {filterCount > 0 && (
                <span
                  className={cn(
                    'min-w-[18px] h-[18px] rounded-full text-[10px] font-[600] inline-flex items-center justify-center',
                    filtersOpen ? 'bg-white text-primary' : 'bg-primary text-white'
                  )}
                >
                  {filterCount}
                </span>
              )}
            </button>

            <SortDropdown value={sort} onChange={setSort} />
          </div>

          <div className="lg:flex lg:gap-8 lg:items-start">
            {filtersOpen && (
              <div className="hidden lg:block lg:sticky lg:top-[124px] lg:max-h-[calc(100vh-140px)] lg:overflow-y-auto">
                <InlineFilterSidebar
                  categoryRoot={{ id: category.id, name: category.name, children: category.children }}
                  filters={effectiveFilters}
                  onChange={setFilters}
                />
              </div>
            )}

            <div className="flex-1 min-w-0">
              {productsLoading ? (
                <LoadingSkeleton />
              ) : products.length === 0 ? (
                <EmptyState
                  title="No products found"
                  description={filterCount > 0 ? 'Try adjusting your filters.' : `No products in ${category.name} yet.`}
                />
              ) : (
                <ProductGrid
                  products={products}
                  totalCount={total}
                  hasMore={!!hasNextPage}
                  isLoadingMore={isFetchingNextPage}
                  onLoadMore={fetchNextPage}
                  columns={filtersOpen ? 4 : 5}
                />
              )}
            </div>
          </div>
        </div>
      </main>

      <div className="lg:hidden">
        <FiltersDrawer
          open={filtersOpen && !isDesktop}
          onOpenChange={setFiltersOpen}
          filters={effectiveFilters}
          onChange={setFilters}
          totalCount={total}
        />
      </div>

      <Footer />
    </div>
  )
}

// ─── Page (Suspense wrapper for useSearchParams) ──────────────────────────────

export default function CategoryDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  return (
    <Suspense>
      <CategoryDetailInner slug={slug} />
    </Suspense>
  )
}
