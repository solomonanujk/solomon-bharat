'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useCategoryTree } from '@/hooks/queries/useCategories'
import { cloudinaryFill } from '@/lib/cloudinaryImage'
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
    <div className="flex items-center gap-4 p-3 min-h-[96px] rounded-[6px] bg-white border border-line animate-pulse" aria-hidden="true">
      <div className="w-[92px] h-[72px] flex-shrink-0" />
      <div className="flex-1">
        <div className="h-4 bg-ivory rounded w-2/3" />
      </div>
    </div>
  )
}

function CategoryCard({ category }: { category: CategoryNode }) {
  return (
    <Link
      href={`/categories/${category.slug}`}
      className="group flex items-center gap-4 p-3 min-h-[96px] rounded-[6px] bg-white border border-line transition-colors duration-150 hover:border-forest"
    >
      <div className="relative w-[92px] h-[72px] flex-shrink-0">
        {category.heroImage ? (
          <>
            {/* Back crop — tilted, white-bordered, peeking out top-right */}
            <div className="absolute top-0 right-0 w-[52px] h-[62px] rounded-[4px] bg-white border border-line p-1 rotate-[9deg]">
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
            {/* Front crop — the actual category photo, never cropped */}
            <div className="absolute bottom-0 left-0 w-[64px] h-[64px] rounded-[6px] overflow-hidden border border-line bg-ivory">
              <Image
                src={cloudinaryFill(category.heroImage, 160, 160)}
                alt={category.name}
                fill
                sizes="64px"
                className="object-contain"
              />
            </div>
          </>
        ) : (
          <div className="absolute bottom-0 left-0 w-[64px] h-[64px] rounded-[6px] bg-ivory border border-line flex items-center justify-center" aria-hidden="true">
            <span className="font-display text-[20px] font-[500] text-line select-none leading-none">
              {category.name.charAt(0)}
            </span>
          </div>
        )}
      </div>

      <div className="min-w-0">
        <p className="font-sans font-[600] text-[14px] leading-[20px] text-ink break-words">
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
    <section className="pt-6 pb-12 lg:pb-[72px] bg-ivory" aria-label="Shop by category">
      <div className="sb-container">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-5 lg:gap-6">
          {isLoading
            ? Array.from({ length: MAX_CARDS }).map((_, i) => <CategoryCardSkeleton key={i} />)
            : cards.map((category) => <CategoryCard key={category.id} category={category} />)}
        </div>
      </div>
    </section>
  )
}
