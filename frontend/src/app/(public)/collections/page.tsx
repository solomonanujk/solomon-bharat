'use client';

import Link from 'next/link';
import { CollectionCard } from '@/components/CollectionCard';
import { useCollections } from '@/modules/collections';

export default function CollectionsPage() {
  const { data, isLoading } = useCollections();

  return (
    <div>
      <div className="border-b border-border bg-bg-surface">
        <div className="mx-auto max-w-content px-margin-mobile py-section-mobile md:px-margin-desktop md:py-section-desktop">
          <p className="text-small text-text-muted">
            <Link href="/" className="hover:text-accent-primary">
              Home
            </Link>{' '}
            / Collections
          </p>
          <h1 className="mt-2 font-serif text-h1 text-text-primary">Collections</h1>
          <p className="mt-3 max-w-xl text-body text-text-muted">
            Curated edits of our catalog, hand-picked by the Solomon Bharat team.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-content px-margin-mobile py-section-mobile md:px-margin-desktop md:py-section-desktop">
        {isLoading && <p className="text-text-muted">Loading collections&hellip;</p>}

        <div className="grid grid-cols-1 gap-10 md:grid-cols-2">
          {data?.data.map((collection) => (
            <CollectionCard
              key={collection.id}
              slug={collection.slug}
              name={collection.name}
              heroImage={collection.heroImage}
              editorialIntro={collection.editorialIntro}
            />
          ))}
        </div>
      </div>
    </div>
  );
}