'use client'

import Link from 'next/link'
import Image from 'next/image'
import { BadgeCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { BrandSummary } from '@/types'

type BrandTagData = Pick<BrandSummary, 'name' | 'slug' | 'logoUrl' | 'isVerified'>

/** Round brand logo, falling back to the brand's initial. Decorative — the name sits beside it. */
export function BrandLogo({ brand, size = 20, className }: { brand: Pick<BrandSummary, 'name' | 'logoUrl'>; size?: number; className?: string }) {
  return (
    <span
      className={cn('relative inline-flex flex-shrink-0 items-center justify-center overflow-hidden rounded-full border border-line bg-ivory text-forest font-[600]', className)}
      style={{ width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.5)) }}
      aria-hidden="true"
    >
      {brand.logoUrl ? (
        <Image src={brand.logoUrl} alt="" fill sizes={`${size}px`} className="object-cover" />
      ) : (
        brand.name.trim().charAt(0).toUpperCase()
      )}
    </span>
  )
}

export function VerifiedBadge({ size = 14 }: { size?: number }) {
  return (
    <>
      <BadgeCheck size={size} className="flex-shrink-0 text-forest" aria-hidden="true" />
      <span className="sr-only">Verified brand</span>
    </>
  )
}

/**
 * Small brand tag linking to the public brand storefront. Marketplace products
 * only — callers render nothing for curated products (brand null). Sits above a
 * card's stretched link (relative z-10) and navigates normally, even for guests,
 * because brand pages are public.
 */
export function BrandTag({ brand, prefix, className }: { brand: BrandTagData; prefix?: string; className?: string }) {
  return (
    <Link
      href={`/brands/${brand.slug}`}
      onClick={(e) => e.stopPropagation()}
      className={cn(
        'relative z-10 inline-flex items-center gap-1.5 min-h-11 md:min-h-8 max-w-full w-fit text-[12px] leading-[16px] text-muted hover:text-forest hover:underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest',
        className
      )}
    >
      <BrandLogo brand={brand} size={20} />
      <span className="min-w-0 truncate">
        {prefix}
        {brand.name}
      </span>
      {brand.isVerified && <VerifiedBadge size={14} />}
    </Link>
  )
}
