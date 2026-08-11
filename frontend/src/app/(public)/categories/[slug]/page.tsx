'use client';

import Link from 'next/link';
import { CategoryCard } from '@/components/CategoryCard';
import { ProductCard } from '@/components/ProductCard';
import { useCategory } from '@/modules/categories';
import { useProducts } from '@/modules/products';

export interface CategoryDetailPageProps {
  readonly params: { slug: string };
}

export default function CategoryDetailPage({ params }: CategoryDetailPageProps) {
  const { data: category, isLoading } = useCategory(params.slug);
  const { data: products } = useProducts({ categoryId: category?.id });

  if (isLoading || !category) {
    return (
      <div className="mx-auto max-w-content px-margin-mobile py-section-mobile md:px-margin-desktop">
        <p className="text-text-muted">Loading&hellip;</p>
      </div>
    );
  }

  return (
    <div>
      <div className="border-b border-border bg-bg-surface">
        <div className="mx-auto max-w-content px-margin-mobile py-section-mobile md:px-margin-desktop md:py-section-desktop">
          <p className="text-small text-text-muted">
            <Link href="/" className="hover:text-accent-primary">
              Home
            </Link>{' '}
            /{' '}
            <Link href="/categories" className="hover:text-accent-primary">
              Categories
            </Link>
            {category.breadcrumb.map((crumb) => (
              <span key={crumb.id}> / {crumb.name}</span>
            ))}
          </p>
          <h1 className="mt-2 font-serif text-h1 text-text-primary">{category.name}</h1>
          {category.description && <p className="mt-3 max-w-xl text-body text-text-muted">{category.description}</p>}
        </div>
      </div>

      <div className="mx-auto max-w-content px-margin-mobile py-section-mobile md:px-margin-desktop md:py-section-desktop">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-[240px_1fr]">
          {category.children.length > 0 && (
            <aside>
              <p className="font-serif text-h4 text-text-primary">Browse</p>
              <nav className="mt-4 flex flex-col gap-2">
                {category.children.map((child) => (
                  <Link
                    key={child.id}
                    href={`/categories/${child.slug}`}
                    className="text-small text-text-muted transition-colors hover:text-accent-primary"
                  >
                    {child.name} ({child.productCount})
                  </Link>
                ))}
              </nav>
            </aside>
          )}

          <div>
            {category.children.length > 0 ? (
              <div className="grid grid-cols-2 gap-6 md:grid-cols-3">
                {category.children.map((child) => (
                  <CategoryCard
                    key={child.id}
                    slug={child.slug}
                    name={child.name}
                    heroImage={child.heroImage}
                    productCount={child.productCount}
                  />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-6 md:grid-cols-3">
                {products?.map((product) => (
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
            )}
          </div>
        </div>
      </div>
    </div>
  );
}