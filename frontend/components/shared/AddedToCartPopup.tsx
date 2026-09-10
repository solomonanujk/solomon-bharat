'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { X } from 'lucide-react'
import { useCartStore } from '@/lib/store/useCartStore'
import { cloudinaryFill } from '@/lib/cloudinaryImage'
import { useFormatPrice } from '@/components/ui/Price'

const AUTO_DISMISS_MS = 4000

/**
 * Global "Added to cart" popup — top-right, auto-dismissing. Triggered directly by
 * useCartStore.addItem itself (not by each call site), so every add-to-cart action
 * anywhere in the app (PDP, product cards, wishlist, agent portal) shows it for free.
 * No seller/brand name or per-seller order-minimum progress bar like Faire's reference —
 * this platform never shows seller identity to buyers, and has no per-seller minimum.
 */
export function AddedToCartPopup() {
  const item = useCartStore((s) => s.lastAddedItem)
  const visible = useCartStore((s) => s.addedPopupVisible)
  const hide = useCartStore((s) => s.hideAddedPopup)
  const formatPrice = useFormatPrice()

  useEffect(() => {
    if (!visible) return
    const timer = setTimeout(hide, AUTO_DISMISS_MS)
    return () => clearTimeout(timer)
  }, [visible, item, hide])

  if (!visible || !item) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-20 right-4 z-[100] w-[92vw] max-w-[360px] bg-surface border border-border-warm rounded-lg shadow-xl overflow-hidden"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-warm">
        <p className="font-playfair text-[18px] font-[500] text-primary">Added to cart</p>
        <button
          type="button"
          onClick={hide}
          aria-label="Close"
          className="text-muted-text hover:text-primary transition-colors"
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      <div className="flex items-start gap-3 px-4 py-4">
        <div className="relative w-16 h-16 rounded overflow-hidden bg-muted-bg flex-shrink-0">
          {item.image && (
            <Image src={cloudinaryFill(item.image, 160, 160)} alt={item.productName} fill sizes="64px" className="object-contain" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-public-sans text-[14px] font-[500] text-product-text leading-snug line-clamp-2">
            {item.productName}
          </p>
          {item.variantLabel && (
            <p className="font-public-sans text-[13px] text-muted-text mt-0.5">{item.variantLabel}</p>
          )}
          <p className="font-public-sans text-[13px] text-muted-text mt-1">Qty: {item.quantity}</p>
          <p className="font-public-sans text-[14px] font-[600] text-product-text mt-0.5">
            {formatPrice(item.unitAdminPriceInr * item.quantity)}
          </p>
        </div>
      </div>

      <div className="px-4 pb-4">
        <Link
          href="/checkout"
          onClick={hide}
          className="flex items-center justify-center h-11 w-full rounded bg-primary text-white text-[14px] font-[600] font-public-sans hover:bg-primary/90 transition-colors"
        >
          Proceed to checkout
        </Link>
      </div>
    </div>
  )
}
