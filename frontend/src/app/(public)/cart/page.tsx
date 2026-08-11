'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { useCart } from '@/providers/CartProvider';
import { formatCurrency } from '@/utils/formatCurrency';

export default function CartPage() {
  const { items, subtotal, updateQuantity, removeItem } = useCart();

  return (
    <div className="mx-auto max-w-content px-margin-mobile py-section-mobile md:px-margin-desktop md:py-section-desktop">
      <h1 className="font-serif text-h1 text-text-primary">Your Order</h1>

      {items.length === 0 ? (
        <div className="mt-10 rounded-card border border-border bg-bg-surface p-10 text-center">
          <p className="text-body text-text-muted">Your cart is empty.</p>
          <Button asChild className="mt-4 inline-flex">
            <Link href="/categories">Browse Products</Link>
          </Button>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-10 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            {items.map((item) => (
              <div
                key={item.productId}
                className="flex flex-col gap-4 rounded-card border border-border bg-bg-surface p-4 sm:flex-row sm:items-center"
              >
                <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-card bg-fill-subtle">
                  {item.imageUrl && <Image src={item.imageUrl} alt={item.name} fill className="object-cover" />}
                </div>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/products/${item.slug}`}
                    className="font-serif text-h4 text-text-primary transition-colors hover:text-accent-primary"
                  >
                    {item.name}
                  </Link>
                  <p className="mt-1 text-small text-text-muted">
                    {formatCurrency(item.adminPrice)} &middot; MOQ {item.moq}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <label className="text-small font-medium text-text-primary">Quantity</label>
                    <input
                      type="number"
                      min={item.moq}
                      step={1}
                      value={item.quantity}
                      onChange={(event) => {
                        const next = Number(event.target.value);
                        if (Number.isFinite(next) && next >= 1) updateQuantity(item.productId, next);
                      }}
                      className="h-9 w-24 rounded-input border border-border bg-bg-primary px-3 text-sm text-text-primary outline-none transition-colors focus:border-accent-primary focus:ring-1 focus:ring-accent-primary"
                    />
                    <button
                      type="button"
                      onClick={() => removeItem(item.productId)}
                      className="text-small font-semibold text-error hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                  {item.quantity < item.moq && (
                    <p className="mt-1 text-caption text-error">Below minimum order quantity of {item.moq}.</p>
                  )}
                </div>
                <p className="shrink-0 text-body-lg font-medium text-text-primary sm:text-right">
                  {formatCurrency(Number(item.adminPrice) * item.quantity)}
                </p>
              </div>
            ))}
          </div>

          <div className="space-y-4">
            <div className="rounded-card border border-border bg-bg-surface p-6">
              <h2 className="font-serif text-h4 text-text-primary">Order Summary</h2>
              <div className="mt-4 flex justify-between text-small text-text-muted">
                <span>Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              <div className="mt-2 flex justify-between border-t border-border pt-3 text-body-lg font-medium text-text-primary">
                <span>Total</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              <Button asChild size="lg" className="mt-6 w-full">
                <Link href="/checkout">Proceed to Checkout</Link>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
