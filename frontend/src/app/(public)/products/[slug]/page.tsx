'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { ProductCard } from '@/components/ProductCard';
import { useProduct } from '@/modules/products';
import { useAddToWishlist } from '@/modules/buyers';
import { useCart } from '@/providers/CartProvider';
import { useAuth } from '@/providers/AuthProvider';
import { formatCurrency } from '@/utils/formatCurrency';

export interface ProductDetailPageProps {
  readonly params: { slug: string };
}

export default function ProductDetailPage({ params }: ProductDetailPageProps) {
  const { data, isLoading } = useProduct(params.slug);
  const { addItem } = useCart();
  const { user } = useAuth();
  const router = useRouter();
  const addToWishlistMutation = useAddToWishlist();
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [quantity, setQuantity] = useState<number | null>(null);
  const [added, setAdded] = useState(false);
  const [savedToWishlist, setSavedToWishlist] = useState(false);

  if (isLoading || !data) {
    return (
      <div className="mx-auto max-w-content px-margin-mobile py-section-mobile md:px-margin-desktop">
        <p className="text-text-muted">Loading&hellip;</p>
      </div>
    );
  }

  const { product, related } = data;
  const activeImage = product.images[activeImageIndex] ?? product.images[0];
  const specs = [
    { label: 'Materials', value: product.materials },
    { label: 'Dimensions', value: product.dimensions },
    { label: 'Weight', value: product.weight },
    { label: 'Lead Time', value: product.leadTime },
    { label: 'Certifications', value: product.certifications },
  ].filter((spec) => spec.value);

  return (
    <div className="mx-auto max-w-content px-margin-mobile py-section-mobile md:px-margin-desktop md:py-section-desktop">
      <p className="text-small text-text-muted">
        <Link href="/" className="hover:text-accent-primary">
          Home
        </Link>{' '}
        /{' '}
        <Link href="/categories" className="hover:text-accent-primary">
          Categories
        </Link>{' '}
        / {product.name}
      </p>

      <div className="mt-6 grid grid-cols-1 gap-10 md:grid-cols-2">
        <div>
          <div className="relative aspect-square overflow-hidden rounded-card border border-border bg-bg-surface">
            {activeImage ? (
              <Image src={activeImage.url} alt={product.name} fill className="object-cover" priority />
            ) : (
              <div className="h-full w-full bg-fill-subtle" />
            )}
          </div>
          {product.images.length > 1 && (
            <div className="mt-4 flex gap-3">
              {product.images.map((image, index) => (
                <button
                  key={image.id}
                  type="button"
                  onClick={() => setActiveImageIndex(index)}
                  className={`relative h-20 w-20 overflow-hidden rounded-card border-2 transition-colors ${
                    index === activeImageIndex ? 'border-accent-primary' : 'border-border hover:border-text-muted'
                  }`}
                >
                  <Image src={image.url} alt="" fill className="object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <h1 className="font-serif text-h1 text-text-primary">{product.name}</h1>
          <p className="mt-3 text-h3 text-accent-primary">{formatCurrency(product.adminPrice)}</p>
          <p className="mt-1 text-small text-text-muted">Minimum Order Quantity: {product.moq}</p>

          <div className="mt-6 flex items-center gap-3">
            <label htmlFor="quantity" className="text-small font-medium text-text-primary">
              Quantity
            </label>
            <input
              id="quantity"
              type="number"
              min={product.moq}
              step={1}
              placeholder={String(product.moq)}
              onChange={(event) => setQuantity(Number(event.target.value))}
              className="h-10 w-24 rounded-input border border-border bg-bg-surface px-3 text-sm text-text-primary outline-none transition-colors focus:border-accent-primary focus:ring-1 focus:ring-accent-primary"
            />
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button
              type="button"
              disabled={quantity !== null && quantity < product.moq}
              onClick={() => {
                addItem(
                  {
                    productId: product.id,
                    name: product.name,
                    slug: product.slug,
                    imageUrl: product.images[0]?.url ?? null,
                    adminPrice: product.adminPrice,
                    moq: product.moq,
                  },
                  quantity ?? product.moq,
                );
                setAdded(true);
              }}
            >
              Add to Order
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={addToWishlistMutation.isPending}
              onClick={() => {
                if (!user) {
                  router.push('/login');
                  return;
                }
                addToWishlistMutation.mutate(product.id, { onSuccess: () => setSavedToWishlist(true) });
              }}
            >
              {savedToWishlist ? 'Saved' : 'Save to Wishlist'}
            </Button>
          </div>
          {added && <p className="mt-2 text-small text-success">Added to your order.</p>}
          {savedToWishlist && <p className="mt-2 text-small text-success">Saved to your wishlist.</p>}

          <p className="mt-8 text-body leading-relaxed text-text-muted">{product.description}</p>

          {specs.length > 0 && (
            <table className="mt-8 w-full text-small">
              <tbody>
                {specs.map((spec) => (
                  <tr key={spec.label} className="border-t border-border">
                    <td className="py-3 pr-4 font-medium text-text-primary">{spec.label}</td>
                    <td className="py-3 text-text-muted">{spec.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {related.length > 0 && (
        <div className="mt-16 border-t border-border pt-12">
          <h2 className="font-serif text-h2 text-text-primary">You may also like</h2>
          <div className="mt-8 grid grid-cols-2 gap-6 md:grid-cols-4">
            {related.map((item) => (
              <ProductCard
                key={item.id}
                slug={item.slug}
                name={item.name}
                adminPrice={item.adminPrice}
                moq={item.moq}
                imageUrl={item.images[0]?.url ?? null}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}