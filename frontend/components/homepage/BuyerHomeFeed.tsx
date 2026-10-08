'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BuyerCategoryGrid } from '@/components/homepage/BuyerCategoryGrid'
import { ProductGrid } from '@/components/catalogue/ProductGrid'
import { ProductCard, type ProductCardData } from '@/components/shared/ProductCard'
import { useBuyerProfile } from '@/hooks/queries/useBuyerProfile'
import { useInfiniteRecommendations } from '@/hooks/queries/useProducts'
import { useRecentlyViewed, type RecentProduct } from '@/hooks/useRecentlyViewed'

// ─── Recently viewed carousel ──────────────────────────────────────────────────
// 6 cards visible per row at desktop width (3 tablet, 2 mobile); chevrons page
// one row at a time. Reuses the shared ProductCard (wishlist + cart quick-add included)
// rather than a bespoke card, so this list behaves identically to every other
// product grid in the app.

const VISIBLE_CARDS = 6

// Guards against entries written to localStorage before `moq`/`avgRating`/
// `reviewCount` were part of the tracked shape — an older cached entry can be
// missing these keys even though the current `RecentProduct` type requires them.
function toProductCardData(product: RecentProduct): ProductCardData {
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    adminPrice: product.price,
    moq: product.moq || 1,
    images: product.imageUrl ? [{ id: product.id, url: product.imageUrl, sortOrder: 0 }] : [],
    leadTime: product.leadTime,
    avgRating: product.avgRating ?? null,
    reviewCount: product.reviewCount ?? 0,
    // Not tracked in the "recently viewed" localStorage cache — same treatment as
    // the other legacy-entry fallbacks above.
    isBestseller: false,
  }
}

function RecentlyViewedCard({ product }: { product: RecentProduct }) {
  return (
    // Widths track the row gaps below (12 / 20 / 24px) so exactly 2 / 3 / 6 fit.
    <div className="flex-shrink-0 w-[calc((100%-12px)/2)] md:w-[calc((100%-40px)/3)] lg:w-[calc((100%-120px)/6)]">
      <ProductCard product={toProductCardData(product)} />
    </div>
  )
}

function RecentlyViewedCarousel() {
  const { products } = useRecentlyViewed()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const sync = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 4)
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4)
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const raf = requestAnimationFrame(sync)
    el.addEventListener('scroll', sync, { passive: true })
    window.addEventListener('resize', sync)
    return () => {
      cancelAnimationFrame(raf)
      el.removeEventListener('scroll', sync)
      window.removeEventListener('resize', sync)
    }
  }, [sync, products.length])

  function scrollByPage(direction: 1 | -1) {
    const el = scrollRef.current
    if (!el) return
    el.scrollBy({ left: direction * el.clientWidth, behavior: 'smooth' })
  }

  if (products.length === 0) return null

  const showPager = products.length > VISIBLE_CARDS || canScrollLeft || canScrollRight
  const pagerButton =
    'w-11 h-11 rounded-full border border-line bg-white flex items-center justify-center text-forest transition-colors duration-150'

  return (
    <section className="sb-section bg-ivory border-t border-line" aria-labelledby="recently-viewed-heading">
      <div className="sb-container">
        <div className="flex items-center justify-between gap-4 mb-6 lg:mb-8">
          <h2 id="recently-viewed-heading" className="type-h2 text-ink">
            Recently viewed
          </h2>

          {showPager && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => scrollByPage(-1)}
                disabled={!canScrollLeft}
                aria-label="Show previous recently viewed products"
                className={cn(pagerButton, canScrollLeft ? 'hover:bg-ivory' : 'opacity-40 cursor-not-allowed')}
              >
                <ChevronLeft size={18} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => scrollByPage(1)}
                disabled={!canScrollRight}
                aria-label="Show more recently viewed products"
                className={cn(pagerButton, canScrollRight ? 'hover:bg-ivory' : 'opacity-40 cursor-not-allowed')}
              >
                <ChevronRight size={18} aria-hidden="true" />
              </button>
            </div>
          )}
        </div>

        <div ref={scrollRef} className="flex gap-3 md:gap-5 lg:gap-6 overflow-x-auto scrollbar-none scroll-smooth">
          {products.map((p) => (
            <RecentlyViewedCard key={p.id} product={p} />
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Ideas for you — infinite-scroll personalized feed ─────────────────────────

function IdeasForYouSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 md:gap-5 lg:gap-6" aria-hidden="true">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="bg-white border border-line rounded-[6px] p-3 md:p-4 animate-pulse">
          <div className="aspect-square md:aspect-[4/3] rounded-[4px] bg-ivory" />
          <div className="h-4 bg-ivory rounded w-4/5 mt-3" />
          <div className="h-4 bg-ivory rounded w-1/3 mt-2" />
        </div>
      ))}
    </div>
  )
}

// ─── Page ───────────────────────────────────────────────────────────────────────
// Replaces the marketing homepage for a signed-in BUYER at "/": greeting, category
// quick-links, recently viewed, then an infinite-scroll personalized product feed
// backed by GET /products/recommendations — the one deliberate exception to the
// "no unscoped browsing" rule (see products.service.ts getRecommendationsForBuyer).

export function BuyerHomeFeed() {
  const { data: profile } = useBuyerProfile()
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteRecommendations(true)

  const products = data?.pages.flatMap((p) => p.items) ?? []
  const total = data?.pages[0]?.total ?? 0

  return (
    <>
      <section className="pt-12 lg:pt-[72px] pb-2 bg-ivory">
        <div className="sb-container">
          <h1 className="type-h1 text-ink">
            Welcome back{profile?.contactName ? `, ${profile.contactName}` : ''}
          </h1>
        </div>
      </section>

      <BuyerCategoryGrid />
      <RecentlyViewedCarousel />

      <section className="sb-section bg-ivory border-t border-line" aria-labelledby="ideas-for-you-heading">
        <div className="sb-container">
          <h2 id="ideas-for-you-heading" className="type-h2 text-ink mb-6 lg:mb-8">
            Ideas for you
          </h2>
          {isLoading ? (
            <IdeasForYouSkeleton />
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
      </section>
    </>
  )
}
