'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Heart, Plus, Trash2, BookmarkPlus, BookmarkCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { cloudinaryFill } from '@/lib/cloudinaryImage'
import { displayUnitPrice } from '@/lib/pricing'
import type { Product } from '@/types'
import { Price } from '@/components/ui/Price'
import { RatingSummary } from '@/components/shared/StarRating'
import { useAuth } from '@/hooks/useAuth'
import { useCartStore } from '@/lib/store/useCartStore'
import { useCatalogueStore } from '@/lib/store/useCatalogueStore'
import { useWishlist, useAddToWishlist, useRemoveFromWishlist } from '@/hooks/queries/useWishlist'
import { ShareProductButton } from '@/components/shared/ShareProductButton'

/** Exactly the fields this card reads — lets callers with a narrower/cached
 *  projection (e.g. the localStorage-backed "recently viewed" list) reuse it
 *  without needing a full `Product`. */
export type ProductCardData = Pick<
  Product,
  'id' | 'name' | 'slug' | 'adminPrice' | 'agentPrice' | 'moq' | 'images' | 'leadTime' | 'avgRating' | 'reviewCount'
>

interface ProductCardProps {
  product: ProductCardData
  className?: string
}

/**
 * Buyer-facing product card — used across category grids, collection grids,
 * related products and the homepage. No seller/brand identity, no supplier
 * reference: image, name, admin selling price, MOQ, a wishlist toggle, and a
 * cart quick-add control only.
 */
export function ProductCard({ product, className }: ProductCardProps) {
  const { id, name, slug, adminPrice, agentPrice, moq, images, leadTime } = product
  const imageSrc = images?.[0]?.url ?? null

  const { user, requireAuth, isAuthenticated } = useAuth()
  const price = displayUnitPrice(user?.role, adminPrice, agentPrice)
  const { data: wishlist } = useWishlist(isAuthenticated)
  const isWishlisted = isAuthenticated && (wishlist?.some((w) => w.product.id === id) ?? false)
  const addToWishlist = useAddToWishlist()
  const removeFromWishlist = useRemoveFromWishlist()

  const cartItem = useCartStore((s) => s.items.find((i) => i.productId === id && !i.variantId))
  const addItem = useCartStore((s) => s.addItem)
  const removeItem = useCartStore((s) => s.removeItem)
  const updateQuantity = useCartStore((s) => s.updateQuantity)

  const isAgent = user?.role === 'AGENT'
  const inCatalogue = useCatalogueStore((s) => s.items.some((i) => i.productId === id))
  const toggleCatalogueProduct = useCatalogueStore((s) => s.toggleProduct)

  function handleToggleCatalogue(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    toggleCatalogueProduct({ productId: id, name, slug, image: imageSrc ?? '', price, moq })
  }

  function handleToggleWishlist(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    requireAuth(() => {
      if (isWishlisted) removeFromWishlist.mutate(id)
      else addToWishlist.mutate(id)
    }, 'add_to_wishlist')
  }

  function handleAdd(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    requireAuth(() => {
      addItem({
        productId: id,
        productSlug: slug,
        productName: name,
        image: imageSrc ?? '',
        quantity: moq,
        unitAdminPriceInr: price,
        moq,
        leadTime,
      })
    }, 'add_to_cart')
  }

  function handleIncrement(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!cartItem) return
    updateQuantity(id, cartItem.quantity + moq)
  }

  function handleRemove(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    removeItem(id)
  }

  return (
    <div className={cn('group flex flex-col', className)}>
      {/* Image */}
      <Link href={`/products/${slug}`} className="relative block aspect-square overflow-hidden rounded-sm bg-[#F0EBE3]">
        {imageSrc ? (
          <Image
            src={cloudinaryFill(imageSrc, 700, 700)}
            alt={name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-contain"
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

        {/* Top-right controls: wishlist (everyone), plus catalogue/share for agents */}
        <div className="absolute top-2 right-2 flex flex-col gap-1.5">
          <button
            type="button"
            aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
            onClick={handleToggleWishlist}
            disabled={addToWishlist.isPending || removeFromWishlist.isPending}
            className="w-8 h-8 flex items-center justify-center transition-colors duration-150 disabled:opacity-60"
          >
            <Heart
              size={26}
              strokeWidth={1.25}
              className="text-white"
              fill={isWishlisted ? 'rgba(0,0,0,0.85)' : 'rgba(0,0,0,0.35)'}
            />
          </button>

          {isAgent && (
            <>
              <button
                type="button"
                aria-label={inCatalogue ? 'Remove from catalogue' : 'Add to catalogue'}
                onClick={handleToggleCatalogue}
                className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center shadow-sm transition-colors duration-150"
              >
                {inCatalogue ? (
                  <BookmarkCheck size={14} className="text-primary" />
                ) : (
                  <BookmarkPlus size={14} className="text-primary" />
                )}
              </button>
              <ShareProductButton product={{ name, slug, images: images ?? [] }} />
            </>
          )}
        </div>

        {/* Cart quick-add — bottom right. Collapsed to a quantity pill once
            added; hovering it expands into a remove/quantity/add-more stepper. */}
        {cartItem ? (
          <div className="absolute bottom-2 right-2 group/qty">
            <div className="flex items-center justify-center w-9 h-9 rounded-full bg-primary text-white text-[12px] font-[600] font-public-sans shadow-sm group-hover/qty:hidden">
              {cartItem.quantity}
            </div>
            <div className="hidden group-hover/qty:flex items-center gap-0.5 h-9 pl-1 pr-1 rounded-full bg-white shadow-sm border border-border-warm">
              <button
                type="button"
                aria-label="Remove from cart"
                onClick={handleRemove}
                className="w-7 h-7 rounded-full flex items-center justify-center text-primary hover:bg-muted-bg transition-colors"
              >
                <Trash2 size={13} />
              </button>
              <span className="text-[12px] font-[600] font-public-sans text-primary min-w-[16px] text-center">
                {cartItem.quantity}
              </span>
              <button
                type="button"
                aria-label="Add more to cart"
                onClick={handleIncrement}
                className="w-7 h-7 rounded-full flex items-center justify-center text-primary hover:bg-muted-bg transition-colors"
              >
                <Plus size={13} />
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            aria-label={`Add ${name} to cart`}
            onClick={handleAdd}
            className="absolute bottom-2 right-2 w-9 h-9 rounded-full bg-white text-primary flex items-center justify-center shadow-sm hover:bg-muted-bg transition-colors"
          >
            <Plus size={24} />
          </button>
        )}
      </Link>

      {/* Info */}
      <div className="mt-2.5 flex flex-col gap-1">
        <div className="text-[18px] font-[600] font-public-sans text-product-text leading-none">
          {isAuthenticated ? (
            <Price amountInr={price} size="md" className="!text-[18px] !font-[600]" />
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                requireAuth(() => {}, 'view_price')
              }}
              aria-label="Sign in to see wholesale price"
              className="blur-[5px] select-none cursor-pointer"
            >
              <Price amountInr={price} size="md" className="!text-[18px] !font-[600]" />
            </button>
          )}
        </div>

        <Link
          href={`/products/${slug}`}
          className="text-[14px] font-[600] font-public-sans text-product-text leading-snug line-clamp-2 tracking-[0.02em] hover:underline"
        >
          {name}
        </Link>

        <RatingSummary avgRating={product.avgRating} reviewCount={product.reviewCount} size={14} />

        <span className="text-[12px] font-public-sans text-muted-text">
          MOQ: {moq} units
        </span>
      </div>
    </div>
  )
}
