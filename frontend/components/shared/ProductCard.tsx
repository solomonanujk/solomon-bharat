'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Heart } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Product } from '@/types'
import { Price } from '@/components/ui/Price'
import { RatingSummary } from '@/components/shared/StarRating'
import { useAuth } from '@/hooks/useAuth'
import { useWishlist, useAddToWishlist, useRemoveFromWishlist } from '@/hooks/queries/useWishlist'

interface ProductCardProps {
  product: Product
  className?: string
}

/**
 * Buyer-facing product card — used across category grids, collection grids,
 * related products and the homepage. No seller/brand identity, no supplier
 * reference: image, name, admin selling price, MOQ, and a wishlist toggle only.
 */
export function ProductCard({ product, className }: ProductCardProps) {
  const { id, name, slug, adminPrice, moq, images } = product
  const imageSrc = images?.[0]?.url ?? null

  const { requireAuth, isAuthenticated } = useAuth()
  const { data: wishlist } = useWishlist(isAuthenticated)
  const isWishlisted = isAuthenticated && (wishlist?.some((w) => w.product.id === id) ?? false)
  const addToWishlist = useAddToWishlist()
  const removeFromWishlist = useRemoveFromWishlist()

  function handleToggleWishlist(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    requireAuth(() => {
      if (isWishlisted) removeFromWishlist.mutate(id)
      else addToWishlist.mutate(id)
    }, 'add_to_wishlist')
  }

  return (
    <div className={cn('group flex flex-col', className)}>
      {/* Image */}
      <Link href={`/products/${slug}`} className="relative block aspect-square overflow-hidden rounded-sm bg-[#F0EBE3]">
        {imageSrc ? (
          <Image
            src={imageSrc}
            alt={name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover group-hover:scale-[1.03] transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full bg-[#F0EBE3] flex items-center justify-center">
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true" className="text-[#C8BEAE]">
              <rect x="6" y="10" width="28" height="22" rx="1" stroke="currentColor" strokeWidth="1.5" />
              <circle cx="15" cy="18" r="3" stroke="currentColor" strokeWidth="1.5" />
              <path d="M6 26L13 20L19 25L26 18L34 26" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        )}

        {/* Wishlist toggle — top right */}
        <button
          type="button"
          aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
          onClick={handleToggleWishlist}
          disabled={addToWishlist.isPending || removeFromWishlist.isPending}
          className={cn(
            'absolute top-2 right-2 w-8 h-8 rounded-full bg-white/90 flex items-center justify-center shadow-sm transition-all duration-150 disabled:opacity-60',
            isWishlisted ? 'opacity-100' : 'sm:opacity-0 sm:group-hover:opacity-100'
          )}
        >
          <Heart
            size={13}
            className={isWishlisted ? 'text-rose-500' : 'text-muted-text'}
            fill={isWishlisted ? 'currentColor' : 'none'}
          />
        </button>
      </Link>

      {/* Info */}
      <div className="mt-2 flex flex-col gap-0.5">
        <div className="text-[16px] font-[700] font-public-sans text-primary leading-none">
          <Price amountInr={adminPrice} size="md" className="!text-[16px] !font-[700]" />
        </div>

        <Link
          href={`/products/${slug}`}
          className="text-[14px] font-[500] font-public-sans text-primary leading-snug line-clamp-2 hover:underline"
        >
          {name}
        </Link>

        <RatingSummary avgRating={product.avgRating} reviewCount={product.reviewCount} />

        <span className="text-[12px] font-public-sans text-muted-text">
          MOQ: {moq} units
        </span>
      </div>
    </div>
  )
}
