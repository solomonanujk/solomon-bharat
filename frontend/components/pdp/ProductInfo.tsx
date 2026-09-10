'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Image from 'next/image'
import { CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Heart, Package, Share2, Star, X, BookmarkPlus, BookmarkCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { cloudinaryFill } from '@/lib/cloudinaryImage'
import { displayUnitPrice } from '@/lib/pricing'
import { useAuth } from '@/hooks/useAuth'
import { useCartStore } from '@/lib/store/useCartStore'
import { useCatalogueStore } from '@/lib/store/useCatalogueStore'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Price, useFormatPrice } from '@/components/ui/Price'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { RatingSummary } from '@/components/shared/StarRating'
import { useProductReviews } from '@/hooks/queries/useReviews'
import { useWishlist, useAddToWishlist, useRemoveFromWishlist } from '@/hooks/queries/useWishlist'
import type { Product, Review } from '@/types'

// ─── Expandable section ───────────────────────────────────────────────────────

function ExpandableSection({
  title,
  children,
  defaultOpen = false,
  collapsedPreview,
}: {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
  /** Shown in place of nothing while collapsed — e.g. a 3-line description peek. */
  collapsedPreview?: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="border-t border-border-warm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between py-4 text-left text-[13px] font-[600] font-public-sans text-primary hover:text-muted-text transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent rounded tracking-[0.05em]"
        aria-expanded={open}
      >
        {title}
        <ChevronDown
          size={16}
          className={cn('text-muted-text transition-transform duration-200 flex-shrink-0', open && 'rotate-180')}
          aria-hidden="true"
        />
      </button>
      {collapsedPreview && !open && (
        <div className="pb-5 text-[13px] leading-[1.7] font-[400] font-public-sans text-muted-text">
          {collapsedPreview}
        </div>
      )}
      <div className={cn('overflow-hidden transition-all duration-200', open ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0')}>
        <div className="pb-5 text-[13px] leading-[1.7] font-[400] font-public-sans text-muted-text">
          {children}
        </div>
      </div>
    </div>
  )
}

// ─── Quantity stepper ─────────────────────────────────────────────────────────

function QuantityStepper({
  value,
  onChange,
  min,
  step,
}: {
  value: number
  onChange: (v: number) => void
  min: number
  step: number
}) {
  return (
    <div className="flex items-center border border-border-warm rounded w-fit" role="group" aria-label="Quantity">
      <button
        type="button"
        onClick={() => value > min && onChange(Math.max(min, value - step))}
        disabled={value <= min}
        className="h-10 px-3 inline-flex items-center justify-center text-primary hover:bg-muted-bg transition-colors rounded-l disabled:opacity-30 disabled:cursor-not-allowed"
        aria-label="Decrease quantity"
      >
        −
      </button>
      <div
        className="w-16 text-center text-[13px] font-[600] font-public-sans text-primary select-none border-x border-border-warm h-10 flex items-center justify-center"
        aria-live="polite"
      >
        {value}
      </div>
      <button
        type="button"
        onClick={() => onChange(value + step)}
        className="h-10 px-3 inline-flex items-center justify-center text-primary hover:bg-muted-bg transition-colors rounded-r"
        aria-label="Increase quantity"
      >
        +
      </button>
    </div>
  )
}

// ─── Variant axes ─────────────────────────────────────────────────────────────
// Each value carries its representative variant's imageUrl (when the seller set
// one) so a "Color"-style axis can render photo swatches like Faire's, while an
// axis with no images (e.g. "Size") falls back to plain text buttons per value.

function buildAxes(variants: Product['variants']) {
  const map = new Map<string, { value: string; imageUrl: string | null }[]>()
  for (const v of variants ?? []) {
    if (!map.has(v.type)) map.set(v.type, [])
    const values = map.get(v.type)!
    if (!values.some((x) => x.value === v.value)) {
      values.push({ value: v.value, imageUrl: v.imageUrl ?? null })
    }
  }
  return Array.from(map.entries()).map(([type, values]) => ({ type, values }))
}

// ─── Price resolution ──────────────────────────────────────────────────────────
// Each variant carries its own MOQ-tiered prices (a Size L tote isn't the same
// price as a Size S one); a product with no variants has its own flat tiers
// instead. Either way: resolve to whichever set applies to the current
// selection, then the richest tier the current quantity actually qualifies
// for (tiers get cheaper at higher MOQ) — falling back to the flat product
// price only when there's no tier data at all.

interface MoqTier {
  key: string
  moq: number
  adminPrice: number
}

function getApplicableTiers(
  product: Pick<Product, 'priceTiers' | 'variants'>,
  selectedAttrs: Record<string, string>,
  viewerRole?: string
): MoqTier[] {
  const variant = product.variants?.find((v) => selectedAttrs[v.type] === v.value)
  if (variant) {
    return (variant.priceTiers ?? [])
      .filter((t): t is typeof t & { adminPrice: number } => t.adminPrice != null)
      .map((t, i) => ({
        key: t.id ?? `variant-tier-${i}`,
        moq: t.moq,
        adminPrice: displayUnitPrice(viewerRole, t.adminPrice, t.agentPrice),
      }))
  }
  return (product.priceTiers ?? []).map((t) => ({
    key: t.id,
    moq: t.moq,
    adminPrice: displayUnitPrice(viewerRole, t.adminPrice, t.agentPrice),
  }))
}

function resolveUnitPrice(
  product: Pick<Product, 'adminPrice' | 'agentPrice' | 'variants' | 'priceTiers'>,
  selectedAttrs: Record<string, string>,
  quantity: number,
  viewerRole?: string
): number {
  const tiers = getApplicableTiers(product, selectedAttrs, viewerRole)
  if (tiers.length === 0) return displayUnitPrice(viewerRole, product.adminPrice, product.agentPrice)

  const sorted = [...tiers].sort((a, b) => b.moq - a.moq)
  const applicable = sorted.find((t) => quantity >= t.moq) ?? sorted[sorted.length - 1]
  return applicable.adminPrice
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ProductInfo({ product }: { product: Product }) {
  const {
    id, name, description, materials, dimensions, weight,
    moq, stepQty, leadTime, placeOfOrigin, images, variants = [],
  } = product

  const [quantity, setQuantity] = useState(moq)
  const qtyStep = stepQty || 1

  const axes = useMemo(() => buildAxes(variants), [variants])
  const [selectedAttrs, setSelectedAttrs] = useState<Record<string, string>>(() =>
    Object.fromEntries(axes.map((a) => [a.type, a.values[0]?.value]))
  )

  function selectAttr(type: string, value: string) {
    setSelectedAttrs((prev) => ({ ...prev, [type]: value }))
  }

  const { user } = useAuth()
  const viewerRole = user?.role

  const unitPrice = useMemo(
    () => resolveUnitPrice(product, selectedAttrs, quantity, viewerRole),
    [product, selectedAttrs, quantity, viewerRole]
  )

  // MOQ dropdown — every priced tier for the current variant selection (or the
  // product's own flat tiers when it has no variants), cheapest-quantity first.
  const moqTiers = useMemo(
    () => [...getApplicableTiers(product, selectedAttrs, viewerRole)].sort((a, b) => a.moq - b.moq),
    [product, selectedAttrs, viewerRole]
  )
  const activeTierMoq = useMemo(() => {
    if (moqTiers.length === 0) return moq
    const sorted = [...moqTiers].sort((a, b) => b.moq - a.moq)
    return (sorted.find((t) => quantity >= t.moq) ?? sorted[sorted.length - 1]).moq
  }, [moqTiers, quantity, moq])
  const formatPrice = useFormatPrice()

  function selectMoqTier(tierMoq: number) {
    setQuantity(tierMoq)
  }

  const { requireAuth, isAuthenticated } = useAuth()
  const addItem = useCartStore((s) => s.addItem)
  const cartItems = useCartStore((s) => s.items)
  const updateCartQuantity = useCartStore((s) => s.updateQuantity)
  const removeFromCart = useCartStore((s) => s.removeItem)

  const activeVariantId = variants.find((v) => selectedAttrs[v.type] === v.value)?.id
  const cartItem = cartItems.find((i) => i.productId === id && i.variantId === activeVariantId)

  // Once this exact product+variant is in the cart, the CTA becomes a
  // "N in cart · total" pill that opens a quantity-picker dropdown instead —
  // the plain quantity stepper above the CTA disappears at that point.
  const [qtyMenuOpen, setQtyMenuOpen] = useState(false)
  const qtyMenuRef = useRef<HTMLDivElement>(null)
  const cartQtyOptions = useMemo(() => Array.from({ length: 20 }, (_, i) => moq + i * qtyStep), [moq, qtyStep])

  useEffect(() => {
    if (!qtyMenuOpen) return
    function handleClickOutside(e: MouseEvent) {
      if (qtyMenuRef.current && !qtyMenuRef.current.contains(e.target as Node)) setQtyMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [qtyMenuOpen])

  function handleSelectCartQty(qty: number) {
    if (!cartItem) return
    updateCartQuantity(id, qty, cartItem.variantId)
    setQtyMenuOpen(false)
  }

  function handleRemoveFromCart() {
    if (!cartItem) return
    removeFromCart(id, cartItem.variantId)
    setQtyMenuOpen(false)
  }

  const { data: wishlist } = useWishlist(isAuthenticated)
  const isWishlisted = isAuthenticated && (wishlist?.some((w) => w.product.id === id) ?? false)
  const addToWishlist = useAddToWishlist()
  const removeFromWishlist = useRemoveFromWishlist()

  function handleToggleWishlist() {
    requireAuth(() => {
      if (isWishlisted) removeFromWishlist.mutate(id)
      else addToWishlist.mutate(id)
    }, 'add_to_wishlist')
  }

  const isAgent = viewerRole === 'AGENT'
  const inCatalogue = useCatalogueStore((s) => s.items.some((i) => i.productId === id))
  const toggleCatalogueProduct = useCatalogueStore((s) => s.toggleProduct)

  function handleToggleCatalogue() {
    toggleCatalogueProduct({
      productId: id,
      name,
      slug: product.slug,
      image: images?.[0]?.url ?? '',
      price: unitPrice,
      moq,
    })
  }

  async function handleShare() {
    const url = `${window.location.origin}/products/${product.slug}`
    if (navigator.share) {
      try {
        await navigator.share({ title: name, url })
      } catch {
        // User cancelled the native share sheet — nothing to do.
      }
      return
    }
    await navigator.clipboard.writeText(url)
    toast.success('Link copied to clipboard')
  }

  function handleAddToCart() {
    requireAuth(() => {
      const variantLabel = axes.length
        ? axes.map((a) => `${a.type}: ${selectedAttrs[a.type]}`).join(' / ')
        : undefined

      addItem({
        productId: id,
        productSlug: product.slug,
        productName: name,
        image: images?.[0]?.url ?? '',
        quantity,
        unitAdminPriceInr: unitPrice,
        moq,
        variantId: activeVariantId,
        variantLabel,
        leadTime,
      })
    }, 'add_to_cart')
  }

  return (
    <div className="flex flex-col">
      {/* Product name — serif — with wishlist + share */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <h1 className="font-playfair font-[500] text-product-text text-[20px] sm:text-[23px] leading-[1.2]">
          {name}
        </h1>
        <div className="flex items-center gap-1 flex-shrink-0">
          {isAgent && (
            <button
              type="button"
              aria-label={inCatalogue ? 'Remove from catalogue' : 'Add to catalogue'}
              onClick={handleToggleCatalogue}
              className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-muted-bg transition-colors"
            >
              {inCatalogue ? (
                <BookmarkCheck size={18} className="text-primary" />
              ) : (
                <BookmarkPlus size={18} className="text-primary" />
              )}
            </button>
          )}
          <button
            type="button"
            aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
            onClick={handleToggleWishlist}
            disabled={addToWishlist.isPending || removeFromWishlist.isPending}
            className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-muted-bg transition-colors disabled:opacity-60"
          >
            <Heart
              size={18}
              className={isWishlisted ? 'text-rose-500' : 'text-primary'}
              fill={isWishlisted ? 'currentColor' : 'none'}
            />
          </button>
          <button
            type="button"
            aria-label="Share this product"
            onClick={handleShare}
            className="w-9 h-9 rounded-full flex items-center justify-center text-primary hover:bg-muted-bg transition-colors"
          >
            <Share2 size={17} />
          </button>
        </div>
      </div>

      <RatingSummary avgRating={product.avgRating} reviewCount={product.reviewCount} className="mb-4" />

      {/* Price */}
      <div className="mb-4">
        <p className="font-public-sans text-[10px] font-[600] text-muted-text uppercase tracking-[0.07em] mb-1.5">
          Price per unit
        </p>
        <Price amountInr={unitPrice} size="lg" className="!text-[34px] !font-[600] text-product-text tracking-[-0.025em] leading-none" />
      </div>

      {/* Shipping estimate — real placeOfOrigin/leadTime data only */}
      {(placeOfOrigin || leadTime) && (
        <div className="flex items-start gap-2 mb-5 text-muted-text">
          <Package size={16} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
          <p className="font-public-sans text-[12px] leading-snug">
            {placeOfOrigin && (
              <>Ships from <span className="text-primary font-[500]">{placeOfOrigin}</span></>
            )}
            {placeOfOrigin && leadTime && ' · '}
            {leadTime && (
              <>Estimated delivery in <span className="text-primary font-[500]">{leadTime}</span></>
            )}
          </p>
        </div>
      )}

      {/* Variant selector */}
      {axes.length > 0 && (
        <div className="mb-5 space-y-4">
          {axes.map((axis) => (
            <div key={axis.type}>
              <p className="font-public-sans text-[11px] font-[600] text-muted-text uppercase tracking-[0.05em] mb-2">
                {axis.type}
                {selectedAttrs[axis.type] && (
                  <span className="ml-1.5 text-primary normal-case font-[500] tracking-[0.02em]">
                    — {selectedAttrs[axis.type]}
                  </span>
                )}
              </p>
              <div className="flex flex-wrap gap-2">
                {axis.values.map(({ value: val, imageUrl }) => {
                  const selected = selectedAttrs[axis.type] === val

                  if (imageUrl) {
                    return (
                      <button
                        key={val}
                        type="button"
                        onClick={() => selectAttr(axis.type, val)}
                        className={cn(
                          'relative w-11 h-11 rounded-full overflow-hidden border-2 bg-muted-bg transition-colors',
                          selected ? 'border-primary' : 'border-transparent hover:border-border-warm'
                        )}
                        aria-label={`${axis.type}: ${val}`}
                        aria-pressed={selected}
                      >
                        <Image src={cloudinaryFill(imageUrl, 160, 160)} alt={val} fill sizes="44px" className="object-contain" />
                      </button>
                    )
                  }

                  return (
                    <button
                      key={val}
                      type="button"
                      onClick={() => selectAttr(axis.type, val)}
                      className={cn(
                        'h-9 px-4 rounded border text-[12px] font-[500] font-public-sans transition-colors',
                        selected
                          ? 'border-primary bg-primary text-white'
                          : 'border-border-warm text-primary hover:border-primary'
                      )}
                      aria-pressed={selected}
                    >
                      {val}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MOQ & pricing */}
      {moqTiers.length > 0 ? (
        <div className="mb-4">
          <p className="font-public-sans text-[11px] font-[600] text-muted-text uppercase tracking-[0.05em] mb-2">
            MOQ &amp; Pricing
          </p>
          <select
            value={activeTierMoq}
            onChange={(e) => selectMoqTier(Number(e.target.value))}
            className="w-full h-10 px-3 rounded border border-border-warm bg-surface text-[13px] font-public-sans text-primary focus:outline-none focus:border-accent transition-colors"
          >
            {moqTiers.map((tier) => (
              <option key={tier.key} value={tier.moq}>
                {tier.moq} units — {formatPrice(tier.adminPrice)} / unit
              </option>
            ))}
          </select>
        </div>
      ) : (
        <p className="font-public-sans text-[12px] text-muted-text mb-4">
          Min. order:&nbsp;
          <span className="font-[600] text-primary">{moq} units</span>
        </p>
      )}

      <div className="border-t border-border-warm mb-5" />

      {cartItem ? (
        /* Already in cart — collapses the quantity stepper into a single pill
           that opens a quantity-picker/remove dropdown, matching Faire's PDP. */
        <div className="relative" ref={qtyMenuRef}>
          <button
            type="button"
            onClick={() => setQtyMenuOpen((v) => !v)}
            aria-expanded={qtyMenuOpen}
            className="w-full h-12 rounded bg-primary text-white text-[13px] font-[600] font-public-sans flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors"
          >
            {cartItem.quantity} in cart · {formatPrice(cartItem.unitAdminPriceInr * cartItem.quantity)}
            <ChevronDown
              size={16}
              className={cn('transition-transform duration-200', qtyMenuOpen && 'rotate-180')}
              aria-hidden="true"
            />
          </button>

          {qtyMenuOpen && (
            <div className="absolute left-0 right-0 top-full mt-1 z-20 bg-surface border border-border-warm rounded shadow-lg max-h-[260px] overflow-y-auto">
              <button
                type="button"
                onClick={handleRemoveFromCart}
                className="w-full text-left px-4 py-2.5 text-[13px] font-[500] font-public-sans text-error hover:bg-muted-bg transition-colors border-b border-border-warm"
              >
                Remove from cart
              </button>
              {cartQtyOptions.map((qty) => (
                <button
                  key={qty}
                  type="button"
                  onClick={() => handleSelectCartQty(qty)}
                  className={cn(
                    'w-full text-left px-4 py-2.5 text-[13px] font-public-sans hover:bg-muted-bg transition-colors',
                    qty === cartItem.quantity ? 'font-[700] text-primary bg-muted-bg/60' : 'text-primary'
                  )}
                >
                  {qty}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Quantity */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <p className="font-public-sans text-[11px] font-[500] text-muted-text">
                Quantity&nbsp;<span className="text-primary">(min. {moq})</span>
              </p>
              {qtyStep > 1 && (
                <span className="font-public-sans text-[11px] text-muted-text">Case of {qtyStep}</span>
              )}
            </div>
            <QuantityStepper value={quantity} onChange={setQuantity} min={moq} step={qtyStep} />
          </div>

          {/* CTA */}
          <div className="flex flex-col gap-2.5">
            <Button
              variant="primary"
              size="lg"
              onClick={handleAddToCart}
              className="w-full h-12 text-[13px] font-[600]"
              aria-label={`Add ${quantity} units to cart — ${formatPrice(unitPrice * quantity)}`}
            >
              Add to cart · {formatPrice(unitPrice * quantity)}
            </Button>
          </div>
        </>
      )}

      {/* Description + details — collapsed accordions, matching Faire's PDP:
          description peeks 3 lines even while closed, everything else shows
          nothing until opened. */}
      <div className="flex flex-col mt-6">
        <ExpandableSection
          title="Product description"
          collapsedPreview={<p className="whitespace-pre-wrap line-clamp-3">{description}</p>}
        >
          <p className="whitespace-pre-wrap">{description}</p>
        </ExpandableSection>

        <ExpandableSection title="Materials">
          <p>{materials}</p>
        </ExpandableSection>

        {(dimensions || weight != null) && (
          <ExpandableSection title="Dimensions and weight">
            <dl className="flex flex-col gap-3">
              {[
                ...(weight != null ? [{ label: 'Weight', value: weight }] : []),
                ...(dimensions ? [{ label: 'Dimensions', value: dimensions }] : []),
              ].map(({ label, value }) => (
                <div key={label} className="flex items-baseline justify-between gap-4">
                  <dt className="font-public-sans text-[11px] font-[600] text-primary uppercase tracking-[0.04em] flex-shrink-0">
                    {label}
                  </dt>
                  <dd className="font-public-sans text-[13px] text-muted-text text-right">{value}</dd>
                </div>
              ))}
            </dl>
          </ExpandableSection>
        )}

        <ExpandableSection title="Details">
          <dl className="flex flex-col gap-3">
            {[
              ...(leadTime ? [{ label: 'Lead time', value: leadTime }] : []),
              { label: 'Min. order', value: `${moq} units` },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-baseline justify-between gap-4">
                <dt className="font-public-sans text-[11px] font-[600] text-primary uppercase tracking-[0.04em] flex-shrink-0">
                  {label}
                </dt>
                <dd className="font-public-sans text-[13px] text-muted-text text-right">{value}</dd>
              </div>
            ))}
          </dl>
        </ExpandableSection>
      </div>

      <CustomerReviews productId={id} />
    </div>
  )
}

// ─── Ratings and Reviews ───────────────────────────────────────────────────────
// Shows the reviewing buyer's contact name only — never their company name,
// per the marketplace's no-competitive-identity-leak convention. Review photos
// are optional, uploaded by the buyer at review time (GET /reviews returns each
// review's own images[]).

function ratingQuality(avg: number): { label: string; className: string } {
  if (avg >= 4.5) return { label: 'Excellent', className: 'bg-emerald-50 text-emerald-700' }
  if (avg >= 4.0) return { label: 'Very Good', className: 'bg-green-50 text-green-700' }
  if (avg >= 3.0) return { label: 'Good', className: 'bg-lime-50 text-lime-700' }
  if (avg >= 2.0) return { label: 'Fair', className: 'bg-amber-50 text-amber-700' }
  return { label: 'Needs Improvement', className: 'bg-red-50 text-red-700' }
}

function timeAgo(dateStr: string): string {
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000)
  if (days < 1) return 'Today'
  if (days === 1) return '1 day ago'
  if (days < 30) return `${days} days ago`
  const months = Math.floor(days / 30)
  if (months < 12) return months === 1 ? '1 month ago' : `${months} months ago`
  const years = Math.floor(months / 12)
  return years === 1 ? '1 year ago' : `${years} years ago`
}

// ─── Full-screen photo lightbox — shared by the "customer photos" strip and the
// review detail modal, just handed a different photo list + start index. ──────

function ReviewPhotoLightbox({
  photos,
  initialIndex,
  onClose,
}: {
  photos: string[]
  initialIndex: number
  onClose: () => void
}) {
  const [index, setIndex] = useState(initialIndex)

  const prev = useCallback(() => setIndex((i) => (i === 0 ? photos.length - 1 : i - 1)), [photos.length])
  const next = useCallback(() => setIndex((i) => (i === photos.length - 1 ? 0 : i + 1)), [photos.length])

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft') prev()
      else if (e.key === 'ArrowRight') next()
    }
    document.addEventListener('keydown', handleKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = ''
    }
  }, [onClose, prev, next])

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-6 bg-black/75"
      role="dialog"
      aria-modal="true"
      aria-label={`Review photo ${index + 1} of ${photos.length}`}
      onClick={onClose}
    >
      <div className="relative bg-[#1a1a1a] rounded-xl shadow-2xl flex flex-col overflow-hidden w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <span className="font-public-sans text-[12px] text-white/60">{index + 1} / {photos.length}</span>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded inline-flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Close"
          >
            <X size={15} aria-hidden="true" />
          </button>
        </div>

        <div className="relative flex items-center justify-center bg-black/40">
          {photos.length > 1 && (
            <button
              type="button"
              onClick={prev}
              className="absolute left-3 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded border border-white/20 inline-flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Previous photo"
            >
              <ChevronLeft size={18} aria-hidden="true" />
            </button>
          )}
          <Image
            src={photos[index]}
            alt={`Review photo ${index + 1}`}
            width={800}
            height={600}
            className="max-h-[65vh] w-auto object-contain mx-auto"
            priority
          />
          {photos.length > 1 && (
            <button
              type="button"
              onClick={next}
              className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded border border-white/20 inline-flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Next photo"
            >
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          )}
        </div>

        {photos.length > 1 && (
          <div className="flex items-center gap-2 px-4 py-3 overflow-x-auto border-t border-white/10">
            {photos.map((src, i) => (
              <button
                key={src + i}
                type="button"
                onClick={() => setIndex(i)}
                className={cn(
                  'flex-shrink-0 w-12 h-12 rounded overflow-hidden border-2 transition-colors',
                  i === index ? 'border-white/80' : 'border-transparent opacity-50 hover:opacity-80'
                )}
                aria-label={`Go to photo ${i + 1}`}
              >
                <Image src={src} alt="" width={48} height={48} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}

// ─── "Customer photos" strip — every photo across every review, flattened.
// The trailing "+N" tile (and any thumbnail) opens the lightbox to browse them all. ──

function ReviewPhotoStrip({ reviews, onOpenPhoto }: { reviews: Review[]; onOpenPhoto: (photos: string[], index: number) => void }) {
  const allPhotos = useMemo(() => reviews.flatMap((r) => r.images.map((img) => img.url)), [reviews])
  const VISIBLE = 5
  const shown = allPhotos.slice(0, VISIBLE)
  const extra = allPhotos.length - shown.length

  if (shown.length === 0) return null

  return (
    <div className="flex flex-col gap-2 mb-6">
      <p className="font-public-sans text-[10px] font-[600] text-muted-text uppercase tracking-[0.06em]">
        Customer Photos
      </p>
      <div className="flex gap-2">
        {shown.map((url, i) => {
          const isLast = i === shown.length - 1
          return (
            <button
              key={url + i}
              type="button"
              onClick={() => onOpenPhoto(allPhotos, i)}
              className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-md overflow-hidden bg-muted-bg flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              aria-label={isLast && extra > 0 ? `See all ${allPhotos.length} customer photos` : `View customer photo ${i + 1}`}
            >
              <Image src={url} alt="" fill sizes="80px" className="object-cover" />
              {isLast && extra > 0 && (
                <div className="absolute inset-0 bg-black/55 flex items-center justify-center">
                  <span className="text-white text-[12px] font-[700] font-public-sans">+{extra}</span>
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Review card — clicking it (Flipkart-style) opens the full detail modal. ──

function ReviewCard({ review, onOpen }: { review: Review; onOpen: () => void }) {
  const thumbs = review.images.slice(0, 3)

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex flex-col flex-shrink-0 w-[260px] sm:w-[280px] bg-surface border border-border-warm rounded-lg p-4 text-left hover:border-primary/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="inline-flex items-center gap-1 bg-primary text-white rounded px-1.5 py-0.5 text-[11px] font-[700] font-public-sans">
          {review.rating}
          <Star size={10} fill="currentColor" aria-hidden="true" />
        </span>
        <span className="font-public-sans text-[10px] text-muted-text flex-shrink-0">{timeAgo(review.createdAt)}</span>
      </div>

      <p className="font-public-sans text-[12px] text-primary leading-[1.6] mb-3 line-clamp-4">
        {review.comment || <span className="text-muted-text italic">No written feedback</span>}
      </p>

      {thumbs.length > 0 && (
        <div className="flex gap-1.5 mb-3">
          {thumbs.map((img) => (
            <div key={img.id} className="relative w-10 h-10 rounded overflow-hidden bg-muted-bg flex-shrink-0">
              <Image src={img.url} alt="" fill sizes="40px" className="object-cover" />
            </div>
          ))}
          {review.images.length > 3 && (
            <div className="w-10 h-10 rounded bg-muted-bg flex-shrink-0 flex items-center justify-center">
              <span className="font-public-sans text-[10px] font-[600] text-muted-text">+{review.images.length - 3}</span>
            </div>
          )}
        </div>
      )}

      <div className="mt-auto flex items-center gap-1.5">
        <span className="font-public-sans text-[11px] font-[600] text-primary">{review.buyerName}</span>
        <span className="inline-flex items-center gap-1 text-[10px] text-muted-text">
          <CheckCircle2 size={11} aria-hidden="true" />
          Verified Buyer
        </span>
      </div>
    </button>
  )
}

function ReviewCardCarousel({ reviews, onOpenReview }: { reviews: Review[]; onOpenReview: (index: number) => void }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const sync = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 4)
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4)
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const raf = requestAnimationFrame(sync)
    el.addEventListener('scroll', sync, { passive: true })
    window.addEventListener('resize', sync)
    return () => {
      cancelAnimationFrame(raf)
      el.removeEventListener('scroll', sync)
      window.removeEventListener('resize', sync)
    }
  }, [sync, reviews.length])

  function scrollByCard(direction: 1 | -1) {
    scrollRef.current?.scrollBy({ left: direction * 296, behavior: 'smooth' })
  }

  return (
    <div className="relative">
      <div ref={scrollRef} className="flex gap-3 overflow-x-auto scrollbar-none scroll-smooth py-1">
        {reviews.map((review, i) => (
          <ReviewCard key={review.id} review={review} onOpen={() => onOpenReview(i)} />
        ))}
      </div>

      {canScrollLeft && (
        <button
          type="button"
          onClick={() => scrollByCard(-1)}
          aria-label="Show previous reviews"
          className="absolute -left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white border border-border-warm shadow-md flex items-center justify-center text-primary hover:bg-muted-bg transition-colors"
        >
          <ChevronLeft size={15} aria-hidden="true" />
        </button>
      )}
      {canScrollRight && (
        <button
          type="button"
          onClick={() => scrollByCard(1)}
          aria-label="Show more reviews"
          className="absolute -right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white border border-border-warm shadow-md flex items-center justify-center text-primary hover:bg-muted-bg transition-colors"
        >
          <ChevronRight size={15} aria-hidden="true" />
        </button>
      )}
    </div>
  )
}

// ─── Review detail modal — Flipkart-style: full text + own photos, with
// prev/next to page through the other loaded reviews without closing. ─────────

function ReviewDetailModal({
  reviews,
  index,
  onIndexChange,
  onClose,
  onOpenPhoto,
}: {
  reviews: Review[]
  index: number
  onIndexChange: (i: number) => void
  onClose: () => void
  onOpenPhoto: (photos: string[], photoIndex: number) => void
}) {
  const review = reviews[index]
  if (!review) return null

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-[560px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 bg-primary text-white rounded px-1.5 py-0.5 text-[11px] font-[700] font-public-sans">
              {review.rating}
              <Star size={10} fill="currentColor" aria-hidden="true" />
            </span>
            <span className="font-public-sans text-[11px] text-muted-text">{timeAgo(review.createdAt)}</span>
          </div>
          <DialogTitle className="text-[15px] font-public-sans font-[600]">{review.buyerName}</DialogTitle>
          <span className="inline-flex items-center gap-1 text-[11px] text-muted-text">
            <CheckCircle2 size={12} aria-hidden="true" />
            Verified Buyer
          </span>
        </DialogHeader>

        <div className="px-6 pb-6 flex flex-col gap-4">
          <p className="font-public-sans text-[13px] text-primary leading-[1.7] whitespace-pre-wrap">
            {review.comment || <span className="text-muted-text italic">No written feedback</span>}
          </p>

          {review.images.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {review.images.map((img, i) => (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => onOpenPhoto(review.images.map((im) => im.url), i)}
                  className="relative w-20 h-20 rounded-md overflow-hidden bg-muted-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  aria-label={`View photo ${i + 1} from this review`}
                >
                  <Image src={img.url} alt="" fill sizes="80px" className="object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {reviews.length > 1 && (
          <DialogFooter className="justify-between">
            <button
              type="button"
              onClick={() => onIndexChange(index === 0 ? reviews.length - 1 : index - 1)}
              className="inline-flex items-center gap-1 text-[12px] font-[600] font-public-sans text-primary hover:text-accent transition-colors"
            >
              <ChevronLeft size={15} aria-hidden="true" />
              Previous review
            </button>
            <span className="font-public-sans text-[11px] text-muted-text">{index + 1} / {reviews.length}</span>
            <button
              type="button"
              onClick={() => onIndexChange(index === reviews.length - 1 ? 0 : index + 1)}
              className="inline-flex items-center gap-1 text-[12px] font-[600] font-public-sans text-primary hover:text-accent transition-colors"
            >
              Next review
              <ChevronRight size={15} aria-hidden="true" />
            </button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}

function CustomerReviews({ productId }: { productId: string }) {
  const { data, isLoading } = useProductReviews(productId, { limit: 10 })
  const [open, setOpen] = useState(true)
  const [reviewDetailIndex, setReviewDetailIndex] = useState<number | null>(null)
  const [photoLightbox, setPhotoLightbox] = useState<{ photos: string[]; index: number } | null>(null)

  if (isLoading || !data || data.reviewCount === 0) return null

  const quality = ratingQuality(data.avgRating ?? 0)

  return (
    <div className="border-t border-border-warm mt-6 pt-6">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between mb-4 text-left"
        aria-expanded={open}
      >
        <p className="font-playfair font-[600] text-primary text-[17px] leading-tight">
          Ratings and Reviews
        </p>
        <ChevronDown
          size={18}
          className={cn('text-muted-text transition-transform duration-200 flex-shrink-0', open && 'rotate-180')}
          aria-hidden="true"
        />
      </button>

      {open && (
        <>
          <div className="flex items-center gap-2.5 mb-1.5">
            <span className="inline-flex items-center gap-1 font-public-sans text-[23px] font-[700] text-primary leading-none">
              {data.avgRating?.toFixed(1)}
              <Star size={20} className="text-accent" fill="currentColor" aria-hidden="true" />
            </span>
            <span className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-[600] font-public-sans', quality.className)}>
              {quality.label}
            </span>
          </div>
          <p className="font-public-sans text-[12px] text-muted-text mb-5">
            based on {data.reviewCount} rating{data.reviewCount === 1 ? '' : 's'} by{' '}
            <span className="inline-flex items-center gap-1">
              <CheckCircle2 size={12} aria-hidden="true" />
              Verified Buyers
            </span>
          </p>

          <ReviewPhotoStrip reviews={data.items} onOpenPhoto={(photos, index) => setPhotoLightbox({ photos, index })} />

          <ReviewCardCarousel reviews={data.items} onOpenReview={setReviewDetailIndex} />
        </>
      )}

      {reviewDetailIndex !== null && (
        <ReviewDetailModal
          reviews={data.items}
          index={reviewDetailIndex}
          onIndexChange={setReviewDetailIndex}
          onClose={() => setReviewDetailIndex(null)}
          onOpenPhoto={(photos, index) => setPhotoLightbox({ photos, index })}
        />
      )}

      {photoLightbox && (
        <ReviewPhotoLightbox
          photos={photoLightbox.photos}
          initialIndex={photoLightbox.index}
          onClose={() => setPhotoLightbox(null)}
        />
      )}
    </div>
  )
}
