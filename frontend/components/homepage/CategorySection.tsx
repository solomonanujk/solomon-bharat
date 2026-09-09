'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useCategoryTree } from '@/hooks/queries/useCategories'
import { cn } from '@/lib/utils'

const SCROLL_BY = 252 // card width 240 + gap 12
const AUTO_ADVANCE_MS = 4000
const FADE_MS = 250

function PillSkeleton() {
  return <div className="h-10 w-28 rounded-full bg-muted-bg animate-pulse flex-shrink-0" />
}

function CategorySkeleton() {
  return (
    <div className="flex flex-col animate-pulse flex-shrink-0 w-[240px]">
      <div className="aspect-square rounded-[6px] bg-muted-bg" />
      <div className="mt-3">
        <div className="h-4 bg-muted-bg rounded w-3/4" />
        <div className="h-3 bg-muted-bg rounded w-1/3 mt-2" />
      </div>
    </div>
  )
}

export function CategorySection() {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const { data: tree = [], isLoading } = useCategoryTree()
  const level1 = tree.filter((c) => (c.children?.length ?? 0) > 0)

  const [activeIndex, setActiveIndex] = useState(0)
  const [visible, setVisible] = useState(true)
  const activeIndexRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    activeIndexRef.current = activeIndex
  }, [activeIndex])

  function goTo(index: number) {
    setVisible(false)
    setTimeout(() => {
      setActiveIndex(index)
      setVisible(true)
      scrollRef.current?.scrollTo({ left: 0 })
    }, FADE_MS)
  }

  function restartTimer(count: number) {
    if (timerRef.current) clearInterval(timerRef.current)
    if (count < 2) return
    timerRef.current = setInterval(() => {
      goTo((activeIndexRef.current + 1) % count)
    }, AUTO_ADVANCE_MS)
  }

  useEffect(() => {
    restartTimer(level1.length)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level1.length])

  function handlePillClick(index: number) {
    if (index === activeIndex) return
    goTo(index)
    restartTimer(level1.length)
  }

  const activeCategory = level1[activeIndex]
  const cards = activeCategory?.children ?? []

  const sync = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 4)
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4)
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    // Wait one frame so the DOM has settled after cards render
    const raf = requestAnimationFrame(sync)
    el.addEventListener('scroll', sync, { passive: true })
    window.addEventListener('resize', sync)
    return () => {
      cancelAnimationFrame(raf)
      el.removeEventListener('scroll', sync)
      window.removeEventListener('resize', sync)
    }
  }, [sync, isLoading, cards.length])

  function scrollLeft() {
    scrollRef.current?.scrollBy({ left: -SCROLL_BY, behavior: 'smooth' })
  }
  function scrollRight() {
    scrollRef.current?.scrollBy({ left: SCROLL_BY, behavior: 'smooth' })
  }

  return (
    <section className="py-12 bg-bg tracking-[0.02em]">
      <div className="max-w-[1400px] mx-auto px-4 lg:px-10">

        {/* Header */}
        <div className="mb-8">
          <p className="font-public-sans text-[12px] font-[600] text-accent uppercase tracking-[0.08em] mb-3">
            Browse by Category
          </p>
          <h2 className="font-playfair font-[500] text-primary leading-[1.2] text-[28px] lg:text-[32px]">
            Featured Category
          </h2>
        </div>

        {/* Level 1 pills */}
        <div className="flex gap-2.5 overflow-x-auto scrollbar-none pb-1 mb-8">
          {isLoading
            ? Array.from({ length: 8 }).map((_, i) => <PillSkeleton key={i} />)
            : level1.map((category, i) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => handlePillClick(i)}
                  className={cn(
                    'flex-shrink-0 px-5 py-2.5 rounded-full border font-public-sans text-[14px] font-[600] whitespace-nowrap transition-colors duration-200',
                    i === activeIndex
                      ? 'bg-primary border-primary text-white'
                      : 'bg-transparent border-border-warm text-primary hover:border-primary/40'
                  )}
                >
                  {category.name}
                </button>
              ))}
        </div>

        {/* Carousel */}
        <div className="flex items-center gap-3">

          {/* Left arrow */}
          <button
            type="button"
            onClick={scrollLeft}
            disabled={!canScrollLeft}
            aria-label="Scroll categories left"
            className="flex-shrink-0 text-primary disabled:opacity-20 disabled:cursor-not-allowed transition-opacity duration-200 hover:text-primary/70"
          >
            <ChevronLeft size={28} aria-hidden="true" />
          </button>

          {/* Scroll track */}
          <div
            ref={scrollRef}
            className="flex flex-1 gap-3 overflow-x-auto scrollbar-none transition-all ease-out"
            style={{
              opacity: visible ? 1 : 0,
              transform: visible ? 'translateY(0)' : 'translateY(16px)',
              transitionDuration: `${FADE_MS}ms`,
            }}
          >
            {isLoading
              ? Array.from({ length: 6 }).map((_, i) => <CategorySkeleton key={i} />)
              : cards.map((category) => (
                  <Link
                    key={category.slug}
                    href={`/categories/${category.slug}`}
                    className="group flex flex-col flex-shrink-0 w-[240px]"
                  >
                    <div className="aspect-square overflow-hidden rounded-[6px] bg-muted-bg relative">
                      {category.heroImage ? (
                        <Image
                          src={category.heroImage}
                          alt={category.name}
                          fill
                          sizes="240px"
                          className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-[#F0EBE3]">
                          <span className="font-playfair text-[36px] font-[500] text-[#C8BEAE] select-none leading-none">
                            {category.name.charAt(0)}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="mt-3">
                      <p className="font-public-sans font-[700] text-primary text-[14px] leading-snug">
                        {category.name}
                      </p>
                      {(category.productCount ?? 0) > 0 && (
                        <p className="font-public-sans text-[13px] text-muted-text mt-0.5">
                          {category.productCount} products
                        </p>
                      )}
                    </div>
                  </Link>
                ))}
          </div>

          {/* Right arrow */}
          <button
            type="button"
            onClick={scrollRight}
            disabled={!canScrollRight}
            aria-label="Scroll categories right"
            className="flex-shrink-0 text-primary disabled:opacity-20 disabled:cursor-not-allowed transition-opacity duration-200 hover:text-primary/70"
          >
            <ChevronRight size={28} aria-hidden="true" />
          </button>

        </div>
      </div>
    </section>
  )
}
