'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Heart, Plus, Trash2, BookmarkPlus, BookmarkCheck, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { cloudinaryFill } from '@/lib/cloudinaryImage'
import { displayUnitPrice } from '@/lib/pricing'
import type { Product } from '@/types'
import { Price } from '@/components/ui/Price'
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
  'id' | 'name' | 'slug' | 'adminPrice' | 'agentPrice' | 'moq' | 'images' | 'leadTime' | 'avgRating' | 'reviewCount' | 'isBestseller'
>

interface ProductCardProps {
  product: ProductCardData
  className?: string
}

/**
 * Buyer-facing product card — used across category grids, collection grids,
 * related products and the homepage. No seller/brand identity, no supplier
 * reference. White, 1px line border, 6px radius, no shadow; 4:3 photo on
 * desktop, square on mobile (object-contain, so the whole product shows).
 * Guests see name + MOQ + a locked-price helper — never a numeric (or blurred)
 * wholesale price. Signed-in buyers see the price plus wishlist/cart controls.
 */
export function ProductCard({ product, className }: ProductCardProps) {
  const { id, name, slug, adminPrice, agentPrice, moq, images, leadTime, isBestseller } = product
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

  function stop(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
  }

  function handleToggleCatalogue(e: React.MouseEvent) {
    stop(e)
    toggleCatalogueProduct({ productId: id, name, slug, image: imageSrc ?? '', price, moq, agentPrice: price })
  }

  function handleToggleWishlist(e: React.MouseEvent) {
    stop(e)
    requireAuth(() => {
      if (isWishlisted) removeFromWishlist.mutate(id)
      else addToWishlist.mutate(id)
    }, 'add_to_wishlist')
  }

  function handleAdd(e: React.MouseEvent) {
    stop(e)
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
    stop(e)
    if (!cartItem) return
    updateQuantity(id, cartItem.quantity + moq)
  }

  function handleRemove(e: React.MouseEvent) {
    stop(e)
    removeItem(id)
  }

  /** Guests never reach the product detail page from a card — clicking it opens
   *  the "unlock wholesale pricing" signup gate, with this product's photo. */
  function handleUnlock(e: React.MouseEvent) {
    stop(e)
    requireAuth(() => {}, 'view_price', imageSrc ?? undefined)
  }

  return (
    <article
      className={cn(
        'group relative flex flex-col bg-white border border-line rounded-[6px] p-3 md:p-4 transition-colors duration-150 hover:border-forest',
        className
      )}
    >
      {/* Image — square on mobile, 4:3 from md up. Reserved aspect ratio = no CLS. */}
      <div className="relative aspect-square md:aspect-[4/3] overflow-hidden rounded-[4px] bg-ivory">
        {imageSrc ? (
          <Image
            src={cloudinaryFill(imageSrc, 800, 800)}
            alt={name}
            fill
            sizes="(max-width: 767px) 50vw, (max-width: 1023px) 33vw, 280px"
            className="object-contain"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center" aria-hidden="true">
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none" className="text-line">
              <rect x="6" y="10" width="28" height="22" rx="1" stroke="currentColor" strokeWidth="1.5" />
              <circle cx="15" cy="18" r="3" stroke="currentColor" strokeWidth="1.5" />
              <path d="M6 26L13 20L19 25L26 18L34 26" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        )}

        {isBestseller && (
          <span className="absolute top-2 left-2 text-[11px] leading-[16px] font-[600] uppercase tracking-[0.12em] bg-white text-brass-deep border border-line px-2 py-0.5 rounded-[2px]">
            Bestseller
          </span>
        )}

        {/* Signed-in controls sit above the stretched card link (z-10). */}
        {isAuthenticated && (
          <div className="absolute top-0 right-0 z-10 flex flex-col">
            <button
              type="button"
              aria-label={isWishlisted ? `Remove ${name} from wishlist` : `Add ${name} to wishlist`}
              aria-pressed={isWishlisted}
              onClick={handleToggleWishlist}
              disabled={addToWishlist.isPending || removeFromWishlist.isPending}
              className="w-11 h-11 flex items-center justify-center disabled:opacity-60"
            >
              <span className="w-8 h-8 rounded-full bg-white border border-line flex items-center justify-center">
                <Heart size={16} strokeWidth={1.75} className="text-forest" fill={isWishlisted ? 'currentColor' : 'none'} aria-hidden="true" />
              </span>
            </button>

            {isAgent && (
              <>
                <button
                  type="button"
                  aria-label={inCatalogue ? 'Remove from catalogue' : 'Add to catalogue'}
                  onClick={handleToggleCatalogue}
                  className="w-11 h-11 flex items-center justify-center"
                >
                  <span className="w-8 h-8 rounded-full bg-white border border-line flex items-center justify-center">
                    {inCatalogue ? (
                      <BookmarkCheck size={14} className="text-forest" aria-hidden="true" />
                    ) : (
                      <BookmarkPlus size={14} className="text-forest" aria-hidden="true" />
                    )}
                  </span>
                </button>
                <ShareProductButton product={{ name, slug, images: images ?? [] }} />
              </>
            )}
          </div>
        )}

        {isAuthenticated &&
          (cartItem ? (
            <div className="absolute bottom-2 right-2 z-10 flex items-center h-9 px-1 rounded-full bg-white border border-line">
              <button
                type="button"
                aria-label={`Remove ${name} from cart`}
                onClick={handleRemove}
                className="w-7 h-7 rounded-full flex items-center justify-center text-forest hover:bg-forest/[8%] transition-colors"
              >
                <Trash2 size={13} aria-hidden="true" />
              </button>
              <span className="text-[12px] font-[600] text-ink min-w-[24px] text-center tabular-nums">
                {cartItem.quantity}
                <span className="sr-only"> in cart</span>
              </span>
              <button
                type="button"
                aria-label={`Add ${moq} more of ${name}`}
                onClick={handleIncrement}
                className="w-7 h-7 rounded-full flex items-center justify-center text-forest hover:bg-forest/[8%] transition-colors"
              >
                <Plus size={13} aria-hidden="true" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              aria-label={`Add ${name} to cart`}
              onClick={handleAdd}
              className="absolute bottom-0 right-0 z-10 w-11 h-11 flex items-center justify-center"
            >
              <span className="w-9 h-9 rounded-full bg-white border border-line text-forest flex items-center justify-center hover:bg-ivory transition-colors">
                <Plus size={18} aria-hidden="true" />
              </span>
            </button>
          ))}
      </div>

      {/* Info */}
      <div className="mt-3 flex flex-col gap-2 flex-1">
        <h3 className="text-[14px] leading-[20px] font-[600] font-sans text-ink line-clamp-2" title={name}>
          {/* Stretched link: the whole card is the click target. */}
          <Link
            href={`/products/${slug}`}
            onClick={isAuthenticated ? undefined : handleUnlock}
            className="after:absolute after:inset-0 after:rounded-[6px] after:content-[''] focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-forest focus-visible:after:outline-offset-[3px]"
          >
            {name}
          </Link>
        </h3>

        <span className="moq-tag self-start">MOQ {moq} units</span>

        {isAuthenticated ? (
          <Price amountInr={price} size="md" className="!text-[16px] !leading-[24px] !font-[600] text-ink" />
        ) : (
          <p className="mt-auto flex items-center gap-1.5 type-caption text-muted">
            <Lock size={12} aria-hidden="true" />
            Sign up to view wholesale prices
          </p>
        )}
      </div>
    </article>
  )
}
