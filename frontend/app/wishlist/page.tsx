'use client'

import Link from 'next/link'
import { Heart, ShoppingCart } from 'lucide-react'
import { AccountPageWrapper } from '@/components/shared/AccountPageWrapper'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/shared/EmptyState'
import { RatingSummary } from '@/components/shared/StarRating'
import { useFormatPrice } from '@/components/ui/Price'
import { useState } from 'react'
import { useWishlist, useRemoveFromWishlist } from '@/hooks/queries/useWishlist'
import { useFollowedBrands } from '@/hooks/queries/useBrands'
import { BrandLogo, BrandTag, VerifiedBadge } from '@/components/brands/BrandTag'
import { cn } from '@/lib/utils'
import { useCartStore } from '@/lib/store/useCartStore'
import { cloudinaryFill } from '@/lib/cloudinaryImage'
import type { WishlistEntry } from '@/types'

// Two tabs: saved products, and the marketplace brands the buyer follows.
// Curated products carry no brand; only marketplace products show a brand tag.

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
      brand: product.brand
        ? { id: product.brand.id, name: product.brand.name, slug: product.brand.slug, minOrderValueInr: product.brand.minOrderValueInr, logoUrl: product.brand.logoUrl ?? null }
        : null,
    })
  }

  return (
    <div className="bg-surface border border-border-warm rounded overflow-hidden flex flex-col group">
      <Link href={`/products/${product.slug}`} className="relative block aspect-square overflow-hidden bg-muted-bg">
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cloudinaryFill(product.imageUrl, 700, 700)}
            alt={product.name}
            className="w-full h-full object-contain group-hover:scale-[1.03] transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[11px] font-sans text-muted-text">
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
          className="text-[14px] font-[500] font-sans text-product-text leading-snug line-clamp-2 hover:underline"
        >
          {product.name}
        </Link>
        <p className="text-[16px] font-[700] font-sans text-product-text mt-1">
          {fmt(product.adminPrice)}
        </p>

        {product.brand && <BrandTag brand={product.brand} className="mt-1" />}

        <RatingSummary avgRating={product.avgRating} reviewCount={product.reviewCount} className="mt-1" />

        <p className="text-[12px] font-sans text-muted-text mt-0.5">
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

function SavedBrands() {
  const { data, isLoading } = useFollowedBrands()
  const brands = data?.items ?? []

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4" role="status" aria-label="Loading saved brands">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-[88px] rounded-[6px] bg-line/60 animate-pulse" />
        ))}
      </div>
    )
  }

  if (brands.length === 0) {
    return (
      <EmptyState
        title="No saved brands yet"
        description="Follow a marketplace brand from its page to keep it here."
        action={{ label: 'Browse brands', onClick: () => { window.location.href = '/brands' } }}
      />
    )
  }

  return (
    <ul className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
      {brands.map((b) => (
        <li key={b.id}>
          <Link
            href={`/brands/${b.slug}`}
            className="flex items-center gap-3 min-h-[88px] p-4 bg-white border border-line rounded-[6px] hover:border-forest transition-colors"
          >
            <BrandLogo brand={b} size={48} />
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 text-[14px] leading-[20px] font-[600] text-ink">
                <span className="truncate">{b.name}</span>
                {b.isVerified && <VerifiedBadge size={14} />}
              </span>
              <span className="block type-caption text-muted">
                {b.country ? `${b.country} · ` : ''}
                {b.productCount} {b.productCount === 1 ? 'product' : 'products'}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

export default function WishlistPage() {
  const { data: wishlist = [], isLoading } = useWishlist()
  const [tab, setTab] = useState<'products' | 'brands'>('products')

  const tabClass = (active: boolean) =>
    cn(
      'min-h-11 px-4 text-[14px] leading-[20px] font-[600] border-b-2 -mb-px transition-colors',
      active ? 'border-forest text-forest' : 'border-transparent text-muted hover:text-ink'
    )

  return (
    <AccountPageWrapper
      title="Wishlist"
      description={
        tab === 'brands'
          ? 'Marketplace brands you follow'
          : isLoading
            ? 'Loading…'
            : `${wishlist.length} saved product${wishlist.length === 1 ? '' : 's'}`
      }
    >
      <div role="tablist" aria-label="Wishlist sections" className="mb-6 flex border-b border-line">
        <button type="button" role="tab" aria-selected={tab === 'products'} onClick={() => setTab('products')} className={tabClass(tab === 'products')}>
          Saved products
        </button>
        <button type="button" role="tab" aria-selected={tab === 'brands'} onClick={() => setTab('brands')} className={tabClass(tab === 'brands')}>
          Saved brands
        </button>
      </div>

      {tab === 'brands' ? (
        <SavedBrands />
      ) : isLoading ? (
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
