'use client'

import Link from 'next/link'
import { Heart, ShoppingCart } from 'lucide-react'
import { toast } from 'sonner'
import { AccountPageWrapper } from '@/components/shared/AccountPageWrapper'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/shared/EmptyState'
import { RatingSummary } from '@/components/shared/StarRating'
import { useFormatPrice } from '@/components/ui/Price'
import { useWishlist, useRemoveFromWishlist } from '@/hooks/queries/useWishlist'
import { useCartStore } from '@/lib/store/useCartStore'
import type { WishlistEntry } from '@/types'

// A single wishlist view — the "Saved Brands" tab this page used to have is
// gone entirely (this product never shows brand/seller identity to buyers).

function SkeletonCard() {
  return (
    <div className="bg-surface border border-border-warm rounded overflow-hidden animate-pulse">
      <div className="aspect-square bg-muted-bg" />
      <div className="p-3 space-y-2">
        <div className="h-3 bg-muted-bg rounded w-3/4" />
        <div className="h-3 bg-muted-bg rounded w-1/2" />
        <div className="h-4 bg-muted-bg rounded w-1/3 mt-2" />
      </div>
    </div>
  )
}

function WishlistCard({ entry }: { entry: WishlistEntry }) {
  const { product } = entry
  const fmt = useFormatPrice()
  const addItem = useCartStore((s) => s.addItem)
  const removeFromWishlist = useRemoveFromWishlist()

  function handleAddToCart() {
    addItem({
      productId: product.id,
      productSlug: product.slug,
      productName: product.name,
      image: product.imageUrl ?? '',
      quantity: product.moq,
      unitAdminPriceInr: product.adminPrice,
      moq: product.moq,
      leadTime: product.leadTime,
    })
    toast.success(`${product.name} added to cart`, { description: `Qty: ${product.moq}` })
  }

  return (
    <div className="bg-surface border border-border-warm rounded overflow-hidden flex flex-col group">
      <Link href={`/products/${product.slug}`} className="relative block aspect-square overflow-hidden bg-muted-bg">
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.imageUrl}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[11px] font-public-sans text-muted-text">
            No image
          </div>
        )}
        <button
          type="button"
          aria-label="Remove from wishlist"
          onClick={(e) => { e.preventDefault(); removeFromWishlist.mutate(product.id) }}
          disabled={removeFromWishlist.isPending}
          className="absolute top-2 right-2 w-8 h-8 rounded-full bg-white/90 flex items-center justify-center shadow-sm text-accent hover:text-error transition-colors disabled:opacity-60"
        >
          <Heart size={14} fill="currentColor" aria-hidden="true" />
        </button>
      </Link>

      <div className="p-3 flex flex-col flex-1">
        <Link
          href={`/products/${product.slug}`}
          className="text-[14px] font-[500] font-public-sans text-primary leading-snug line-clamp-2 hover:underline"
        >
          {product.name}
        </Link>
        <p className="text-[16px] font-[700] font-public-sans text-primary mt-1">
          {fmt(product.adminPrice)}
        </p>

        <RatingSummary avgRating={product.avgRating} reviewCount={product.reviewCount} className="mt-1" />

        <p className="text-[12px] font-public-sans text-muted-text mt-0.5">
          MOQ {product.moq}
        </p>

        <Button
          variant="ghost"
          size="sm"
          className="mt-3 gap-1.5 w-full"
          onClick={handleAddToCart}
        >
          <ShoppingCart size={13} aria-hidden="true" />
          Add to Cart
        </Button>
      </div>
    </div>
  )
}

export default function WishlistPage() {
  const { data: wishlist = [], isLoading } = useWishlist()

  return (
    <AccountPageWrapper
      title="Wishlist"
      description={isLoading ? 'Loading…' : `${wishlist.length} saved product${wishlist.length === 1 ? '' : 's'}`}
    >
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : wishlist.length === 0 ? (
        <EmptyState
          title="No saved products yet"
          description="While browsing, save products you're considering to build a shortlist for sourcing."
          action={{ label: 'Explore products', onClick: () => { window.location.href = '/' } }}
        />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
          {wishlist.map((entry) => (
            <WishlistCard key={entry.id} entry={entry} />
          ))}
        </div>
      )}
    </AccountPageWrapper>
  )
}
