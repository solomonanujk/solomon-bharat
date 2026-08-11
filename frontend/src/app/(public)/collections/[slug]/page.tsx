'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ProductCard } from '@/components/ProductCard';
import { useCollection } from '@/modules/collections';

export interface CollectionDetailPageProps {
  readonly params: { slug: string };
}

export default function CollectionDetailPage({ params }: CollectionDetailPageProps) {
  const { data, isLoading } = useCollection(params.slug);

  if (isLoading || !data) {
    return (
      <div className="mx-auto max-w-content px-margin-mobile py-section-mobile md:px-margin-desktop">
        <p className="text-text-muted">Loading&hellip;</p>
      </div>
    );
  }

  const { collection, products } = data;
  const hasHero = Boolean(collection.heroImage);

  return (
    <div>
      <div className="relative flex min-h-[280px] items-end overflow-hidden bg-bg-surface md:min-h-[400px]">
        {hasHero && (
          <>
            <Image src={collection.heroImage as string} alt={collection.name} fill className="object-cover" priority />
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background: 'linear-gradient(to top, rgba(42,35,24,0.7) 0%, rgba(42,35,24,0.15) 55%, transparent 100%)',
              }}
              aria-hidden="true"
            />
          </>
        )}
        <div className="relative z-10 mx-auto w-full max-w-content px-margin-mobile pb-10 md:px-margin-desktop">
          <nav className={hasHero ? 'flex items-center gap-1.5 text-small text-white/80' : 'flex items-center gap-1.5 text-small text-text-muted'}>
            <Link href="/" className={hasHero ? 'transition-colors hover:text-white' : 'transition-colors hover:text-accent-primary'}>
              Home
            </Link>
            <span aria-hidden="true">/</span>
            <Link
              href="/collections"
              className={hasHero ? 'transition-colors hover:text-white' : 'transition-colors hover:text-accent-primary'}
            >
              Collections
            </Link>
            <span aria-hidden="true">/</span>
            <span className={hasHero ? 'font-medium text-white' : 'font-medium text-text-primary'}>{collection.name}</span>
          </nav>
          <h1 className={hasHero ? 'mt-3 font-serif text-h1 leading-tight text-white' : 'mt-3 font-serif text-h1 leading-tight text-text-primary'}>
            {collection.name}
          </h1>
          {collection.editorialIntro && (
            <p className={hasHero ? 'mt-3 max-w-xl text-body-lg text-white/85' : 'mt-3 max-w-xl text-body-lg text-text-muted'}>
              {collection.editorialIntro}
            </p>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-content px-margin-mobile py-section-mobile md:px-margin-desktop md:py-section-desktop">
        {products.length > 0 ? (
          <div className="grid grid-cols-2 gap-6 md:grid-cols-3">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                slug={product.slug}
                name={product.name}
                adminPrice={product.adminPrice}
                moq={product.moq}
                imageUrl={product.images[0]?.url ?? null}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-card border border-border bg-bg-surface p-10 text-center">
            <p className="text-body text-text-muted">No products in this collection yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
