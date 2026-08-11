'use client';

import Link from 'next/link';
import { Heart, X } from 'lucide-react';
import { ProductCard } from '@/components/ProductCard';
import { useWishlist, useRemoveFromWishlist } from '@/modules/buyers';

export default function WishlistPage() {
  const { data: wishlist, isLoading } = useWishlist();
  const removeMutation = useRemoveFromWishlist();

  const count = wishlist?.length ?? 0;

  return (
    <div>
      <h1 className="font-serif text-h2 text-text-primary">Your Wishlist</h1>
      <p className="mt-1 text-body text-text-muted">
        {isLoading ? 'Loading…' : `${count} product${count === 1 ? '' : 's'} saved for later`}
      </p>

      {isLoading && (
        <div className="mt-6 grid grid-cols-2 gap-6 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            // eslint-disable-next-line react/no-array-index-key
            <div key={index} className="animate-pulse">
              <div className="aspect-square rounded-card bg-fill-subtle" />
              <div className="mt-3 h-4 w-3/4 rounded bg-fill-subtle" />
              <div className="mt-2 h-3 w-1/2 rounded bg-fill-subtle" />
            </div>
          ))}
        </div>
      )}

      {!isLoading && count === 0 && (
        <div className="mt-8 flex flex-col items-center rounded-card border border-border bg-bg-surface p-12 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-bg-primary">
            <Heart size={20} className="text-text-muted" aria-hidden="true" />
          </span>
          <p className="mt-4 font-serif text-h4 text-text-primary">No saved products yet</p>
          <p className="mt-1 max-w-sm text-small text-text-muted">
            While browsing, tap the wishlist icon on any product to build your shortlist here.
          </p>
          <Link
            href="/categories"
            className="mt-4 text-small font-semibold text-accent-primary hover:text-accent-primary-hover hover:underline"
          >
            Browse Categories
          </Link>
        </div>
      )}

      {!isLoading && count > 0 && (
        <div className="mt-6 grid grid-cols-2 gap-6 md:grid-cols-4">
          {wishlist!.map((entry) => (
            <div key={entry.id} className="group relative">
              <button
                type="button"
                aria-label="Remove from wishlist"
                onClick={() => removeMutation.mutate(entry.product.id)}
                disabled={removeMutation.isPending}
                className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-bg-surface text-text-muted shadow-sm transition-colors hover:border-error hover:text-error disabled:opacity-50"
              >
                <X size={14} aria-hidden="true" />
              </button>
              <ProductCard
                slug={entry.product.slug}
                name={entry.product.name}
                adminPrice={entry.product.adminPrice}
                moq={entry.product.moq}
                imageUrl={entry.product.imageUrl}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
