'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Minus, Plus, ChevronLeft, ChevronRight, Images } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Dialog, DialogContent } from '@/components/ui/Dialog';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/Accordion';
import { ProductCard } from '@/components/ProductCard';
import { useProduct } from '@/modules/products';
import type { ProductImage } from '@/modules/products';
import { useAddToWishlist } from '@/modules/buyers';
import { useCart } from '@/providers/CartProvider';
import { useAuth } from '@/providers/AuthProvider';
import { formatCurrency } from '@/utils/formatCurrency';

export interface ProductDetailPageProps {
  readonly params: { slug: string };
}

function EmptyGalleryPlaceholder() {
  return (
    <div className="flex aspect-square w-full items-center justify-center rounded-card bg-fill-subtle">
      <Images size={40} className="text-border" aria-hidden="true" />
    </div>
  );
}

function Lightbox({
  images,
  productName,
  index,
  onIndexChange,
  onClose,
}: {
  readonly images: ProductImage[];
  readonly productName: string;
  readonly index: number;
  readonly onIndexChange: (index: number) => void;
  readonly onClose: () => void;
}) {
  const image = images[index];

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl bg-text-primary p-0">
        <div className="relative flex aspect-square items-center justify-center sm:aspect-[4/3]">
          {images.length > 1 && (
            <button
              type="button"
              onClick={() => onIndexChange(index === 0 ? images.length - 1 : index - 1)}
              aria-label="Previous image"
              className="absolute left-3 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 text-white transition-colors hover:bg-white/10"
            >
              <ChevronLeft size={18} aria-hidden="true" />
            </button>
          )}
          {image && (
            <Image
              src={image.url}
              alt={`${productName} — image ${index + 1}`}
              fill
              className="object-contain"
              sizes="768px"
            />
          )}
          {images.length > 1 && (
            <button
              type="button"
              onClick={() => onIndexChange(index === images.length - 1 ? 0 : index + 1)}
              aria-label="Next image"
              className="absolute right-3 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 text-white transition-colors hover:bg-white/10"
            >
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          )}
        </div>
        {images.length > 1 && (
          <p className="pb-4 text-center text-caption text-white/60">
            {index + 1} / {images.length}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

function PhotoGallery({ images, productName }: { readonly images: ProductImage[]; readonly productName: string }) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  if (images.length === 0) return <EmptyGalleryPlaceholder />;

  if (images.length === 1) {
    const first = images[0] as ProductImage;
    return (
      <>
        <button
          type="button"
          onClick={() => setLightboxIndex(0)}
          className="relative aspect-square w-full cursor-zoom-in overflow-hidden rounded-card border border-border bg-bg-surface"
        >
          <Image src={first.url} alt={productName} fill className="object-cover" priority sizes="(max-width: 768px) 100vw, 50vw" />
        </button>
        {lightboxIndex !== null && (
          <Lightbox images={images} productName={productName} index={lightboxIndex} onIndexChange={setLightboxIndex} onClose={() => setLightboxIndex(null)} />
        )}
      </>
    );
  }

  if (images.length < 4) {
    const [first, second, third] = images as [ProductImage, ProductImage, ProductImage?];
    return (
      <>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setLightboxIndex(0)}
            className="relative aspect-square flex-[2] cursor-zoom-in overflow-hidden rounded-card border border-border bg-bg-surface"
          >
            <Image src={first.url} alt={`${productName} — 1`} fill className="object-cover" priority sizes="40vw" />
          </button>
          <button
            type="button"
            onClick={() => setLightboxIndex(1)}
            className="relative aspect-square flex-[3] cursor-zoom-in overflow-hidden rounded-card border border-border bg-bg-surface"
          >
            <Image src={second.url} alt={`${productName} — 2`} fill className="object-cover" priority sizes="60vw" />
          </button>
        </div>
        {third && (
          <button
            type="button"
            onClick={() => setLightboxIndex(2)}
            className="relative mt-2 h-40 w-full cursor-zoom-in overflow-hidden rounded-card border border-border bg-bg-surface"
          >
            <Image src={third.url} alt={`${productName} — 3`} fill className="object-cover" sizes="100vw" />
          </button>
        )}
        {lightboxIndex !== null && (
          <Lightbox images={images} productName={productName} index={lightboxIndex} onIndexChange={setLightboxIndex} onClose={() => setLightboxIndex(null)} />
        )}
      </>
    );
  }

  const remaining = images.length - 4;
  const [first, second, third, fourth] = images as [ProductImage, ProductImage, ProductImage, ProductImage];

  return (
    <>
      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setLightboxIndex(0)}
            className="relative aspect-square flex-[2] cursor-zoom-in overflow-hidden rounded-card border border-border bg-bg-surface"
          >
            <Image src={first.url} alt={`${productName} — 1`} fill className="object-cover" priority sizes="40vw" />
          </button>
          <button
            type="button"
            onClick={() => setLightboxIndex(1)}
            className="relative aspect-square flex-[3] cursor-zoom-in overflow-hidden rounded-card border border-border bg-bg-surface"
          >
            <Image src={second.url} alt={`${productName} — 2`} fill className="object-cover" priority sizes="60vw" />
          </button>
        </div>
        <div className="flex h-28 gap-2 sm:h-36">
          <button
            type="button"
            onClick={() => setLightboxIndex(2)}
            className="relative flex-1 cursor-zoom-in overflow-hidden rounded-card border border-border bg-bg-surface"
          >
            <Image src={third.url} alt={`${productName} — 3`} fill className="object-cover" sizes="30vw" />
          </button>
          <button
            type="button"
            onClick={() => setLightboxIndex(3)}
            className="relative flex-1 cursor-zoom-in overflow-hidden rounded-card border border-border bg-bg-surface"
          >
            <Image src={fourth.url} alt={`${productName} — 4`} fill className="object-cover" sizes="30vw" />
            {remaining > 0 && (
              <div className="absolute inset-0 flex items-center justify-center bg-text-primary/45">
                <span className="inline-flex items-center gap-2 rounded-button bg-white px-4 py-2 text-small font-semibold text-text-primary shadow-sm">
                  <Images size={14} aria-hidden="true" />
                  Show all {images.length}
                </span>
              </div>
            )}
          </button>
        </div>
      </div>
      {lightboxIndex !== null && (
        <Lightbox images={images} productName={productName} index={lightboxIndex} onIndexChange={setLightboxIndex} onClose={() => setLightboxIndex(null)} />
      )}
    </>
  );
}

export default function ProductDetailPage({ params }: ProductDetailPageProps) {
  const { data, isLoading } = useProduct(params.slug);
  const { addItem } = useCart();
  const { user } = useAuth();
  const router = useRouter();
  const addToWishlistMutation = useAddToWishlist();
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
  const effectiveQuantity = quantity ?? product.moq;
  const specs = [
    { label: 'Materials', value: product.materials },
    { label: 'Dimensions', value: product.dimensions },
    { label: 'Weight', value: product.weight },
    { label: 'Lead Time', value: product.leadTime },
    { label: 'Certifications', value: product.certifications },
  ].filter((spec) => spec.value);

  return (
    <div className="mx-auto max-w-content px-margin-mobile py-section-mobile md:px-margin-desktop md:py-section-desktop">
      <nav className="flex items-center gap-1.5 text-small text-text-muted">
        <Link href="/" className="transition-colors hover:text-accent-primary">
          Home
        </Link>
        <span aria-hidden="true">/</span>
        <Link href="/categories" className="transition-colors hover:text-accent-primary">
          Categories
        </Link>
        <span aria-hidden="true">/</span>
        <span className="font-medium text-text-primary">{product.name}</span>
      </nav>

      <div className="mt-6 grid grid-cols-1 gap-10 md:grid-cols-2">
        <div>
          <PhotoGallery images={product.images} productName={product.name} />
        </div>

        <div className="flex flex-col">
          <h1 className="font-serif text-h1 leading-tight text-text-primary">{product.name}</h1>

          <div className="mt-4">
            <p className="text-caption font-semibold uppercase tracking-[0.08em] text-text-muted">Wholesale Price</p>
            <p className="mt-1 font-serif text-h2 text-text-primary">{formatCurrency(product.adminPrice)}</p>
            <p className="mt-1 text-small text-text-muted">
              Minimum order: <span className="font-medium text-text-primary">{product.moq} units</span>
            </p>
          </div>

          <div className="mt-6">
            <p className="mb-2 text-small font-medium text-text-primary">
              Quantity <span className="text-text-muted">(min. {product.moq})</span>
            </p>
            <div className="inline-flex items-center rounded-input border border-border">
              <button
                type="button"
                onClick={() => setQuantity(Math.max(product.moq, effectiveQuantity - 1))}
                disabled={effectiveQuantity <= product.moq}
                aria-label="Decrease quantity"
                className="flex h-10 w-10 items-center justify-center text-text-primary transition-colors hover:bg-fill-subtle disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Minus size={14} aria-hidden="true" />
              </button>
              <span className="flex h-10 w-14 items-center justify-center border-x border-border text-small font-semibold text-text-primary">
                {effectiveQuantity}
              </span>
              <button
                type="button"
                onClick={() => setQuantity(effectiveQuantity + 1)}
                aria-label="Increase quantity"
                className="flex h-10 w-10 items-center justify-center text-text-primary transition-colors hover:bg-fill-subtle"
              >
                <Plus size={14} aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button
              type="button"
              size="lg"
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
                  effectiveQuantity,
                );
                setAdded(true);
              }}
            >
              Add to Order
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="lg"
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

          <div className="mt-8 border-t border-border pt-6">
            <p className="mb-3 text-caption font-semibold uppercase tracking-[0.08em] text-text-muted">
              About this product
            </p>
            <p className="whitespace-pre-wrap text-body leading-relaxed text-text-muted">{product.description}</p>
          </div>

          {specs.length > 0 && (
            <div className="mt-2">
              <Accordion type="single" defaultValue="details">
                <AccordionItem value="details">
                  <AccordionTrigger>Product Details</AccordionTrigger>
                  <AccordionContent>
                    <dl className="flex flex-col gap-3">
                      {specs.map((spec) => (
                        <div key={spec.label} className="flex items-baseline justify-between gap-4">
                          <dt className="shrink-0 text-caption font-semibold uppercase tracking-[0.05em] text-text-primary">
                            {spec.label}
                          </dt>
                          <dd className="text-right text-small text-text-muted">{spec.value}</dd>
                        </div>
                      ))}
                    </dl>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
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
