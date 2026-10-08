'use client'

import Link from 'next/link'
import Image from 'next/image'
import { cloudinaryFill } from '@/lib/cloudinaryImage'
import type { CategoryNode } from '@/types'

interface CategoryTileCarouselProps {
  /** The current category's name — used for the list's accessible label. */
  categoryName: string
  /** This category's real children; renders nothing when there are none. */
  subcategories: CategoryNode[]
}

/**
 * "Shop by subcategory" links for a category page. A wrapping row of white,
 * line-bordered links (44px+ targets) — no horizontal scroll carousel, no
 * curated "Trending" tile (the API ignores the category for trending). Each
 * link goes to the real subcategory page; thumbnails only when the
 * subcategory has its own photo.
 */
export function CategoryTileCarousel({ categoryName, subcategories }: CategoryTileCarouselProps) {
  if (subcategories.length === 0) return null

  return (
    <nav aria-label={`${categoryName} subcategories`} className="mt-8">
      <h2 className="type-eyebrow text-brass-dark">Shop by subcategory</h2>
      <ul className="mt-3 flex flex-wrap gap-2 lg:gap-3">
        {subcategories.map((child) => (
          <li key={child.id} className="min-w-0 max-w-full">
            <Link
              href={`/categories/${child.slug}`}
              className="flex items-center gap-3 min-h-12 max-w-full pl-2 pr-4 py-1.5 bg-white border border-line rounded-[6px] text-[14px] leading-[20px] font-[600] text-ink hover:border-forest transition-colors duration-150"
            >
              {child.heroImage ? (
                <span className="relative flex-shrink-0 w-9 h-9 overflow-hidden rounded-[4px] bg-ivory">
                  <Image src={cloudinaryFill(child.heroImage, 96, 96)} alt="" fill sizes="36px" className="object-cover" />
                </span>
              ) : (
                <span className="w-1" aria-hidden="true" />
              )}
              <span className="min-w-0 break-words">{child.name}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
