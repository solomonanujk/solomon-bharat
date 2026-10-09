'use client'

import { Suspense, use } from 'react'
import Link from 'next/link'
import { isAxiosError } from 'axios'
import { NavBar } from '@/components/shared/NavBar'
import { Footer } from '@/components/shared/Footer'
import { Button } from '@/components/ui/button'
import { Breadcrumbs } from '@/components/catalogue/Breadcrumbs'
import { CatalogueView, CataloguePageSkeleton } from '@/components/catalogue/CatalogueView'
import { BrandProfile } from '@/components/brands/BrandProfile'
import { useBrand } from '@/hooks/queries/useBrands'

const CRUMBS = [{ label: 'Home', href: '/' }, { label: 'Brands', href: '/brands' }]

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-ivory flex flex-col">
      <NavBar />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  )
}

function BrandDetail({ slug }: { slug: string }) {
  const { data: brand, isPending, isError, error, refetch, isFetching } = useBrand(slug)

  if (isPending) return <CataloguePageSkeleton breadcrumbs={[...CRUMBS, { label: 'Brand' }]} />

  if (isError || !brand) {
    // Unknown and suspended brands both come back as 404.
    const notFound = isAxiosError(error) && error.response?.status === 404
    return (
      <div className="sb-container sb-section">
        <Breadcrumbs items={CRUMBS} />
        <div role="alert" className="mt-6 max-w-[520px]">
          <h1 className="type-h1 text-ink">{notFound ? 'Brand not found' : 'We couldn’t load this brand'}</h1>
          <p className="mt-4 type-body text-muted">
            {notFound
              ? 'This brand may no longer be available, or the link is incorrect.'
              : 'Something went wrong while fetching it — usually a brief connection problem. Please try again.'}
          </p>
          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            {!notFound && (
              <Button variant="primary" size="lg" loading={isFetching} onClick={() => refetch()}>
                Retry
              </Button>
            )}
            <Button asChild variant={notFound ? 'primary' : 'secondary'} size="lg">
              <Link href="/brands">See all brands</Link>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <CatalogueView
      breadcrumbs={[...CRUMBS, { label: brand.name }]}
      eyebrow="Brand"
      title={brand.name}
      beforeToolbar={<BrandProfile brand={brand} />}
      scope={{ brandSlug: brand.slug }}
      contextSearchPlaceholder={`Search in ${brand.name}`}
      emptyBody={`${brand.name} hasn’t published any products yet. Check back soon.`}
    />
  )
}

export default function BrandDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  return (
    <PageShell>
      {/* useSearchParams (URL filter state) needs a Suspense boundary. */}
      <Suspense fallback={<CataloguePageSkeleton breadcrumbs={[...CRUMBS, { label: 'Brand' }]} />}>
        <BrandDetail slug={slug} />
      </Suspense>
    </PageShell>
  )
}
