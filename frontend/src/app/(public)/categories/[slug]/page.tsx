'use client';

import Image from 'next/image';
import Link from 'next/link';
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

  const hasChildren = category.children.length > 0;

  return (
    <div>
      <div className="border-b border-border bg-bg-surface">
        <div className="mx-auto max-w-content px-margin-mobile py-section-mobile md:px-margin-desktop md:py-section-desktop">
          <nav className="flex flex-wrap items-center gap-1.5 text-small text-text-muted">
            <Link href="/" className="transition-colors hover:text-accent-primary">
              Home
            </Link>
            <span aria-hidden="true">/</span>
            <Link href="/categories" className="transition-colors hover:text-accent-primary">
              Categories
            </Link>
            {category.breadcrumb.map((crumb) => (
              <span key={crumb.id} className="flex items-center gap-1.5">
                <span aria-hidden="true">/</span>
                <Link href={`/categories/${crumb.slug}`} className="transition-colors hover:text-accent-primary">
                  {crumb.name}
                </Link>
              </span>
            ))}
            <span aria-hidden="true">/</span>
            <span className="font-medium text-text-primary">{category.name}</span>
          </nav>
          <h1 className="mt-3 font-serif text-h1 leading-tight text-text-primary">{category.name}</h1>
          {category.description && (
            <p className="mt-3 max-w-xl text-body text-text-muted">{category.description}</p>
          )}
          {!hasChildren && (
            <p className="mt-2 text-small text-text-muted">
              {category.productCount} {category.productCount === 1 ? 'product' : 'products'}
            </p>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-content px-margin-mobile py-section-mobile md:px-margin-desktop md:py-section-desktop">
        {hasChildren ? (
          <div>
            <p className="text-caption font-bold uppercase tracking-[0.1em] text-text-muted">Browse {category.name}</p>
            <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
              {category.children.map((child) => (
                <Link
                  key={child.id}
                  href={`/categories/${child.slug}`}
                  className="group flex items-center gap-3 rounded-card border border-border bg-bg-surface p-3 transition-colors hover:border-accent-primary"
                >
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-input bg-fill-subtle">
                    {child.heroImage && (
                      <Image src={child.heroImage} alt={child.name} fill sizes="56px" className="object-cover" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-small font-semibold text-text-primary transition-colors group-hover:text-accent-primary">
                      {child.name}
                    </p>
                    <p className="text-caption text-text-muted">{child.productCount} products</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <div>
            {products && products.length > 0 ? (
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
                <p className="text-body text-text-muted">No products in {category.name} yet.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
