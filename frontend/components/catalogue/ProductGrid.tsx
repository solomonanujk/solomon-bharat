'use client'

import { Fragment, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { ProductCard } from '@/components/shared/ProductCard'
import type { Product } from '@/types'

// ─── Layout ───────────────────────────────────────────────────────────────────
// Fixed column counts (never auto-fit), so an incomplete last row keeps normal
// card widths instead of stretching. Gaps: 12 mobile / 20 tablet / 24 desktop.
//   3 — catalogue grids beside the 220px filter sidebar (2 / 3 / 3)
//   4 — catalogue grids with no sidebar (2 / 3 / 4)
//   5 — buyer home "Ideas for you" feed (2 / 3 / 5)

const COLUMN_CLASSES = {
  3: 'grid-cols-2 md:grid-cols-3',
  4: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4',
  5: 'grid-cols-2 md:grid-cols-3 xl:grid-cols-5',
} as const

export type ProductGridColumns = keyof typeof COLUMN_CLASSES

export const GRID_GAP_CLASSES = 'gap-3 md:gap-5 lg:gap-6'

export function productGridClasses(columns: ProductGridColumns) {
  return cn('grid', GRID_GAP_CLASSES, COLUMN_CLASSES[columns])
}

/** Neutral placeholder at the final ProductCard size (same padding, image ratio, rows). */
export function ProductCardSkeleton() {
  return (
    <div className="flex flex-col bg-white border border-line rounded-[6px] p-3 md:p-4" aria-hidden="true">
      <div className="aspect-square md:aspect-[4/3] rounded-[4px] bg-ivory animate-pulse" />
      <div className="mt-3 flex flex-col gap-2">
        <div className="h-4 w-4/5 rounded-[2px] bg-ivory animate-pulse" />
        <div className="h-5 w-24 rounded-[2px] bg-ivory animate-pulse" />
        <div className="h-4 w-3/5 rounded-[2px] bg-ivory animate-pulse" />
      </div>
    </div>
  )
}

export function ProductGridSkeleton({ columns = 3, count = 6 }: { columns?: ProductGridColumns; count?: number }) {
  return (
    <div className={productGridClasses(columns)} role="status" aria-label="Loading products">
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

interface ProductGridProps {
  products: Product[]
  columns?: ProductGridColumns
  /** Optional per-product renderer — defaults to the buyer `ProductCard`. */
  renderItem?: (product: Product) => React.ReactNode
  /** Infinite-scroll mode (buyer home feed). Catalogue pages use page-number
   *  pagination instead and omit these. */
  totalCount?: number
  hasMore?: boolean
  isLoadingMore?: boolean
  onLoadMore?: () => void
}

export function ProductGrid({
  products,
  columns = 4,
  renderItem,
  totalCount,
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
}: ProductGridProps) {
  const sentinelRef = useRef<HTMLDivElement>(null)
  const infinite = !!onLoadMore

  useEffect(() => {
    const el = sentinelRef.current
    if (!el || !hasMore || !onLoadMore) return
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
      <ul className={productGridClasses(columns)} aria-label="Products">
        {products.map((product) => (
          <li key={product.id} className="flex min-w-0">
            {renderItem ? (
              <Fragment>{renderItem(product)}</Fragment>
            ) : (
              <ProductCard product={product} className="w-full" />
            )}
          </li>
        ))}
        {isLoadingMore &&
          Array.from({ length: 4 }).map((_, i) => (
            <li key={`skeleton-${i}`} className="flex min-w-0">
              <div className="w-full">
                <ProductCardSkeleton />
              </div>
            </li>
          ))}
      </ul>

      {infinite && products.length > 0 && (
        <div className="flex flex-col items-center gap-1 pt-2">
          <p className="type-caption text-muted">
            Showing {products.length} of {totalCount ?? products.length} products
          </p>
          {!hasMore && <p className="type-caption text-muted">You&apos;ve reached the end</p>}
        </div>
      )}

      {infinite && hasMore && <div ref={sentinelRef} aria-hidden="true" className="h-1" />}
    </div>
  )
}
