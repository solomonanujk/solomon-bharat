'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Lock, MapPin, ShieldCheck, Timer } from 'lucide-react'
import { useCartStore } from '@/lib/store/useCartStore'
import { useCurrencyStore } from '@/lib/store/useCurrencyStore'
import { useAuth } from '@/hooks/useAuth'
import { useCheckout, useCheckoutFxRate } from '@/hooks/queries/usePayments'
import { useAddresses } from '@/hooks/queries/useAddresses'
import { NavBar } from '@/components/shared/NavBar'
import { Footer } from '@/components/shared/Footer'
import { EmptyState } from '@/components/shared/EmptyState'
import { useImageLightbox } from '@/components/shared/ImageLightbox'
import { useFormatPrice } from '@/components/ui/Price'
import { cn } from '@/lib/utils'
import type { Address } from '@/types'

const PAYMENT_ID_KEY = 'sb_checkout_payment_id'
const ORDER_ID_KEY = 'sb_checkout_order_id'

// ─── Delivery address ───────────────────────────────────────────────────────────

function AddressOption({
  address,
  selected,
  onSelect,
}: {
  address: Address
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'w-full text-left border rounded p-4 flex items-start gap-3 transition-colors',
        selected ? 'border-primary bg-primary/[0.03]' : 'border-border-warm hover:border-primary/30'
      )}
    >
      <span
        className={cn(
          'mt-0.5 w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center',
          selected ? 'border-primary' : 'border-border-warm'
        )}
      >
        {selected && <span className="w-2 h-2 rounded-full bg-primary" />}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-[13px] font-[600] font-public-sans text-primary">{address.label || 'Address'}</p>
          {address.isDefault && (
            <span className="text-[10px] font-[600] font-public-sans text-accent bg-accent/10 rounded px-1.5 py-0.5">
              Default
            </span>
          )}
        </div>
        <p className="text-[12.5px] font-public-sans text-muted-text leading-relaxed mt-1">
          {address.line1}{address.line2 ? `, ${address.line2}` : ''}
          <br />
          {[address.city, address.state, address.postalCode].filter(Boolean).join(', ')}
          <br />
          {address.country}
        </p>
      </div>
    </button>
  )
}

function DeliveryAddressSection({
  selectedId,
  onSelect,
}: {
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const { data: addresses = [], isLoading } = useAddresses()

  return (
    <div className="bg-surface border border-border-warm rounded p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[14px] leading-[1.4] font-[600] font-public-sans text-primary flex items-center gap-2">
          <MapPin size={15} className="text-accent" aria-hidden="true" />
          Delivery Address
        </h2>
        <Link href="/profile" className="text-[12.5px] font-[600] font-public-sans text-accent hover:text-accent-hover">
          Manage addresses
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-20 rounded bg-muted-bg animate-pulse" />
          ))}
        </div>
      ) : addresses.length === 0 ? (
        <div className="border border-dashed border-border-warm rounded p-5 text-center">
          <p className="text-[13px] font-public-sans text-muted-text mb-3">
            You haven&apos;t added a shipping address yet.
          </p>
          <Link
            href="/profile"
            className="inline-flex items-center text-[13px] font-[600] font-public-sans text-accent hover:text-accent-hover"
          >
            Add an address
          </Link>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {addresses.map((address) => (
            <AddressOption
              key={address.id}
              address={address}
              selected={selectedId === address.id}
              onSelect={() => onSelect(address.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Price details ──────────────────────────────────────────────────────────────

function PriceDetails({
  itemCount,
  total,
  disabled,
  isPending,
  errorMessage,
  onPlaceOrder,
}: {
  itemCount: number
  total: number
  disabled: boolean
  isPending: boolean
  errorMessage: string | null
  onPlaceOrder: () => void
}) {
  const fmt = useFormatPrice()
  const currency = useCurrencyStore((s) => s.currency)
  const { data: fxRate } = useCheckoutFxRate(currency)

  return (
    <aside className="sticky top-24">
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

        {fxRate && (
          <p className="text-[11px] font-public-sans text-muted-text mt-2">
            Live rate: 1 INR ≈ {fxRate.rate.toFixed(4)} {fxRate.currency} — the exact rate charged at payment.
          </p>
        )}

        {errorMessage && (
          <p className="text-[12px] font-public-sans text-error mt-3" role="alert">
            {errorMessage}
          </p>
        )}

        <button
          type="button"
          onClick={onPlaceOrder}
          disabled={disabled || isPending}
          className="w-full h-12 mt-5 rounded bg-primary text-white font-[600] font-public-sans text-[14px] hover:bg-[#2a2a2a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? 'Redirecting to PayPal…' : 'Pay with PayPal'}
        </button>
        {disabled && !isPending && (
          <p className="text-[11px] font-public-sans text-muted-text mt-2 text-center">
            Select a delivery address to continue.
          </p>
        )}
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

export default function CheckoutPage() {
  const fmt = useFormatPrice()
  const { requireAuth } = useAuth()
  const currency = useCurrencyStore((s) => s.currency)
  const items = useCartStore((s) => s.items)
  const getTotalValueInr = useCartStore((s) => s.getTotalValueInr)
  const getTotalItems = useCartStore((s) => s.getTotalItems)
  const checkout = useCheckout()
  const { data: addresses = [] } = useAddresses()
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const { openLightbox, lightboxNode } = useImageLightbox()

  useEffect(() => {
    if (selectedAddressId || addresses.length === 0) return
    setSelectedAddressId(addresses.find((a) => a.isDefault)?.id ?? addresses[0].id)
  }, [addresses, selectedAddressId])

  const isEmpty = items.length === 0
  const total = getTotalValueInr()
  const itemCount = getTotalItems()

  function handlePlaceOrder() {
    if (!selectedAddressId) {
      setErrorMessage('Select a delivery address to continue.')
      return
    }
    requireAuth(() => {
      setErrorMessage(null)
      checkout.mutate(
        {
          items: items.map((i) => ({ productId: i.productId, quantity: i.quantity, variantId: i.variantId })),
          shippingAddressId: selectedAddressId,
          currency: currency !== 'INR' ? currency : undefined,
        },
        {
          onSuccess: (result) => {
            if (typeof window !== 'undefined') {
              sessionStorage.setItem(PAYMENT_ID_KEY, result.paymentId)
              sessionStorage.setItem(ORDER_ID_KEY, result.orderId)
            }
            if (result.approveUrl) {
              window.location.href = result.approveUrl
            } else {
              setErrorMessage('Could not start the PayPal checkout. Please try again.')
            }
          },
          onError: () => {
            setErrorMessage('Something went wrong starting checkout. Please try again.')
          },
        }
      )
    }, 'checkout')
  }

  return (
    <div className="bg-bg min-h-screen flex flex-col">
      <NavBar />

      <main className="flex-1 max-w-[1120px] mx-auto w-full px-4 sm:px-6 py-8 sm:py-12">
        <div className="flex items-center gap-4 mb-8 sm:mb-10">
          <Link
            href="/cart"
            aria-label="Back to cart"
            className="w-9 h-9 flex items-center justify-center rounded-full border border-border-warm text-muted-text hover:text-primary hover:bg-muted-bg transition-colors flex-shrink-0"
          >
            <ArrowLeft size={16} aria-hidden="true" />
          </Link>
          <h1 className="text-[24px] sm:text-[32px] leading-[1.2] font-[500] font-playfair text-primary">
            Checkout
          </h1>
        </div>

        {isEmpty ? (
          <EmptyState
            title="Your cart is empty"
            description="Add items to your cart before checking out."
            action={{ label: 'Browse categories', onClick: () => { window.location.href = '/categories' } }}
          />
        ) : (
          <div className="lg:grid lg:grid-cols-[1fr_360px] gap-8 items-start">
            <div className="flex flex-col gap-6">
              <DeliveryAddressSection selectedId={selectedAddressId} onSelect={setSelectedAddressId} />

              {/* Order review */}
              <div className="bg-surface border border-border-warm rounded p-6">
                <h2 className="text-[14px] leading-[1.4] font-[600] font-public-sans text-primary mb-4">
                  Review your order ({itemCount} item{itemCount === 1 ? '' : 's'})
                </h2>
                <div className="flex flex-col gap-4">
                  {items.map((item) => (
                    <div key={`${item.productId}-${item.variantId ?? ''}`} className="flex gap-3 items-start pb-4 border-b border-border-warm last:border-b-0 last:pb-0">
                      <button
                        type="button"
                        onClick={() => openLightbox(item.image, item.productName)}
                        disabled={!item.image}
                        className="w-16 h-16 flex-shrink-0 rounded overflow-hidden bg-muted-bg border border-border-warm disabled:cursor-default"
                        aria-label={item.image ? `View ${item.productName} full size` : undefined}
                      >
                        {item.image ? (
                          <img src={item.image} alt={item.productName} className="w-full h-full object-cover cursor-zoom-in" />
                        ) : (
                          <div className="w-full h-full bg-muted-bg" />
                        )}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13.5px] font-[600] font-public-sans text-primary leading-snug">
                          {item.productName}
                        </p>
                        {item.variantLabel && (
                          <p className="text-[11px] font-public-sans text-muted-text mt-0.5">{item.variantLabel}</p>
                        )}
                        <p className="text-[11.5px] font-public-sans text-muted-text mt-0.5">
                          Qty {item.quantity} &middot; {fmt(item.unitAdminPriceInr)} / unit
                        </p>
                        {item.leadTime && (
                          <p className="inline-flex items-center gap-1 text-[11px] font-public-sans text-muted-text mt-0.5">
                            <Timer size={11} className="text-accent" aria-hidden="true" />
                            Lead time: {item.leadTime}
                          </p>
                        )}
                      </div>
                      <span className="text-[13.5px] font-[700] font-public-sans text-primary flex-shrink-0 ml-2">
                        {fmt(item.unitAdminPriceInr * item.quantity)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 lg:mt-0">
              <PriceDetails
                itemCount={itemCount}
                total={total}
                disabled={!selectedAddressId}
                isPending={checkout.isPending}
                errorMessage={errorMessage}
                onPlaceOrder={handlePlaceOrder}
              />
            </div>
          </div>
        )}
      </main>

      <Footer />
      {lightboxNode}
    </div>
  )
}
