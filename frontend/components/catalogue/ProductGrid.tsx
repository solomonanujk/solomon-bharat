'use client'

import { Fragment, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { ProductCard } from '@/components/shared/ProductCard'
import type { Product } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProductGridProps {
  products: Product[]
  totalCount: number
  hasMore: boolean
  isLoadingMore: boolean
  onLoadMore: () => void
  /** Columns at the widest breakpoint — 4 (default, category/collection grids) or 5 (buyer "Ideas for you" feed). */
  columns?: 4 | 5
  /** Optional per-product renderer — defaults to the buyer `ProductCard`. */
  renderItem?: (product: Product) => React.ReactNode
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function NoResults() {
  return (
    <div className="col-span-full flex flex-col items-center justify-center py-24 text-center">
      <div className="w-14 h-14 rounded bg-muted-bg flex items-center justify-center mb-4">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
          className="text-muted-text"
        >
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.5" />
          <path d="M20 20L17 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M8 11h6M11 8v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
      <p className="text-[16px] font-[400] font-public-sans text-primary">No products found</p>
      <p className="text-[14px] font-public-sans text-muted-text mt-1">
        Try adjusting your filters or search query.
      </p>
    </div>
  )
}

function CardSkeleton() {
  return (
    <div className="flex flex-col animate-pulse">
      <div className="aspect-square rounded-sm bg-muted-bg" />
      <div className="h-4 bg-muted-bg rounded w-1/3 mt-2" />
      <div className="h-3 bg-muted-bg rounded w-4/5 mt-1.5" />
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────
// Infinite scroll — a sentinel div near the bottom triggers onLoadMore as it
// enters the viewport, instead of page-number pagination.

const COLUMN_CLASSES = {
  4: 'grid-cols-2 md:grid-cols-3 xl:grid-cols-4',
  5: 'grid-cols-2 md:grid-cols-3 xl:grid-cols-5',
} as const

export function ProductGrid({
  products,
  totalCount,
  hasMore,
  isLoadingMore,
  onLoadMore,
  columns = 4,
  renderItem,
}: ProductGridProps) {
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = sentinelRef.current
    if (!el || !hasMore) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) onLoadMore()
      },
      { rootMargin: '400px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasMore, onLoadMore])

  return (
    <div className="flex flex-col gap-6">
      {/* Grid */}
      <div
        className={cn('grid gap-3 sm:gap-4 md:gap-6', COLUMN_CLASSES[columns])}
        aria-label="Product results"
      >
        {products.length === 0 && !isLoadingMore ? (
          <NoResults />
        ) : (
          <>
            {products.map((product) =>
              renderItem ? (
                <Fragment key={product.id}>{renderItem(product)}</Fragment>
              ) : (
                <ProductCard key={product.id} product={product} />
              )
            )}
            {isLoadingMore && Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={`skeleton-${i}`} />)}
          </>
        )}
      </div>

      {products.length > 0 && (
        <div className="flex flex-col items-center gap-2 pt-2">
          <p className="text-[12px] leading-[1.3] font-[300] font-public-sans text-muted-text">
            Showing {products.length} of {totalCount} products
          </p>
          {!hasMore && (
            <p className="text-[12px] font-public-sans text-muted-text/70">You&apos;ve reached the end</p>
          )}
        </div>
      )}

      {/* Sentinel — enters the viewport ~400px before the actual bottom, triggering the next page */}
      {hasMore && <div ref={sentinelRef} aria-hidden="true" className="h-1" />}
    </div>
  )
}
