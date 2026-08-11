'use client';

import Image from 'next/image';
import Link from 'next/link';
import { X } from 'lucide-react';
import { useWishlist, useRemoveFromWishlist } from '@/modules/buyers';
import { formatCurrency } from '@/utils/formatCurrency';

export default function WishlistPage() {
  const { data: wishlist, isLoading } = useWishlist();
  const removeMutation = useRemoveFromWishlist();

  return (
    <div>
      <h1 className="font-serif text-h2 text-text-primary">Your Wishlist</h1>
      <p className="mt-1 text-body text-text-muted">Products you&apos;ve saved for later.</p>

      {isLoading && <p className="mt-6 text-body text-text-muted">Loading&hellip;</p>}

      {!isLoading && wishlist && wishlist.length === 0 && (
        <div className="mt-8 rounded-card border border-border bg-bg-surface p-12 text-center">
          <p className="text-body text-text-muted">Your wishlist is empty.</p>
          <Link
            href="/categories"
            className="mt-3 inline-block text-small font-semibold text-accent-primary hover:text-accent-primary-hover hover:underline"
          >
            Browse Categories
          </Link>
        </div>
      )}

      {wishlist && wishlist.length > 0 && (
        <div className="mt-6 grid grid-cols-2 gap-6 md:grid-cols-4">
          {wishlist.map((entry) => (
            <div key={entry.id} className="group relative">
              <button
                type="button"
                aria-label="Remove from wishlist"
                onClick={() => removeMutation.mutate(entry.product.id)}
                className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-bg-surface text-text-muted shadow-sm transition-colors hover:border-error hover:text-error"
              >
                <X size={14} aria-hidden="true" />
              </button>
              <Link href={`/products/${entry.product.slug}`}>
                <div className="relative aspect-square overflow-hidden rounded-card bg-bg-surface">
                  {entry.product.imageUrl ? (
                    <Image
                      src={entry.product.imageUrl}
                      alt={entry.product.name}
                      fill
                      sizes="(min-width: 768px) 25vw, 50vw"
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="h-full w-full bg-fill-subtle" />
                  )}
                </div>
                <p className="mt-3 font-serif text-body-lg text-text-primary">{entry.product.name}</p>
                <p className="text-small text-text-muted">
                  {formatCurrency(entry.product.adminPrice)} &middot; MOQ {entry.product.moq}
                </p>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
