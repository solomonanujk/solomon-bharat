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

  return (
    <div>
      <div className="relative flex min-h-[320px] items-end overflow-hidden bg-bg-surface md:min-h-[420px]">
        {collection.heroImage && (
          <>
            <Image src={collection.heroImage} alt={collection.name} fill className="object-cover" priority />
            <div
              className="pointer-events-none absolute inset-0"
              style={{ background: 'linear-gradient(to top, rgba(42,35,24,0.65) 0%, rgba(42,35,24,0.1) 55%, transparent 100%)' }}
              aria-hidden="true"
            />
          </>
        )}
        <div className="relative z-10 mx-auto w-full max-w-content px-margin-mobile pb-10 md:px-margin-desktop">
          <p className={collection.heroImage ? 'text-small text-white/80' : 'text-small text-text-muted'}>
            <Link href="/" className={collection.heroImage ? 'hover:text-white' : 'hover:text-accent-primary'}>
              Home
            </Link>{' '}
            /{' '}
            <Link href="/collections" className={collection.heroImage ? 'hover:text-white' : 'hover:text-accent-primary'}>
              Collections
            </Link>{' '}
            / {collection.name}
          </p>
          <h1 className={collection.heroImage ? 'mt-2 font-serif text-h1 text-white' : 'mt-2 font-serif text-h1 text-text-primary'}>
            {collection.name}
          </h1>
          {collection.editorialIntro && (
            <p className={collection.heroImage ? 'mt-3 max-w-xl text-body-lg text-white/85' : 'mt-3 max-w-xl text-body-lg text-text-muted'}>
              {collection.editorialIntro}
            </p>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-content px-margin-mobile py-section-mobile md:px-margin-desktop md:py-section-desktop">
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
      </div>
    </div>
  );
}