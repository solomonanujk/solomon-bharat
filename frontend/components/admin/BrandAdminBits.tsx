'use client'

import Link from 'next/link'
import { Store } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AdminProductBrandFields } from '@/types/brand-admin'

type BrandRef = NonNullable<AdminProductBrandFields['brand']>

/** Small "Marketplace · Brand" pill; renders nothing without a brand. */
export function BrandPill({ brand, className }: { brand: BrandRef | null | undefined; className?: string }) {
  if (!brand) return null
  const suspended = brand.status === 'SUSPENDED'
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-[600] font-sans whitespace-nowrap',
        suspended ? 'bg-red-50 text-error' : 'bg-selected text-forest',
        className,
      )}
    >
      <Store size={10} aria-hidden="true" />
      {brand.name}
      {suspended ? ' (suspended)' : ''}
    </span>
  )
}

/** Explains that a marketplace brand owns its product's price. */
export function BrandOwnsPriceNotice({ brand }: { brand: BrandRef }) {
  return (
    <div className="rounded-xl border border-line bg-ivory px-5 py-4" role="note">
      <p className="text-[13.5px] font-sans text-ink">
        This product belongs to the marketplace brand <strong>{brand.name}</strong>. The brand sets and changes its own
        price, so admin pricing is not available here. You can still unpublish the product, or{' '}
        <Link href="/admin/brands" className="text-forest underline underline-offset-2">suspend the brand</Link>.
      </p>
    </div>
  )
}
