'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Minus, Plus, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useCart } from '@/providers/CartProvider';
import { formatCurrency } from '@/utils/formatCurrency';

export default function CartPage() {
  const { items, subtotal, updateQuantity, removeItem } = useCart();

  if (items.length === 0) {
    return (
      <div className="mx-auto flex max-w-content flex-col items-center gap-4 px-margin-mobile py-section-mobile text-center md:px-margin-desktop md:py-section-desktop">
        <ShoppingBag size={44} className="text-border" aria-hidden="true" />
        <h1 className="font-serif text-h2 text-text-primary">Your order is empty</h1>
        <p className="max-w-sm text-body text-text-muted">
          Browse our categories to find wholesale goods sourced from trusted Indian suppliers.
        </p>
        <Button asChild size="lg" className="mt-2">
          <Link href="/categories">Browse Products</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-content px-margin-mobile py-section-mobile md:px-margin-desktop md:py-section-desktop">
      <h1 className="font-serif text-h1 text-text-primary">Your Order</h1>
      <p className="mt-2 text-small text-text-muted">
        {items.length} item{items.length !== 1 ? 's' : ''} in your order
      </p>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px] lg:items-start lg:gap-10">
        <div className="rounded-card border border-border bg-bg-surface">
          {items.map((item, index) => {
            const belowMoq = item.quantity < item.moq;
            return (
              <div
                key={item.productId}
                className={`flex gap-4 p-5 ${index !== items.length - 1 ? 'border-b border-border' : ''}`}
              >
                <div className="relative h-[110px] w-[110px] shrink-0 overflow-hidden rounded-input border border-border bg-fill-subtle">
                  {item.imageUrl && <Image src={item.imageUrl} alt={item.name} fill className="object-cover" />}
                </div>

                <div className="flex min-w-0 flex-1 flex-col justify-between">
                  <div>
                    <Link
                      href={`/products/${item.slug}`}
                      className="font-serif text-h4 leading-snug text-text-primary transition-colors hover:text-accent-primary"
                    >
                      {item.name}
                    </Link>
                    <p className="mt-1 text-small text-text-muted">Min. {item.moq} units per order</p>
                    {belowMoq && (
                      <p className="mt-1 text-caption text-error">Below minimum order quantity of {item.moq}.</p>
                    )}
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-4">
                    <div className="inline-flex items-center overflow-hidden rounded-input border border-border">
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                        disabled={item.quantity <= 1}
                        aria-label="Decrease quantity"
                        className="flex h-9 w-9 items-center justify-center text-text-muted transition-colors hover:bg-fill-subtle hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        <Minus size={13} aria-hidden="true" />
                      </button>
                      <span className="flex h-9 w-12 items-center justify-center border-x border-border text-small font-semibold tabular-nums text-text-primary">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                        aria-label="Increase quantity"
                        className="flex h-9 w-9 items-center justify-center text-text-muted transition-colors hover:bg-fill-subtle hover:text-text-primary"
                      >
                        <Plus size={13} aria-hidden="true" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeItem(item.productId)}
                      className="text-small font-medium text-text-muted underline-offset-2 transition-colors hover:text-error hover:underline"
                    >
                      Remove
                    </button>

                    <div className="ml-auto text-right">
                      <p className="text-body-lg font-semibold tabular-nums text-text-primary">
                        {formatCurrency(Number(item.adminPrice) * item.quantity)}
                      </p>
                      <p className="text-caption text-text-muted">{formatCurrency(item.adminPrice)} / unit</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="rounded-card border border-border bg-bg-surface p-6 lg:sticky lg:top-24">
          <h2 className="font-serif text-h4 text-text-primary">Order Summary</h2>
          <div className="mt-4 flex flex-col gap-2.5">
            <div className="flex items-center justify-between text-small text-text-muted">
              <span>Subtotal</span>
              <span className="tabular-nums">{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between text-small text-text-muted">
              <span>Shipping</span>
              <span>Calculated at export</span>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
            <span className="text-body-lg font-medium text-text-primary">Total</span>
            <span className="font-serif text-h4 tabular-nums text-text-primary">{formatCurrency(subtotal)}</span>
          </div>
          <Button asChild size="lg" className="mt-6 w-full">
            <Link href="/checkout">Proceed to Checkout</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
