'use client';

import Link from 'next/link';
import { CategoryCard } from '@/components/CategoryCard';
import { useCategories } from '@/modules/categories';

export default function CategoriesPage() {
  const { data: categories, isLoading } = useCategories();

  return (
    <div>
      <div className="border-b border-border bg-bg-surface">
        <div className="mx-auto max-w-content px-margin-mobile py-section-mobile md:px-margin-desktop md:py-section-desktop">
          <nav className="flex items-center gap-1.5 text-small text-text-muted">
            <Link href="/" className="transition-colors hover:text-accent-primary">
              Home
            </Link>
            <span aria-hidden="true">/</span>
            <span className="font-medium text-text-primary">Categories</span>
          </nav>
          <h1 className="mt-3 font-serif text-h1 leading-tight text-text-primary">Categories</h1>
          <p className="mt-3 max-w-xl text-body text-text-muted">
            Browse the full range of wholesale categories sourced from trusted Indian suppliers.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-content px-margin-mobile py-section-mobile md:px-margin-desktop md:py-section-desktop">
        {isLoading && (
          <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="animate-pulse overflow-hidden rounded-card border border-border bg-bg-surface">
                <div className="aspect-[4/3] bg-fill-subtle" />
                <div className="space-y-2 p-4">
                  <div className="h-4 w-3/4 rounded bg-fill-subtle" />
                  <div className="h-3 w-1/3 rounded bg-fill-subtle" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!isLoading && categories && categories.length === 0 && (
          <p className="text-body text-text-muted">No categories are available yet.</p>
        )}

        <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
          {categories?.map((category) => (
            <CategoryCard
              key={category.id}
              slug={category.slug}
              name={category.name}
              heroImage={category.heroImage}
              productCount={category.productCount}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
