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
          <p className="text-small text-text-muted">
            <Link href="/" className="hover:text-accent-primary">
              Home
            </Link>{' '}
            / Categories
          </p>
          <h1 className="mt-2 font-serif text-h1 text-text-primary">Categories</h1>
          <p className="mt-3 max-w-xl text-body text-text-muted">
            Browse the full range of wholesale categories sourced from trusted Indian suppliers.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-content px-margin-mobile py-section-mobile md:px-margin-desktop md:py-section-desktop">
        {isLoading && <p className="text-text-muted">Loading categories&hellip;</p>}

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