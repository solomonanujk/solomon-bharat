import Link from 'next/link'
import { Store } from 'lucide-react'
import { BrandLogo } from '@/components/brands/BrandTag'
import type { CartItemBrand } from '@/types/brand-orders'

/** Heading for a cart/checkout group: brand logo + link, or "Solomon Bharat" for curated lines. */
export function CartGroupHeader({ brand }: { brand: CartItemBrand | null }) {
  return (
    <div className="flex items-center gap-2 pt-4 pb-1">
      {brand ? (
        <>
          <BrandLogo brand={{ name: brand.name, logoUrl: brand.logoUrl ?? null }} size={28} />
          <Link
            href={`/brands/${brand.slug}`}
            className="text-[14px] font-[600] font-sans text-ink hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-forest"
          >
            {brand.name}
          </Link>
        </>
      ) : (
        <>
          <Store size={15} className="text-brass-deep flex-shrink-0" aria-hidden="true" />
          <span className="text-[14px] font-[600] font-sans text-ink">Solomon Bharat</span>
        </>
      )}
    </div>
  )
}
