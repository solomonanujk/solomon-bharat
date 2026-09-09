'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Heart, Lock, Minus, Plus, ShieldCheck, Timer, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useCartStore } from '@/lib/store/useCartStore'
import { useAuth } from '@/hooks/useAuth'
import { useAddToWishlist } from '@/hooks/queries/useWishlist'
import { NavBar } from '@/components/shared/NavBar'
import { Footer } from '@/components/shared/Footer'
import { EmptyState } from '@/components/shared/EmptyState'
import { Price, useFormatPrice } from '@/components/ui/Price'
import type { CartItem } from '@/types'

// ─── Cart line ────────────────────────────────────────────────────────────────

function CartLine({ item }: { item: CartItem }) {
  const updateQuantity = useCartStore((s) => s.updateQuantity)
  const removeItem = useCartStore((s) => s.removeItem)
  const { requireAuth } = useAuth()
  const addToWishlist = useAddToWishlist()
  const fmt = useFormatPrice()
  const lineTotal = item.unitAdminPriceInr * item.quantity

  function handleMoveToWishlist() {
    requireAuth(() => {
      addToWishlist.mutate(item.productId)
      removeItem(item.productId, item.variantId)
    }, 'add_to_wishlist')
  }

  return (
    <div className="flex gap-4 py-5 border-b border-border-warm last:border-b-0">
      <Link href={`/products/${item.productSlug}`} className="w-24 h-24 flex-shrink-0 rounded overflow-hidden bg-muted-bg border border-border-warm">
        {item.image ? (
          <img src={item.image} alt={item.productName} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-muted-bg" />
        )}
      </Link>

      <div className="flex-1 min-w-0 flex flex-col justify-between gap-3">
        <div>
          <Link
            href={`/products/${item.productSlug}`}
            className="text-[15px] font-[600] font-public-sans text-primary leading-snug hover:underline"
          >
            {item.productName}
          </Link>
          {item.variantLabel && (
            <p className="text-[12px] font-public-sans text-muted-text mt-0.5">{item.variantLabel}</p>
          )}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
            <span className="text-[12px] font-public-sans text-muted-text">
              MOQ: <span className="text-primary font-[600]">{item.moq} units</span>
            </span>
            <span className="text-[12px] font-public-sans text-muted-text">
              <Price amountInr={item.unitAdminPriceInr} size="sm" className="inline text-primary font-[600]" />/unit
            </span>
            {item.leadTime && (
              <span className="inline-flex items-center gap-1 text-[12px] font-public-sans text-muted-text">
                <Timer size={12} className="text-accent" aria-hidden="true" />
                Lead time: {item.leadTime}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center border border-border-warm rounded w-fit">
              <button
                type="button"
                onClick={() => updateQuantity(item.productId, item.quantity - 1, item.variantId)}
                disabled={item.quantity <= item.moq}
                className="h-8 px-2.5 inline-flex items-center justify-center text-primary hover:bg-muted-bg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                aria-label="Decrease quantity"
              >
                <Minus size={12} />
              </button>
              <span className="w-10 text-center text-[13px] font-[600] font-public-sans text-primary select-none">
                {item.quantity}
              </span>
              <button
                type="button"
                onClick={() => updateQuantity(item.productId, item.quantity + 1, item.variantId)}
                className="h-8 px-2.5 inline-flex items-center justify-center text-primary hover:bg-muted-bg transition-colors"
                aria-label="Increase quantity"
              >
                <Plus size={12} />
              </button>
            </div>

            <button
              type="button"
              onClick={handleMoveToWishlist}
              className="inline-flex items-center gap-1.5 text-[12px] font-[600] font-public-sans text-muted-text hover:text-primary transition-colors"
            >
              <Heart size={13} aria-hidden="true" />
              Move to Wishlist
            </button>

            <button
              type="button"
              onClick={() => {
                removeItem(item.productId, item.variantId)
                toast.success('Removed from cart')
              }}
              aria-label="Remove item"
              className="text-muted-text hover:text-error transition-colors"
            >
              <Trash2 size={15} />
            </button>
          </div>

          <span className="text-[16px] font-[700] font-public-sans text-primary">
            {fmt(lineTotal)}
          </span>
        </div>
      </div>
    </div>
  )
}

// ─── Price details sidebar ──────────────────────────────────────────────────────

function PriceDetails({ itemCount, total, onCheckout }: { itemCount: number; total: number; onCheckout: () => void }) {
  const fmt = useFormatPrice()

  return (
    <aside className="sticky top-24 md:top-[140px]">
      <div className="bg-surface border border-border-warm rounded p-5">
        <p className="text-[12px] font-[700] font-public-sans text-muted-text uppercase tracking-[0.06em] pb-4 border-b border-border-warm">
          Price Details
        </p>

        <div className="flex flex-col gap-3 py-4 text-[14px] font-public-sans">
          <div className="flex justify-between">
            <span className="text-muted-text">Price ({itemCount} item{itemCount === 1 ? '' : 's'})</span>
            <span className="text-primary font-[500]">{fmt(total)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-text">Shipping</span>
            <span className="text-primary font-[500]">Included</span>
          </div>
        </div>

        <div className="flex justify-between pt-4 border-t border-border-warm">
          <span className="text-[15px] font-[700] font-public-sans text-primary">Total Amount</span>
          <span className="text-[18px] font-[700] font-public-sans text-primary">{fmt(total)}</span>
        </div>

        <button
          type="button"
          onClick={onCheckout}
          className="w-full h-12 mt-5 rounded bg-primary text-white font-[600] font-public-sans text-[14px] hover:bg-[#2a2a2a] transition-colors"
        >
          Proceed to Checkout
        </button>
      </div>

      <div className="flex flex-col gap-2.5 mt-4 px-1">
        <div className="flex items-center gap-2 text-[12px] font-public-sans text-muted-text">
          <ShieldCheck size={14} className="text-accent flex-shrink-0" aria-hidden="true" />
          Verified sellers, quality-checked before listing
        </div>
        <div className="flex items-center gap-2 text-[12px] font-public-sans text-muted-text">
          <Lock size={14} className="text-accent flex-shrink-0" aria-hidden="true" />
          Secure checkout via PayPal
        </div>
      </div>
    </aside>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CartPage() {
  const router = useRouter()
  const items = useCartStore((s) => s.items)
  const getTotalValueInr = useCartStore((s) => s.getTotalValueInr)
  const getTotalItems = useCartStore((s) => s.getTotalItems)

  const isEmpty = items.length === 0
  const total = getTotalValueInr()
  const itemCount = getTotalItems()

  return (
    <div className="bg-bg min-h-screen flex flex-col">
      <NavBar />

      <main className="flex-1 max-w-[1120px] mx-auto w-full px-4 sm:px-6 py-6 sm:py-10">
        <div className="flex items-center gap-4 mb-8">
          <button
            type="button"
            onClick={() => router.back()}
            className="w-9 h-9 flex items-center justify-center rounded-full border border-border-warm text-muted-text hover:text-primary hover:bg-muted-bg transition-colors flex-shrink-0"
            aria-label="Go back"
          >
            <ArrowLeft size={16} aria-hidden="true" />
          </button>
          <h1 className="font-playfair font-[500] text-primary text-[24px] sm:text-[32px] leading-[1.1]">
            My Cart{!isEmpty && ` (${itemCount} item${itemCount === 1 ? '' : 's'})`}
          </h1>
        </div>

        {isEmpty ? (
          <EmptyState
            title="Your cart is empty"
            description="Browse our curated selection of Indian artisan goods."
            action={{ label: 'Continue shopping', onClick: () => router.push('/') }}
          />
        ) : (
          <div className="lg:grid lg:grid-cols-[1fr_340px] gap-8 items-start">
            <div className="bg-surface border border-border-warm rounded px-5 flex flex-col">
              {items.map((item) => (
                <CartLine key={`${item.productId}-${item.variantId ?? ''}`} item={item} />
              ))}
            </div>

            <div className="mt-6 lg:mt-0">
              <PriceDetails itemCount={itemCount} total={total} onCheckout={() => router.push('/checkout')} />
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}
