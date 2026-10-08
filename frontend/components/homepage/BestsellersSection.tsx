'use client'

import Link from 'next/link'
import { ProductCard } from '@/components/shared/ProductCard'
import { useProducts } from '@/hooks/queries/useProducts'
import { cn } from '@/lib/utils'

// ─── Bestsellers ──────────────────────────────────────────────────────────────
// Live admin-featured products (sort=featured — the same source as the navbar's
// "Bestsellers" link). 4 columns desktop / 3 tablet / 2 mobile. With four items
// the 4th card is hidden on tablet only, so no row is ever left with an orphan.
// No data (or an error) hides the whole section — never placeholder cards.

const LIMIT = 4

function cardVisibility(index: number, count: number): string {
  // Tablet shows 3 columns: drop the 4th card there when it would sit alone.
  return count === LIMIT && index === LIMIT - 1 ? 'md:hidden lg:flex' : ''
}

function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-col bg-white border border-line rounded-[6px] p-3 md:p-4 animate-pulse', className)} aria-hidden="true">
      <div className="aspect-square md:aspect-[4/3] rounded-[4px] bg-ivory" />
      <div className="h-4 bg-ivory rounded w-4/5 mt-3" />
      <div className="h-4 bg-ivory rounded w-1/3 mt-2" />
    </div>
  )
}

export function BestsellersSection() {
  const { data, isLoading, isError } = useProducts({ sort: 'featured', limit: LIMIT })
  const products = (data?.items ?? []).slice(0, LIMIT)

  if (isError || (!isLoading && products.length === 0)) return null

  return (
    <section className="bg-white sb-section" aria-labelledby="home-bestsellers-heading">
      <div className="sb-container">
        <div className="mb-6 lg:mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <p className="type-eyebrow text-brass-deep">Featured</p>
            <h2 id="home-bestsellers-heading" className="type-h2 text-ink mt-2">
              Bestsellers
            </h2>
          </div>
          <Link
            href="/search?sort=featured"
            className="inline-flex items-center min-h-11 text-[14px] leading-[20px] font-[600] text-forest underline underline-offset-4 hover:text-forest-hover"
          >
            View all bestsellers
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-5 lg:gap-6">
          {isLoading
            ? Array.from({ length: LIMIT }).map((_, i) => (
                <SkeletonCard key={i} className={cardVisibility(i, LIMIT)} />
              ))
            : products.map((product, i) => (
                <ProductCard key={product.id} product={product} className={cardVisibility(i, products.length)} />
              ))}
        </div>
      </div>
    </section>
  )
}
