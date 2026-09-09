'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useCategoryTree } from '@/hooks/queries/useCategories'
import type { CategoryNode } from '@/types'

// ─── Buyer home feed category grid ─────────────────────────────────────────────
// Faire's signed-in "Welcome back" homepage shows a flat grid of subcategories
// (not the tabbed level1->level2 carousel used on the guest marketing homepage).
// Each card layers the category's real hero photo twice — a large front crop and
// a smaller white-bordered, tilted back crop — to get the same polaroid-stack
// look without inventing a second, unrelated product photo we don't have.

const MAX_CARDS = 8

function CategoryCardSkeleton() {
  return (
    <div className="flex items-center gap-4 p-3.5 rounded-lg bg-muted-bg animate-pulse">
      <div className="w-[92px] h-[72px] flex-shrink-0" />
      <div className="flex-1">
        <div className="h-4 bg-border-warm rounded w-2/3" />
      </div>
    </div>
  )
}

function CategoryCard({ category }: { category: CategoryNode }) {
  return (
    <Link
      href={`/categories/${category.slug}`}
      className="group flex items-center gap-4 p-3.5 rounded-lg bg-muted-bg hover:bg-[#EFE7D8] transition-colors"
    >
      <div className="relative w-[92px] h-[72px] flex-shrink-0">
        {category.heroImage ? (
          <>
            {/* Back crop — tilted, white-bordered, peeking out top-right */}
            <div className="absolute top-0 right-0 w-[52px] h-[62px] rounded-[4px] bg-white p-1 shadow-sm rotate-[9deg]">
              <div className="relative w-full h-full rounded-[2px] overflow-hidden">
                <Image
                  src={category.heroImage}
                  alt=""
                  fill
                  sizes="52px"
                  className="object-cover scale-[1.6]"
                  aria-hidden="true"
                />
              </div>
            </div>
            {/* Front crop */}
            <div className="absolute bottom-0 left-0 w-[64px] h-[64px] rounded-[6px] overflow-hidden shadow-sm">
              <Image
                src={category.heroImage}
                alt={category.name}
                fill
                sizes="64px"
                className="object-cover transition-transform duration-300 group-hover:scale-[1.04]"
              />
            </div>
          </>
        ) : (
          <div className="absolute bottom-0 left-0 w-[64px] h-[64px] rounded-[6px] bg-[#EDE4D3] flex items-center justify-center">
            <span className="font-playfair text-[20px] font-[500] text-[#C8BEAE] select-none leading-none">
              {category.name.charAt(0)}
            </span>
          </div>
        )}
      </div>

      <div className="min-w-0">
        <p className="font-public-sans font-[700] text-[17px] text-primary leading-snug">
          {category.name}
        </p>
      </div>
    </Link>
  )
}

export function BuyerCategoryGrid() {
  const { data: tree = [], isLoading } = useCategoryTree()
  const level2 = tree.flatMap((l1) => l1.children ?? [])
  const cards = level2.slice(0, MAX_CARDS)

  if (!isLoading && cards.length === 0) return null

  return (
    <section className="pt-6 pb-10 bg-bg tracking-[0.02em]">
      <div className="max-w-[1400px] mx-auto px-4 lg:px-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {isLoading
            ? Array.from({ length: MAX_CARDS }).map((_, i) => <CategoryCardSkeleton key={i} />)
            : cards.map((category) => <CategoryCard key={category.id} category={category} />)}
        </div>
      </div>
    </section>
  )
}
