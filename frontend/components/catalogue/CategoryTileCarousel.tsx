'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cloudinaryFill } from '@/lib/cloudinaryImage'
import type { CategoryNode } from '@/types'

const PAGE_SIZE = 8

// Same real, backend-supported sort modes as the NavBar's curated-links row
// (components/shared/NavBar.tsx's CURATED_LINKS) — reused verbatim so the
// labels stay consistent site-wide, just scoped to this category via `sort`.
const CURATED_SORTS = [
  { sort: 'featured', label: 'Bestsellers' },
  { sort: 'newest', label: 'New products' },
  { sort: 'trending', label: 'Trending' },
] as const

// ─── Tile — identical card to the buyer homepage's category grid
// (components/homepage/BuyerCategoryGrid.tsx's `CategoryCard`): the real hero
// photo layered twice — a small tilted, white-bordered back crop, and the
// full, uncropped front photo — rather than fabricating a second photo.

function Tile({ href, image, label }: { href: string; image: string | null; label: string }) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-4 p-3.5 rounded-lg bg-muted-bg hover:bg-[#EFE7D8] transition-colors"
    >
      <div className="relative w-[92px] h-[72px] flex-shrink-0">
        {image ? (
          <>
            {/* Back crop — tilted, white-bordered, peeking out top-right */}
            <div className="absolute top-0 right-0 w-[52px] h-[62px] rounded-[4px] bg-white p-1 shadow-sm rotate-[9deg]">
              <div className="relative w-full h-full rounded-[2px] overflow-hidden">
                <Image src={image} alt="" fill sizes="52px" className="object-cover scale-[1.6]" aria-hidden="true" />
              </div>
            </div>
            {/* Front crop — the actual photo, never cropped */}
            <div className="absolute bottom-0 left-0 w-[64px] h-[64px] rounded-[6px] overflow-hidden shadow-sm bg-[#EDE4D3]">
              <Image
                src={cloudinaryFill(image, 160, 160)}
                alt={label}
                fill
                sizes="64px"
                className="object-contain transition-transform duration-300 group-hover:scale-[1.04]"
              />
            </div>
          </>
        ) : (
          <div className="absolute bottom-0 left-0 w-[64px] h-[64px] rounded-[6px] bg-[#EDE4D3] flex items-center justify-center">
            <span className="font-playfair text-[20px] font-[400] text-[#C8BEAE] select-none leading-none">
              {label.charAt(0)}
            </span>
          </div>
        )}
      </div>

      <div className="min-w-0">
        <p className="font-public-sans font-[600] text-[15px] text-primary leading-snug">
          {label}
        </p>
      </div>
    </Link>
  )
}

interface CategoryTileCarouselProps {
  categoryName: string
  categorySlug: string
  /** This category's own real photo — reused on the 3 curated sort tiles below
   *  too (they're real, backend-supported browse modes *of this category*,
   *  just not their own taxonomy nodes, so they don't have their own photo). */
  categoryImage: string | null
  subcategories: CategoryNode[]
}

/** Faire-style tile section: category name + page arrows above a 2-row grid of
 *  curated sort shortcuts and this category's real subcategories, each a
 *  polaroid-collage tile linking to a real, filterable destination. More than
 *  one "page" worth (8) paginates via the arrows. */
export function CategoryTileCarousel({ categoryName, categorySlug, categoryImage, subcategories }: CategoryTileCarouselProps) {
  const [page, setPage] = useState(0)

  const tiles = [
    ...CURATED_SORTS.map((t) => ({
      key: t.sort,
      href: `/categories/${categorySlug}?sort=${t.sort}`,
      image: categoryImage,
      label: t.label,
    })),
    ...subcategories.map((child) => ({
      key: child.id,
      href: `/categories/${child.slug}`,
      image: child.heroImage,
      label: child.name,
    })),
  ]
  const totalPages = Math.ceil(tiles.length / PAGE_SIZE)
  const visible = tiles.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-playfair text-[26px] sm:text-[32px] font-[500] text-primary leading-tight">
          {categoryName}
        </h1>
        {totalPages > 1 && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              aria-label="Previous"
              className="w-9 h-9 rounded-full border border-border-warm flex items-center justify-center text-muted-text hover:text-primary hover:border-primary transition-colors disabled:opacity-40 disabled:pointer-events-none"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page === totalPages - 1}
              aria-label="Next"
              className="w-9 h-9 rounded-full border border-border-warm flex items-center justify-center text-muted-text hover:text-primary hover:border-primary transition-colors disabled:opacity-40 disabled:pointer-events-none"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {visible.map((t) => (
          <Tile key={t.key} href={t.href} image={t.image} label={t.label} />
        ))}
      </div>
    </div>
  )
}
