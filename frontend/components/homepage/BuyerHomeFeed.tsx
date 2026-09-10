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
// Exactly 6 cards visible per row at desktop width; chevrons page one row at a
// time. Reuses the shared ProductCard (wishlist + cart quick-add included)
// rather than a bespoke card, so this list behaves identically to every other
// product grid in the app.

const VISIBLE_CARDS = 6
const CARD_GAP_PX = 16

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
  }
}

function RecentlyViewedCard({ product }: { product: RecentProduct }) {
  return (
    <div
      className="flex-shrink-0"
      style={{ width: `calc((100% - ${(VISIBLE_CARDS - 1) * CARD_GAP_PX}px) / ${VISIBLE_CARDS})` }}
    >
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

  return (
    <section className="py-10 bg-bg border-t border-border-warm">
      <div className="max-w-[1400px] mx-auto px-4 lg:px-10">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-playfair font-[400] text-primary text-[22px] leading-tight">
            Recently viewed
          </h2>

          {products.length > VISIBLE_CARDS && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => scrollByPage(-1)}
                disabled={!canScrollLeft}
                aria-label="Show previous recently viewed products"
                className={cn(
                  'w-9 h-9 rounded-full border border-border-warm flex items-center justify-center text-primary transition-colors',
                  canScrollLeft ? 'hover:bg-muted-bg' : 'opacity-30 cursor-not-allowed'
                )}
              >
                <ChevronLeft size={16} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => scrollByPage(1)}
                disabled={!canScrollRight}
                aria-label="Show more recently viewed products"
                className={cn(
                  'w-9 h-9 rounded-full border border-border-warm flex items-center justify-center text-primary transition-colors',
                  canScrollRight ? 'hover:bg-muted-bg' : 'opacity-30 cursor-not-allowed'
                )}
              >
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            </div>
          )}
        </div>

        <div ref={scrollRef} className="flex gap-4 overflow-x-auto scrollbar-none scroll-smooth">
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
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4 md:gap-6">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="animate-pulse">
          <div className="aspect-square rounded-sm bg-muted-bg" />
          <div className="h-4 bg-muted-bg rounded w-1/3 mt-2" />
          <div className="h-3 bg-muted-bg rounded w-4/5 mt-1.5" />
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
      <section className="pt-10 pb-2 bg-bg">
        <div className="max-w-[1400px] mx-auto px-4 lg:px-10">
          <h1 className="font-playfair font-[400] text-primary text-[20px] lg:text-[24px] leading-tight">
            Welcome back{profile?.contactName ? `, ${profile.contactName}` : ''}
          </h1>
        </div>
      </section>

      <BuyerCategoryGrid />
      <RecentlyViewedCarousel />

      <section className="py-10 bg-bg border-t border-border-warm">
        <div className="max-w-[1400px] mx-auto px-4 lg:px-10">
          <h2 className="font-playfair font-[400] text-primary text-[22px] leading-tight mb-6">
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
