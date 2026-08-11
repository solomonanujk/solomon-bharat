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
          <nav className="flex items-center gap-1.5 text-small text-text-muted">
            <Link href="/" className="transition-colors hover:text-accent-primary">
              Home
            </Link>
            <span aria-hidden="true">/</span>
            <span className="font-medium text-text-primary">Collections</span>
          </nav>
          <h1 className="mt-3 font-serif text-h1 leading-tight text-text-primary">Collections</h1>
          <p className="mt-3 max-w-xl text-body text-text-muted">
            Curated edits of our catalog, hand-picked by the Solomon Bharat team.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-content px-margin-mobile py-section-mobile md:px-margin-desktop md:py-section-desktop">
        {isLoading && (
          <div className="grid grid-cols-1 gap-10 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="aspect-[16/10] rounded-lg bg-fill-subtle" />
                <div className="mt-4 h-6 w-1/2 rounded bg-fill-subtle" />
                <div className="mt-2 h-4 w-3/4 rounded bg-fill-subtle" />
              </div>
            ))}
          </div>
        )}

        {!isLoading && data?.data.length === 0 && (
          <p className="text-body text-text-muted">No collections are available yet.</p>
        )}

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
