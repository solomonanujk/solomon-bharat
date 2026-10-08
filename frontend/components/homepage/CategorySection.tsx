'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useCategoryTree } from '@/hooks/queries/useCategories'
import { cloudinaryFill } from '@/lib/cloudinaryImage'
import type { CategoryNode } from '@/types'

// ─── Home categories ──────────────────────────────────────────────────────────
// The first six live level-1 categories as photographic cards: 3 columns on
// desktop, 2 on tablet and mobile. Each card uses the category's own hero image
// from the API; without one it gets a neutral ivory placeholder — never a stock
// photo that could be mistaken for inventory. Counts only when the API has them.

const MAX_CATEGORIES = 6

function CategoryCardSkeleton() {
  return (
    <div className="bg-white border border-line rounded-[6px] overflow-hidden animate-pulse" aria-hidden="true">
      <div className="aspect-[3/2] bg-ivory" />
      <div className="px-4 py-3">
        <div className="h-5 bg-ivory rounded w-2/3" />
      </div>
    </div>
  )
}

function HomeCategoryCard({ category }: { category: CategoryNode }) {
  const count = category.productCount ?? 0

  return (
    <Link
      href={`/categories/${category.slug}`}
      className="group flex flex-col h-full bg-white border border-line rounded-[6px] overflow-hidden transition-colors duration-150 hover:border-forest"
    >
      <div className="relative aspect-[3/2] bg-ivory">
        {category.heroImage ? (
          <Image
            src={cloudinaryFill(category.heroImage, 720, 480)}
            alt={category.name}
            fill
            sizes="(max-width: 1023px) 50vw, 360px"
            className="object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center" aria-hidden="true">
            <span className="font-display text-[36px] leading-none text-line select-none">
              {category.name.charAt(0)}
            </span>
          </div>
        )}
      </div>
      <div className="px-3 py-3 md:px-4 flex-1">
        <p className="font-display font-[500] text-[18px] leading-[24px] text-ink break-words">{category.name}</p>
        {count > 0 && (
          <p className="text-[12px] leading-[18px] text-muted mt-1">
            {count} {count === 1 ? 'product' : 'products'}
          </p>
        )}
      </div>
    </Link>
  )
}

export function CategorySection() {
  const { data: tree = [], isLoading, isError } = useCategoryTree()
  const categories = tree.filter((c) => c.level === 1).slice(0, MAX_CATEGORIES)

  if (isError || (!isLoading && categories.length === 0)) return null

  return (
    <section id="categories" className="bg-ivory sb-section" aria-labelledby="home-categories-heading">
      <div className="sb-container">
        <div className="mb-6 lg:mb-8 max-w-[660px]">
          <p className="type-eyebrow text-brass-dark">Browse by category</p>
          <h2 id="home-categories-heading" className="type-h2 text-ink mt-2">
            Featured categories
          </h2>
          <p className="type-body text-muted mt-3">
            Explore Indian-made products, organised by category.
          </p>
        </div>

        <ul className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-5 lg:gap-6">
          {isLoading
            ? Array.from({ length: MAX_CATEGORIES }).map((_, i) => (
                <li key={i}>
                  <CategoryCardSkeleton />
                </li>
              ))
            : categories.map((category) => (
                <li key={category.id}>
                  <HomeCategoryCard category={category} />
                </li>
              ))}
        </ul>
      </div>
    </section>
  )
}
