'use client'

import { Suspense, use } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { isAxiosError } from 'axios'
import { NavBar } from '@/components/shared/NavBar'
import { Footer } from '@/components/shared/Footer'
import { Button } from '@/components/ui/button'
import { Breadcrumbs } from '@/components/catalogue/Breadcrumbs'
import { CatalogueView, CataloguePageSkeleton } from '@/components/catalogue/CatalogueView'
import { CollectionCard } from '@/components/catalogue/CollectionCard'
import { useCollection } from '@/hooks/queries/useCollections'
import { cloudinaryFill } from '@/lib/cloudinaryImage'

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-ivory flex flex-col">
      <NavBar />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  )
}

function HeaderSkeleton() {
  return (
    <CataloguePageSkeleton
      breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Collections', href: '/collections' }, { label: 'Collection' }]}
    />
  )
}

function CollectionDetail({ slug }: { slug: string }) {
  const { data: collection, isPending, isError, error, refetch, isFetching } = useCollection(slug)

  if (isPending) return <HeaderSkeleton />

  if (isError || !collection) {
    const notFound = isAxiosError(error) && error.response?.status === 404
    return (
      <div className="sb-container sb-section">
        <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Collections', href: '/collections' }]} />
        <div role="alert" className="mt-6 max-w-[520px]">
          <h1 className="type-h1 text-ink">{notFound ? 'Collection not found' : 'We couldn’t load this collection'}</h1>
          <p className="mt-4 type-body text-muted">
            {notFound
              ? 'This collection may have been removed, or the link is incorrect.'
              : 'Something went wrong while fetching it — usually a brief connection problem. Please try again.'}
          </p>
          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            {!notFound && (
              <Button variant="primary" size="lg" loading={isFetching} onClick={() => refetch()}>
                Retry
              </Button>
            )}
            <Button asChild variant={notFound ? 'primary' : 'secondary'} size="lg">
              <Link href="/collections">See all collections</Link>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const related = (collection.related ?? []).filter((c) => c.slug !== slug).slice(0, 3)

  return (
    <>
      <CatalogueView
        breadcrumbs={[
          { label: 'Home', href: '/' },
          { label: 'Collections', href: '/collections' },
          { label: collection.name },
        ]}
        eyebrow="Solomon Bharat collection"
        title={collection.name}
        intro={collection.editorialIntro}
        headerMedia={
          collection.heroImage ? (
            <div className="relative aspect-[16/10] overflow-hidden rounded-[6px] border border-line bg-white">
              <Image
                src={cloudinaryFill(collection.heroImage, 800, 500)}
                alt={`${collection.name} collection`}
                fill
                priority
                sizes="(max-width: 1023px) 320px, 400px"
                className="object-cover"
              />
            </div>
          ) : undefined
        }
        scope={{ collectionId: collection.id }}
        contextSearchPlaceholder={`Search in ${collection.name}`}
        emptyBody="This collection doesn’t have any products yet. Check back soon, or explore our other collections."
      />

      {related.length > 0 && (
        <section aria-labelledby="related-collections" className="bg-white border-t border-line sb-section">
          <div className="sb-container">
            <h2 id="related-collections" className="type-h2 text-ink">
              More collections
            </h2>
            <ul className="mt-6 lg:mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-5 lg:gap-6">
              {related.map((c) => (
                <li key={c.id} className="min-w-0">
                  <CollectionCard collection={c} headingLevel="h3" />
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </>
  )
}

export default function CollectionDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  return (
    <PageShell>
      {/* useSearchParams (URL filter state) needs a Suspense boundary. */}
      <Suspense fallback={<HeaderSkeleton />}>
        <CollectionDetail slug={slug} />
      </Suspense>
    </PageShell>
  )
}
