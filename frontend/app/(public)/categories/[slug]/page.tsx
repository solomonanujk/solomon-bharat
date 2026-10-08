'use client'

import { Suspense, use } from 'react'
import Link from 'next/link'
import { isAxiosError } from 'axios'
import { NavBar } from '@/components/shared/NavBar'
import { Footer } from '@/components/shared/Footer'
import { Button } from '@/components/ui/button'
import { Breadcrumbs, type Crumb } from '@/components/catalogue/Breadcrumbs'
import { CatalogueView, CataloguePageSkeleton } from '@/components/catalogue/CatalogueView'
import { CategoryTileCarousel } from '@/components/catalogue/CategoryTileCarousel'
import { useCategory } from '@/hooks/queries/useCategories'

const LOADING_CRUMBS: Crumb[] = [{ label: 'Home', href: '/' }, { label: 'Category' }]

function CategoryDetail({ slug }: { slug: string }) {
  const { data: category, isPending, isError, error, refetch, isFetching } = useCategory(slug)

  if (isPending) return <CataloguePageSkeleton breadcrumbs={LOADING_CRUMBS} />

  if (isError || !category) {
    const notFound = isAxiosError(error) && error.response?.status === 404
    return (
      <div className="sb-container sb-section">
        <Breadcrumbs items={[{ label: 'Home', href: '/' }]} />
        <div role="alert" className="mt-6 max-w-[520px]">
          <h1 className="type-h1 text-ink">{notFound ? 'Category not found' : 'We couldn’t load this category'}</h1>
          <p className="mt-4 type-body text-muted">
            {notFound
              ? 'This category may have been removed, or the link is incorrect.'
              : 'Something went wrong while fetching it — usually a brief connection problem. Please try again.'}
          </p>
          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            {!notFound && (
              <Button variant="primary" size="lg" loading={isFetching} onClick={() => refetch()}>
                Retry
              </Button>
            )}
            <Button asChild variant={notFound ? 'primary' : 'secondary'} size="lg">
              <Link href="/">Back to home</Link>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // The API's breadcrumb runs root → this category (inclusive).
  const trail = category.breadcrumb ?? []
  const ancestors = trail.filter((c) => c.id !== category.id)
  const parent = ancestors[ancestors.length - 1]
  const breadcrumbs: Crumb[] = [
    { label: 'Home', href: '/' },
    ...ancestors.map((c) => ({ label: c.name, href: `/categories/${c.slug}` })),
    { label: category.name },
  ]

  return (
    <CatalogueView
      breadcrumbs={breadcrumbs}
      eyebrow={parent ? parent.name : 'Category'}
      title={category.name}
      intro={category.description}
      beforeToolbar={<CategoryTileCarousel categoryName={category.name} subcategories={category.children ?? []} />}
      scope={{ categoryId: category.id }}
      rootCategory={{ id: category.id, name: category.name, children: category.children ?? [] }}
      contextSearchPlaceholder={`Search in ${category.name}`}
      emptyBody={`There are no products in ${category.name} yet. Check back soon, or explore a related category.`}
    />
  )
}

export default function CategoryDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  return (
    <div className="min-h-screen bg-ivory flex flex-col">
      <NavBar />
      <main className="flex-1">
        {/* useSearchParams (URL filter state) needs a Suspense boundary. */}
        <Suspense fallback={<CataloguePageSkeleton breadcrumbs={LOADING_CRUMBS} />}>
          <CategoryDetail slug={slug} />
        </Suspense>
      </main>
      <Footer />
    </div>
  )
}
