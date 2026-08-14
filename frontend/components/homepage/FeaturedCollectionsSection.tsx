'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react'
import { useFeaturedCollections } from '@/hooks/queries/useCollections'

const SCROLL_BY = 332 // card width 320 + gap 12

function CollectionSkeleton() {
  return (
    <div className="flex flex-col bg-surface border border-border-warm rounded overflow-hidden animate-pulse flex-shrink-0 w-[320px]">
      <div className="aspect-[16/10] bg-muted-bg" />
      <div className="p-4">
        <div className="h-5 bg-muted-bg rounded w-3/4" />
        <div className="h-3 bg-muted-bg rounded w-full mt-2" />
      </div>
    </div>
  )
}

/** Editorial collection-card carousel, styled consistently with CategorySection. */
export function FeaturedCollectionsSection() {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const { data: collections = [], isLoading } = useFeaturedCollections()

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
  }, [sync, isLoading, collections.length])

  function scrollLeft() {
    scrollRef.current?.scrollBy({ left: -SCROLL_BY, behavior: 'smooth' })
  }
  function scrollRight() {
    scrollRef.current?.scrollBy({ left: SCROLL_BY, behavior: 'smooth' })
  }

  if (!isLoading && collections.length === 0) return null

  return (
    <section className="py-12 bg-surface border-y border-border-warm">
      <div className="max-w-[1400px] mx-auto px-4 lg:px-10">
        {/* Header */}
        <div className="flex items-baseline justify-between mb-10">
          <div>
            <p className="font-public-sans text-[12px] font-[600] text-accent uppercase tracking-[0.08em] mb-3">
              Curated by Solomon Bharat
            </p>
            <h2 className="font-playfair font-[500] text-primary leading-[1.2] text-[28px] lg:text-[32px]">
              Featured Collections
            </h2>
          </div>
          <Link
            href="/collections"
            className="hidden sm:inline-flex items-center gap-1 font-public-sans text-[13px] font-[600] text-muted-text hover:text-primary transition-colors flex-shrink-0 ml-6"
          >
            View all <ArrowRight size={12} aria-hidden="true" />
          </Link>
        </div>

        {/* Carousel */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={scrollLeft}
            disabled={!canScrollLeft}
            aria-label="Scroll collections left"
            className="flex-shrink-0 text-primary disabled:opacity-20 disabled:cursor-not-allowed transition-opacity duration-200 hover:text-primary/70"
          >
            <ChevronLeft size={28} aria-hidden="true" />
          </button>

          <div ref={scrollRef} className="flex flex-1 gap-3 overflow-x-auto scrollbar-none">
            {isLoading
              ? Array.from({ length: 4 }).map((_, i) => <CollectionSkeleton key={i} />)
              : collections.map((collection) => (
                  <Link
                    key={collection.id}
                    href={`/collections/${collection.slug}`}
                    className="group flex flex-col bg-bg border border-border-warm rounded overflow-hidden hover:border-primary/30 hover:shadow-[0_4px_20px_rgba(26,26,26,0.06)] transition-all duration-200 flex-shrink-0 w-[320px]"
                  >
                    <div className="aspect-[16/10] overflow-hidden bg-muted-bg relative">
                      {collection.heroImage ? (
                        <Image
                          src={collection.heroImage}
                          alt={collection.name}
                          fill
                          sizes="320px"
                          className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-[#F0EBE3]">
                          <span className="font-playfair text-[36px] font-[500] text-[#C8BEAE] select-none leading-none">
                            {collection.name.charAt(0)}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <p className="font-playfair font-[500] text-primary text-[17px] leading-snug">
                        {collection.name}
                      </p>
                      {collection.editorialIntro && (
                        <p className="font-public-sans text-[12px] text-muted-text mt-1.5 line-clamp-2 leading-[1.5]">
                          {collection.editorialIntro}
                        </p>
                      )}
                    </div>
                  </Link>
                ))}
          </div>

          <button
            type="button"
            onClick={scrollRight}
            disabled={!canScrollRight}
            aria-label="Scroll collections right"
            className="flex-shrink-0 text-primary disabled:opacity-20 disabled:cursor-not-allowed transition-opacity duration-200 hover:text-primary/70"
          >
            <ChevronRight size={28} aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>
  )
}
