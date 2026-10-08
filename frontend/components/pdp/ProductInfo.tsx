'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import {
  BookmarkCheck, BookmarkPlus, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, ClipboardCheck, Heart,
  Home as HomeIcon, Share2, ShoppingCart, Star, Truck,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { cloudinaryFill } from '@/lib/cloudinaryImage'
import { displayUnitPrice } from '@/lib/pricing'
import { useAuth } from '@/hooks/useAuth'
import { useCartStore } from '@/lib/store/useCartStore'
import { useCatalogueStore } from '@/lib/store/useCatalogueStore'
import { useCurrencyStore } from '@/lib/store/useCurrencyStore'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useFormatPrice } from '@/components/ui/Price'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ImageLightbox, type LightboxImage } from '@/components/shared/ImageLightbox'
import { useProductReviews } from '@/hooks/queries/useReviews'
import { useWishlist, useAddToWishlist, useRemoveFromWishlist } from '@/hooks/queries/useWishlist'
import type { Product, Review } from '@/types'

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
    <div className="flex items-center border border-line rounded-[4px] w-fit bg-white" role="group" aria-label="Quantity">
      <button
        type="button"
        onClick={() => value > min && onChange(Math.max(min, value - step))}
        disabled={value <= min}
        className="w-12 h-12 inline-flex items-center justify-center text-[18px] text-ink hover:bg-ivory transition-colors duration-150 rounded-l-[4px] disabled:text-muted disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="Decrease quantity"
      >
        −
      </button>
      <div
        className="w-16 h-12 text-center text-[16px] leading-[24px] font-[600] text-ink select-none border-x border-line flex items-center justify-center"
        aria-live="polite"
      >
        {value}
      </div>
      <button
        type="button"
        onClick={() => onChange(value + step)}
        className="w-12 h-12 inline-flex items-center justify-center text-[18px] text-ink hover:bg-ivory transition-colors duration-150 rounded-r-[4px]"
        aria-label="Increase quantity"
      >
        +
      </button>
    </div>
  )
}

// ─── Variant axes ─────────────────────────────────────────────────────────────
// A variant row's own `.type`/`.value` only ever hold its PRIMARY axis (Size
// wins over Color when both exist — see ProductForm's combo builder), so two
// combos that share a Size but differ in Color both carry `type: 'Size'`. Axes
// must therefore be reconstructed from the full `.attributes[]` list (every
// axis on that row), not from `.type`/`.value` alone, or the secondary axis
// (and any combo whose primary value repeats) silently disappears. Hidden
// (INACTIVE) variants are excluded — a seller who hides a color shouldn't
// have it still selectable here. Each value carries a representative
// variant's imageUrl (when the seller set one) so a "Color"-style axis can
// render photo swatches, while an axis with no images (e.g. "Size") falls
// back to plain text buttons per value.

function variantAttrs(v: Product['variants'][number]): { name: string; value: string }[] {
  return v.attributes?.length ? v.attributes : [{ name: v.type, value: v.value }]
}

function buildAxes(variants: Product['variants']) {
  const map = new Map<string, Map<string, string | null>>()
  for (const v of variants ?? []) {
    if (v.status === 'INACTIVE') continue
    for (const attr of variantAttrs(v)) {
      if (!map.has(attr.name)) map.set(attr.name, new Map())
      const values = map.get(attr.name)!
      if (!values.has(attr.value) || (!values.get(attr.value) && v.imageUrl)) {
        values.set(attr.value, v.imageUrl ?? null)
      }
    }
  }
  return Array.from(map.entries()).map(([type, values]) => ({
    type,
    values: Array.from(values.entries()).map(([value, imageUrl]) => ({ value, imageUrl })),
  }))
}

/** Finds the one variant row whose full attribute set matches the current
 *  selection on every axis it declares — a plain `.type`/`.value` match only
 *  ever disambiguates the primary axis, so two colors of the same size would
 *  resolve to whichever came first. */
function findMatchingVariant(variants: Product['variants'], selectedAttrs: Record<string, string>) {
  return (variants ?? []).find(
    (v) => v.status !== 'INACTIVE' && variantAttrs(v).every((a) => selectedAttrs[a.name] === a.value)
  )
}

/** A value is unavailable when, combined with the other current selections, it
 *  matches no live variant or only an out-of-stock one. */
function isValueUnavailable(
  variants: Product['variants'],
  selectedAttrs: Record<string, string>,
  type: string,
  value: string
): boolean {
  const match = findMatchingVariant(variants, { ...selectedAttrs, [type]: value })
  return !match || match.status === 'OUT_OF_STOCK'
}

// ─── Price resolution ──────────────────────────────────────────────────────────
// Each variant carries its own MOQ-tiered prices; a product with no variants
// has its own flat tiers instead. Resolve to whichever set applies to the
// current selection, then the richest tier the current quantity qualifies for
// — falling back to the flat product price only when there's no tier data.

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
  const variant = findMatchingVariant(product.variants ?? [], selectedAttrs)
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

// ─── Delivery timeline ──────────────────────────────────────────────────────────
// Parses the free-text lead time ("10-15 days", "1-2 weeks", "20 days") into a
// real date range for "ready to ship". "Delivered" deliberately carries no
// fixed date — cross-border transit varies by destination and we have no real
// transit-time data to base one on.

function parseLeadTimeDays(leadTime: string): { min: number; max: number } | null {
  const weekRange = leadTime.match(/(\d+)\s*[-–to]+\s*(\d+)\s*week/i)
  if (weekRange) return { min: Number(weekRange[1]) * 7, max: Number(weekRange[2]) * 7 }
  const singleWeek = leadTime.match(/(\d+)\s*week/i)
  if (singleWeek) return { min: Number(singleWeek[1]) * 7, max: Number(singleWeek[1]) * 7 }
  const dayRange = leadTime.match(/(\d+)\s*[-–to]+\s*(\d+)\s*day/i)
  if (dayRange) return { min: Number(dayRange[1]), max: Number(dayRange[2]) }
  const singleDay = leadTime.match(/(\d+)\s*day/i)
  if (singleDay) return { min: Number(singleDay[1]), max: Number(singleDay[1]) }
  return null
}

function formatShortDate(d: Date): string {
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function TimelineStep({ icon: Icon, label, date, muted }: {
  icon: React.ComponentType<{ size?: number; className?: string; 'aria-hidden'?: boolean }>
  label: string
  date: string
  muted?: boolean
}) {
  return (
    <li className="flex flex-col items-center text-center gap-1 flex-1 min-w-0">
      <div className={cn(
        'w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0',
        muted ? 'bg-ivory text-muted border border-line' : 'bg-forest text-white'
      )}>
        <Icon size={15} aria-hidden={true} />
      </div>
      <p className="text-[13px] leading-[20px] font-[600] text-ink">{label}</p>
      <p className="text-[12px] leading-[16px] text-muted">{date}</p>
    </li>
  )
}

function DeliveryTimeline({ leadTime }: { leadTime: string }) {
  const range = parseLeadTimeDays(leadTime)
  if (!range) {
    return (
      <p className="flex items-start gap-2 type-caption text-muted">
        <Truck size={16} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
        <span>Estimated production time: <span className="text-ink font-[600]">{leadTime}</span></span>
      </p>
    )
  }

  const today = new Date()
  const readyStart = new Date(today)
  readyStart.setDate(today.getDate() + range.min)
  const readyEnd = new Date(today)
  readyEnd.setDate(today.getDate() + range.max)
  const readyLabel = range.min === range.max
    ? formatShortDate(readyStart)
    : `${formatShortDate(readyStart)} – ${formatShortDate(readyEnd)}`

  return (
    <ol className="flex items-start gap-2" aria-label="Estimated timeline if ordered today">
      <TimelineStep icon={ClipboardCheck} label="Ordered" date={formatShortDate(today)} />
      <TimelineStep icon={Truck} label="Ready to ship" date={readyLabel} />
      <TimelineStep icon={HomeIcon} label="Delivered" date="Varies by destination" muted />
    </ol>
  )
}

// ─── Small shared bits ─────────────────────────────────────────────────────────

function BrassStar({ size = 14, filled = true }: { size?: number; filled?: boolean }) {
  return (
    <Star
      size={size}
      className={filled ? 'text-brass-deep' : 'text-line'}
      fill="currentColor"
      aria-hidden="true"
    />
  )
}

function StarRow({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-hidden="true">
      {Array.from({ length: 5 }).map((_, i) => (
        <BrassStar key={i} size={size} filled={rating >= i + 0.5} />
      ))}
    </span>
  )
}

const LONG_DESCRIPTION = 320

function Description({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false)
  if (!text) return null
  const isLong = text.length > LONG_DESCRIPTION
  return (
    <div className="mt-4">
      <p className={cn('type-body text-muted whitespace-pre-wrap break-words', isLong && !expanded && 'line-clamp-5')}>
        {text}
      </p>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="mt-1 min-h-11 inline-flex items-center text-[14px] leading-[20px] font-[600] text-forest underline underline-offset-4"
        >
          {expanded ? 'Show less' : 'Read full description'}
        </button>
      )}
    </div>
  )
}

interface DetailRow {
  label: string
  value: React.ReactNode
}

/** Label/value rows, 14/20, 12px vertical padding, 1px line dividers. */
function DetailRows({ rows }: { rows: DetailRow[] }) {
  if (rows.length === 0) return null
  return (
    <dl className="border-t border-line">
      {rows.map((r) => (
        <div
          key={r.label}
          className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-4 py-3 border-b border-line text-[14px] leading-[20px]"
        >
          <dt className="font-[600] text-ink">{r.label}</dt>
          <dd className="text-muted break-words">{r.value}</dd>
        </div>
      ))}
    </dl>
  )
}

const GUEST_PANEL_HEADING = 'Wholesale prices for trade buyers'
const GUEST_PANEL_BODY = 'Create a buyer account to see the wholesale price for this product, its quantity tiers, and to place an order.'
const GUEST_CTA = 'Sign up to view wholesale prices'

// ─── Main component ───────────────────────────────────────────────────────────

export function ProductInfo({ product, categoryName }: { product: Product; categoryName?: string | null }) {
  const {
    id, name, description, materials, dimensions, weight,
    moq, stepQty, leadTime, placeOfOrigin, images, variants = [],
    isBestseller, isHandmade, isGITagged, ecoMaterials = [], ecoPackaging = [], ecoProduction = [],
    howItIsMade, craftImageUrl, tariffCode,
  } = product
  const ecoTags = [...ecoMaterials, ...ecoPackaging, ...ecoProduction]
  const leadImage = images?.[0]?.url ?? null

  const [quantity, setQuantity] = useState(moq)
  const qtyStep = stepQty || 1

  const axes = useMemo(() => buildAxes(variants), [variants])
  const [selectedAttrs, setSelectedAttrs] = useState<Record<string, string>>(() =>
    Object.fromEntries(axes.map((a) => [a.type, a.values[0]?.value]))
  )

  function selectAttr(type: string, value: string) {
    setSelectedAttrs((prev) => ({ ...prev, [type]: value }))
  }

  const { user, requireAuth, isAuthenticated, openAuthModal } = useAuth()
  const viewerRole = user?.role
  const currency = useCurrencyStore((s) => s.currency)

  const unitPrice = useMemo(
    () => resolveUnitPrice(product, selectedAttrs, quantity, viewerRole),
    [product, selectedAttrs, quantity, viewerRole]
  )

  // MOQ tiers — every priced tier for the current variant selection (or the
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

  const addItem = useCartStore((s) => s.addItem)
  const cartItems = useCartStore((s) => s.items)
  const updateCartQuantity = useCartStore((s) => s.updateQuantity)
  const removeFromCart = useCartStore((s) => s.removeItem)

  const activeVariant = findMatchingVariant(variants, selectedAttrs)
  const activeVariantId = activeVariant?.id
  const cartItem = cartItems.find((i) => i.productId === id && i.variantId === activeVariantId)
  const selectionUnavailable = axes.length > 0 && (!activeVariant || activeVariant.status === 'OUT_OF_STOCK')

  // A selected variant's own weight/dimensions (when set) take priority over
  // the product's flat strings — a Size L tote can weigh more than a Size S one.
  const displayWeight = activeVariant?.weight != null
    ? `${activeVariant.weight} ${activeVariant.weightUnit ?? 'kg'}`
    : weight
  const displayDimensions = activeVariant && (activeVariant.length != null || activeVariant.width != null || activeVariant.height != null)
    ? `${activeVariant.length ?? 0} x ${activeVariant.width ?? 0} x ${activeVariant.height ?? 0} ${activeVariant.dimensionUnit ?? 'cm'}`
    : dimensions
  const displayTariffCode = activeVariant?.tariffCode || tariffCode

  // Once this exact product+variant is in the cart, the CTA becomes a
  // "N in cart · total" pill that opens a quantity-picker dropdown instead.
  const [qtyMenuOpen, setQtyMenuOpen] = useState(false)
  const qtyMenuRef = useRef<HTMLDivElement>(null)
  const cartQtyOptions = useMemo(() => Array.from({ length: 20 }, (_, i) => moq + i * qtyStep), [moq, qtyStep])

  useEffect(() => {
    if (!qtyMenuOpen) return
    function handleClickOutside(e: MouseEvent) {
      if (qtyMenuRef.current && !qtyMenuRef.current.contains(e.target as Node)) setQtyMenuOpen(false)
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setQtyMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKey)
    }
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
      agentPrice: unitPrice,
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

  function openSignupGate() {
    requireAuth(() => {}, 'view_price', leadImage)
  }

  // ── Mobile sticky signup bar (guests) ──────────────────────────────────────
  // Shows only once the inline price panel has scrolled up past the top of
  // the viewport — not while it's still below the fold.
  const pricePanelRef = useRef<HTMLElement>(null)
  const [panelScrolledPast, setPanelScrolledPast] = useState(false)

  useEffect(() => {
    // The bar itself is also gated on !isAuthenticated at render time.
    if (isAuthenticated) return
    const el = pricePanelRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(([entry]) => {
      setPanelScrolledPast(!entry.isIntersecting && entry.boundingClientRect.top < 0)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [isAuthenticated])

  // ── Detail rows — real product fields only ─────────────────────────────────
  const detailRows: DetailRow[] = []
  if (materials) {
    detailRows.push({
      label: 'Materials',
      value: (
        <>
          <span className="block">{materials}</span>
          <span className="block mt-1 type-caption text-muted">
            Colour may vary slightly from the photos due to screen settings and natural variation in handcrafted dyeing and finishing.
          </span>
        </>
      ),
    })
  }
  if (displayDimensions) detailRows.push({ label: 'Dimensions', value: displayDimensions })
  if (displayWeight != null && displayWeight !== '') detailRows.push({ label: 'Weight', value: displayWeight })
  detailRows.push({ label: 'Minimum order', value: `${moq} units${qtyStep > 1 ? `, in cases of ${qtyStep}` : ''}` })
  if (leadTime) detailRows.push({ label: 'Production lead time', value: leadTime })
  if (placeOfOrigin) detailRows.push({ label: 'Made in', value: placeOfOrigin })
  detailRows.push({ label: 'Country of origin', value: 'India' })
  if (isHandmade) detailRows.push({ label: 'Handmade', value: 'Yes' })
  if (isGITagged) detailRows.push({ label: 'GI tag', value: 'Geographical Indication tagged' })
  if (ecoTags.length > 0) detailRows.push({ label: 'Sustainability', value: ecoTags.join(', ') })
  if (displayTariffCode) detailRows.push({ label: 'HS / tariff code', value: displayTariffCode })

  // Craft block: only the record's own craft story/photo. The artisan name is
  // deliberately NOT rendered — a named maker is supplier identity, which
  // buyers must never see (AGENTS.md: no seller/brand attribution).
  const hasCraft = !!(howItIsMade || craftImageUrl)

  const iconBtn =
    'w-11 h-11 rounded-full flex items-center justify-center text-ink hover:bg-ink/[8%] transition-colors duration-150 disabled:opacity-60'

  return (
    <div className="flex flex-col">
      {/* Eyebrow + actions */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex flex-wrap items-center gap-x-3 gap-y-1 pt-3">
          {categoryName && <p className="type-eyebrow text-brass-dark">{categoryName}</p>}
          {isBestseller && (
            <span className="inline-flex items-center rounded-[2px] bg-selected text-forest text-[12px] leading-[16px] font-[600] px-[7px] py-[2px]">
              Bestseller
            </span>
          )}
        </div>
        <div className="flex items-center flex-shrink-0 -mr-2">
          {isAgent && (
            <button
              type="button"
              aria-label={inCatalogue ? 'Remove from catalogue' : 'Add to catalogue'}
              aria-pressed={inCatalogue}
              onClick={handleToggleCatalogue}
              className={iconBtn}
            >
              {inCatalogue ? <BookmarkCheck size={20} aria-hidden="true" /> : <BookmarkPlus size={20} aria-hidden="true" />}
            </button>
          )}
          <button
            type="button"
            aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
            aria-pressed={isWishlisted}
            onClick={handleToggleWishlist}
            disabled={addToWishlist.isPending || removeFromWishlist.isPending}
            className={iconBtn}
          >
            <Heart
              size={20}
              className={isWishlisted ? 'text-forest' : 'text-ink'}
              fill={isWishlisted ? 'currentColor' : 'none'}
              aria-hidden="true"
            />
          </button>
          <button type="button" aria-label="Share this product" onClick={handleShare} className={iconBtn}>
            <Share2 size={19} aria-hidden="true" />
          </button>
        </div>
      </div>

      <h1 className="type-h1 text-ink mt-1 break-words">{name}</h1>

      {product.avgRating != null && product.avgRating > 0 && product.reviewCount > 0 && (
        <a
          href="#reviews"
          className="mt-3 inline-flex items-center gap-2 min-h-11 w-fit text-[14px] leading-[20px] text-ink underline underline-offset-4 decoration-line hover:decoration-forest"
        >
          <StarRow rating={product.avgRating} />
          <span>
            {product.avgRating.toFixed(1)}
            <span className="text-muted"> · {product.reviewCount} review{product.reviewCount === 1 ? '' : 's'}</span>
          </span>
          <span className="sr-only">, average rating out of 5. Go to reviews.</span>
        </a>
      )}

      <Description text={description} />

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="moq-tag">MOQ {moq} units</span>
        {qtyStep > 1 && <span className="type-caption text-muted">Sold in cases of {qtyStep}</span>}
      </div>

      {/* Variant selector — option names aren't price data, so guests see them too */}
      {axes.length > 0 && (
        <div className="mt-6 flex flex-col gap-5">
          {axes.map((axis) => {
            const unavailableValues = axis.values
              .filter(({ value }) => isValueUnavailable(variants, selectedAttrs, axis.type, value))
              .map(({ value }) => value)
            return (
              <fieldset key={axis.type}>
                <legend className="text-[14px] leading-[20px] font-[600] text-ink mb-2">
                  {axis.type}
                  {selectedAttrs[axis.type] && (
                    <span className="font-[400] text-muted">: {selectedAttrs[axis.type]}</span>
                  )}
                </legend>
                <div className="flex flex-wrap gap-2">
                  {axis.values.map(({ value: val, imageUrl }) => {
                    const selected = selectedAttrs[axis.type] === val
                    const unavailable = unavailableValues.includes(val)
                    const label = `${axis.type}: ${val}${unavailable ? ' (unavailable)' : ''}`

                    if (imageUrl) {
                      return (
                        <button
                          key={val}
                          type="button"
                          onClick={() => selectAttr(axis.type, val)}
                          className={cn(
                            'relative w-11 h-11 rounded-full overflow-hidden border border-line bg-white transition-shadow duration-150',
                            selected && 'ring-2 ring-forest ring-offset-2 ring-offset-bg',
                            unavailable && 'opacity-50'
                          )}
                          aria-label={label}
                          aria-pressed={selected}
                          title={label}
                        >
                          <Image src={cloudinaryFill(imageUrl, 160, 160)} alt="" fill sizes="44px" className="object-contain" />
                          {unavailable && (
                            <span
                              className="absolute inset-0 flex items-center justify-center pointer-events-none"
                              aria-hidden="true"
                            >
                              <span className="block w-[140%] h-px bg-ink rotate-45" />
                            </span>
                          )}
                        </button>
                      )
                    }

                    return (
                      <button
                        key={val}
                        type="button"
                        onClick={() => selectAttr(axis.type, val)}
                        className={cn(
                          'min-h-11 px-4 rounded-[4px] border text-[14px] leading-[20px] font-[600] transition-colors duration-150 inline-flex items-center gap-1.5',
                          selected
                            ? 'border-forest bg-forest text-white'
                            : 'border-line bg-white text-ink hover:border-forest',
                          unavailable && !selected && 'text-muted line-through decoration-1'
                        )}
                        aria-pressed={selected}
                        aria-label={label}
                      >
                        {selected && <CheckCircle2 size={14} aria-hidden="true" />}
                        {val}
                      </button>
                    )
                  })}
                </div>
                {unavailableValues.length > 0 && (
                  <p className="mt-2 type-caption text-muted">
                    Unavailable with your current selection: {unavailableValues.join(', ')}
                  </p>
                )}
              </fieldset>
            )
          })}
          {selectionUnavailable && (
            <p className="type-caption text-error font-[600]" role="status">
              This combination is currently unavailable. Choose another option.
            </p>
          )}
        </div>
      )}

      {/* Price panel — guests get a signup gate with NO price data in the DOM */}
      {!isAuthenticated ? (
        <section
          ref={pricePanelRef}
          aria-labelledby="pdp-price-gate-heading"
          className="mt-6 bg-white border border-line rounded-[6px] p-5 lg:p-6"
        >
          <h2 id="pdp-price-gate-heading" className="type-h3 text-ink">{GUEST_PANEL_HEADING}</h2>
          <p className="mt-2 type-body text-muted">{GUEST_PANEL_BODY}</p>
          <Button variant="primary" size="lg" className="mt-6 w-full" onClick={openSignupGate} aria-haspopup="dialog">
            {GUEST_CTA}
          </Button>
          <p className="mt-3 flex flex-wrap items-center gap-x-1 type-caption text-muted">
            Already have an account?
            <button
              type="button"
              onClick={() => openAuthModal('login', 'view_price', leadImage)}
              className="min-h-11 inline-flex items-center font-[600] text-forest underline underline-offset-4"
              aria-haspopup="dialog"
            >
              Sign in
            </button>
          </p>
        </section>
      ) : (
        <section
          ref={pricePanelRef}
          aria-labelledby="pdp-price-heading"
          className="mt-6 bg-white border border-line rounded-[6px] p-5 lg:p-6 flex flex-col gap-6"
        >
          <div>
            <h2 id="pdp-price-heading" className="type-eyebrow text-brass-deep">Wholesale price</h2>
            <p className="mt-2 type-price text-ink" aria-live="polite">{formatPrice(unitPrice)}</p>
            <p className="mt-1 type-caption text-muted">
              Per unit, in {currency}. Minimum order {moq} units.
            </p>
          </div>

          {moqTiers.length > 0 && (
            <div className="flex flex-col gap-2">
              <label htmlFor="pdp-moq-tier" className="text-[14px] leading-[20px] font-[600] text-ink">
                Quantity tier
              </label>
              <div className="relative">
                <select
                  id="pdp-moq-tier"
                  value={activeTierMoq}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  className="w-full min-h-12 pl-4 pr-10 rounded-[4px] border border-line bg-white text-[16px] leading-[24px] text-ink appearance-none hover:border-forest transition-colors duration-150"
                >
                  {moqTiers.map((tier) => (
                    <option key={tier.key} value={tier.moq}>
                      {tier.moq}+ units: {formatPrice(tier.adminPrice)} per unit
                    </option>
                  ))}
                </select>
                <ChevronDown size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" aria-hidden="true" />
              </div>
            </div>
          )}

          {cartItem ? (
            /* Already in cart — the stepper collapses into a single pill that
               opens a quantity-picker / remove menu. */
            <div className="relative" ref={qtyMenuRef}>
              <Button
                variant="primary"
                size="lg"
                className="w-full"
                onClick={() => setQtyMenuOpen((v) => !v)}
                aria-expanded={qtyMenuOpen}
                aria-haspopup="true"
              >
                {cartItem.quantity} in cart · {formatPrice(cartItem.unitAdminPriceInr * cartItem.quantity)}
                <ChevronDown
                  size={16}
                  className={cn('transition-transform duration-150', qtyMenuOpen && 'rotate-180')}
                  aria-hidden="true"
                />
              </Button>

              {qtyMenuOpen && (
                <div className="absolute left-0 right-0 top-full mt-1 z-20 bg-white border border-line rounded-[4px] shadow-lg max-h-[260px] overflow-y-auto">
                  <button
                    type="button"
                    onClick={handleRemoveFromCart}
                    className="w-full min-h-11 text-left px-4 text-[14px] leading-[20px] font-[600] text-error hover:bg-ivory transition-colors duration-150 border-b border-line"
                  >
                    Remove from cart
                  </button>
                  {cartQtyOptions.map((qty) => (
                    <button
                      key={qty}
                      type="button"
                      onClick={() => handleSelectCartQty(qty)}
                      aria-current={qty === cartItem.quantity ? 'true' : undefined}
                      className={cn(
                        'w-full min-h-11 text-left px-4 text-[14px] leading-[20px] text-ink hover:bg-ivory transition-colors duration-150',
                        qty === cartItem.quantity && 'font-[700] bg-selected'
                      )}
                    >
                      {qty}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <p className="text-[14px] leading-[20px] font-[600] text-ink">
                  Quantity <span className="font-[400] text-muted">(min. {moq}{qtyStep > 1 ? `, cases of ${qtyStep}` : ''})</span>
                </p>
                <QuantityStepper value={quantity} onChange={setQuantity} min={moq} step={qtyStep} />
              </div>
              <Button
                variant="primary"
                size="lg"
                onClick={handleAddToCart}
                className="w-full"
                aria-label={`Add ${quantity} units to cart, ${formatPrice(unitPrice * quantity)}`}
              >
                <ShoppingCart size={16} aria-hidden="true" />
                Add to cart · {formatPrice(unitPrice * quantity)}
              </Button>
            </div>
          )}

          {leadTime && <DeliveryTimeline leadTime={leadTime} />}
        </section>
      )}

      {/* Product details */}
      <section aria-labelledby="pdp-details-heading" className="mt-12">
        <h2 id="pdp-details-heading" className="type-h3 text-ink mb-4">Product details</h2>
        <DetailRows rows={detailRows} />
      </section>

      {hasCraft && (
        <section aria-labelledby="pdp-craft-heading" className="mt-12">
          <h2 id="pdp-craft-heading" className="type-h3 text-ink mb-4">About the craft</h2>
          {craftImageUrl && (
            <div className="relative w-full aspect-[16/10] rounded-[6px] overflow-hidden border border-line bg-white mb-4">
              <Image
                src={cloudinaryFill(craftImageUrl, 960, 600)}
                alt={`How ${name} is made`}
                fill
                sizes="(max-width: 1023px) 100vw, 560px"
                className="object-cover"
              />
            </div>
          )}
          {howItIsMade && <p className="type-body text-muted whitespace-pre-wrap break-words">{howItIsMade}</p>}
        </section>
      )}

      <CustomerReviews productId={id} />

      {/* Mobile sticky signup bar — guests only, after the inline panel scrolls off */}
      {!isAuthenticated && panelScrolledPast && (
        <div
          className="lg:hidden fixed inset-x-0 bottom-0 z-40 bg-white border-t border-line px-5 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))]"
          role="region"
          aria-label="Wholesale pricing"
        >
          <Button variant="primary" size="lg" className="w-full" onClick={openSignupGate} aria-haspopup="dialog">
            {GUEST_CTA}
          </Button>
        </div>
      )}
    </div>
  )
}

// ─── Ratings and Reviews ───────────────────────────────────────────────────────
// Shows the reviewing buyer's contact name only — never their company name.
// Review photos are optional, uploaded by the buyer at review time.

function ratingQuality(avg: number): string {
  if (avg >= 4.5) return 'Excellent'
  if (avg >= 4.0) return 'Very good'
  if (avg >= 3.0) return 'Good'
  if (avg >= 2.0) return 'Fair'
  return 'Needs improvement'
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

function RatingChip({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-[14px] leading-[20px] font-[600] text-ink">
      <BrassStar size={14} />
      {rating}
      <span className="sr-only"> out of 5</span>
    </span>
  )
}

// ─── "Customer photos" strip — every photo across every review, flattened. ────

function ReviewPhotoStrip({ reviews, onOpenPhoto }: { reviews: Review[]; onOpenPhoto: (photos: LightboxImage[], index: number) => void }) {
  const allPhotos = useMemo<LightboxImage[]>(() => {
    const flat = reviews.flatMap((r) => r.images.map((img) => img.url))
    return flat.map((src, i) => ({ src, alt: `Customer photo ${i + 1} of ${flat.length}` }))
  }, [reviews])
  const VISIBLE = 5
  const shown = allPhotos.slice(0, VISIBLE)
  const extra = allPhotos.length - shown.length

  if (shown.length === 0) return null

  return (
    <div className="flex flex-col gap-2 mb-6">
      <p className="type-eyebrow text-brass-dark">Customer photos</p>
      <div className="flex flex-wrap gap-3">
        {shown.map((photo, i) => {
          const isLast = i === shown.length - 1
          return (
            <button
              key={photo.src + i}
              type="button"
              onClick={() => onOpenPhoto(allPhotos, i)}
              className="relative w-16 h-16 lg:w-[72px] lg:h-[72px] rounded-[4px] overflow-hidden border border-line bg-white flex-shrink-0"
              aria-label={isLast && extra > 0 ? `See all ${allPhotos.length} customer photos` : `View ${photo.alt.toLowerCase()}`}
              aria-haspopup="dialog"
            >
              <Image src={photo.src} alt="" fill sizes="72px" className="object-cover" />
              {isLast && extra > 0 && (
                <span className="absolute inset-0 bg-forest/80 flex items-center justify-center text-white text-[14px] font-[700]" aria-hidden="true">
                  +{extra}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Review card — opens the full detail modal. ───────────────────────────────

function ReviewCard({ review, onOpen }: { review: Review; onOpen: () => void }) {
  const thumbs = review.images.slice(0, 3)

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex flex-col flex-shrink-0 w-[260px] sm:w-[280px] bg-white border border-line rounded-[6px] p-4 text-left hover:border-forest transition-colors duration-150"
      aria-haspopup="dialog"
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <RatingChip rating={review.rating} />
        <span className="text-[12px] leading-[16px] text-muted flex-shrink-0">{timeAgo(review.createdAt)}</span>
      </div>

      <p className="text-[14px] leading-[20px] text-ink mb-3 line-clamp-4">
        {review.comment || <span className="text-muted italic">No written feedback</span>}
      </p>

      {thumbs.length > 0 && (
        <div className="flex gap-1.5 mb-3">
          {thumbs.map((img) => (
            <div key={img.id} className="relative w-10 h-10 rounded-[4px] overflow-hidden bg-ivory flex-shrink-0">
              <Image src={img.url} alt="" fill sizes="40px" className="object-cover" />
            </div>
          ))}
          {review.images.length > 3 && (
            <div className="w-10 h-10 rounded-[4px] bg-ivory flex-shrink-0 flex items-center justify-center">
              <span className="text-[12px] font-[600] text-muted">+{review.images.length - 3}</span>
            </div>
          )}
        </div>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-0.5">
        <span className="text-[13px] leading-[20px] font-[600] text-ink">{review.buyerName}</span>
        <span className="inline-flex items-center gap-1 text-[12px] leading-[16px] text-muted">
          <CheckCircle2 size={12} aria-hidden="true" />
          Verified buyer
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

  const arrow =
    'w-11 h-11 rounded-full bg-white border border-line flex items-center justify-center text-forest hover:border-forest transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed'

  return (
    <div className="flex flex-col gap-3">
      <div ref={scrollRef} className="flex gap-3 overflow-x-auto scrollbar-none scroll-smooth py-1">
        {reviews.map((review, i) => (
          <ReviewCard key={review.id} review={review} onOpen={() => onOpenReview(i)} />
        ))}
      </div>
      {(canScrollLeft || canScrollRight) && (
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => scrollByCard(-1)} disabled={!canScrollLeft} aria-label="Show previous reviews" className={arrow}>
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
          <button type="button" onClick={() => scrollByCard(1)} disabled={!canScrollRight} aria-label="Show more reviews" className={arrow}>
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Review detail modal — full text + own photos, with prev/next. ────────────

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
  onOpenPhoto: (photos: LightboxImage[], photoIndex: number) => void
}) {
  const review = reviews[index]
  if (!review) return null

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-[560px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <RatingChip rating={review.rating} />
            <span className="text-[13px] leading-[20px] text-muted">{timeAgo(review.createdAt)}</span>
          </div>
          <DialogTitle className="text-[16px] leading-[24px] font-sans font-[600]">{review.buyerName}</DialogTitle>
          <span className="inline-flex items-center gap-1 text-[13px] leading-[20px] text-muted">
            <CheckCircle2 size={13} aria-hidden="true" />
            Verified buyer
          </span>
        </DialogHeader>

        <div className="px-6 pb-6 flex flex-col gap-4">
          <p className="type-body text-ink whitespace-pre-wrap break-words">
            {review.comment || <span className="text-muted italic">No written feedback</span>}
          </p>

          {review.images.length > 0 && (
            <div className="flex gap-3 flex-wrap">
              {review.images.map((img, i) => (
                <button
                  key={img.id}
                  type="button"
                  onClick={() =>
                    onOpenPhoto(
                      review.images.map((im, j) => ({ src: im.url, alt: `Photo ${j + 1} from ${review.buyerName}'s review` })),
                      i
                    )
                  }
                  className="relative w-20 h-20 rounded-[4px] overflow-hidden border border-line bg-ivory"
                  aria-label={`View photo ${i + 1} from this review`}
                  aria-haspopup="dialog"
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
              className="min-h-11 inline-flex items-center gap-1 text-[14px] leading-[20px] font-[600] text-forest"
            >
              <ChevronLeft size={16} aria-hidden="true" />
              Previous review
            </button>
            <span className="text-[13px] leading-[20px] text-muted self-center">{index + 1} / {reviews.length}</span>
            <button
              type="button"
              onClick={() => onIndexChange(index === reviews.length - 1 ? 0 : index + 1)}
              className="min-h-11 inline-flex items-center gap-1 text-[14px] leading-[20px] font-[600] text-forest"
            >
              Next review
              <ChevronRight size={16} aria-hidden="true" />
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
  const [photoLightbox, setPhotoLightbox] = useState<{ photos: LightboxImage[]; index: number } | null>(null)

  if (isLoading || !data || data.reviewCount === 0) return null

  const avg = data.avgRating ?? 0

  return (
    <section id="reviews" aria-labelledby="pdp-reviews-heading" className="mt-12 scroll-mt-24">
      <h2 id="pdp-reviews-heading" className="type-h3 text-ink mb-4">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="w-full min-h-11 flex items-center justify-between gap-3 text-left"
          aria-expanded={open}
          aria-controls="pdp-reviews-body"
        >
          Ratings and reviews
          <ChevronDown
            size={20}
            className={cn('text-muted transition-transform duration-150 flex-shrink-0', open && 'rotate-180')}
            aria-hidden="true"
          />
        </button>
      </h2>

      {open && (
        <div id="pdp-reviews-body">
          <div className="flex flex-wrap items-center gap-3 mb-1">
            <span className="text-[28px] leading-[34px] font-[600] text-ink">{avg.toFixed(1)}</span>
            <StarRow rating={avg} size={18} />
            <span className="moq-tag">{ratingQuality(avg)}</span>
          </div>
          <p className="type-caption text-muted mb-6">
            <span className="sr-only">Average {avg.toFixed(1)} out of 5, </span>
            based on {data.reviewCount} rating{data.reviewCount === 1 ? '' : 's'} from verified buyers
          </p>

          <ReviewPhotoStrip reviews={data.items} onOpenPhoto={(photos, index) => setPhotoLightbox({ photos, index })} />

          <ReviewCardCarousel reviews={data.items} onOpenReview={setReviewDetailIndex} />
        </div>
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
        <ImageLightbox
          images={photoLightbox.photos}
          initialIndex={photoLightbox.index}
          title="Customer photos"
          onClose={() => setPhotoLightbox(null)}
        />
      )}
    </section>
  )
}
