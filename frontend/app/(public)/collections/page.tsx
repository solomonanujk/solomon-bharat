'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { NavBar } from '@/components/shared/NavBar'
import { Footer } from '@/components/shared/Footer'
import { Button } from '@/components/ui/button'
import { Breadcrumbs } from '@/components/catalogue/Breadcrumbs'
import { Pagination } from '@/components/catalogue/Pagination'
import { CollectionCard, CollectionCardSkeleton } from '@/components/catalogue/CollectionCard'
import { useCollections } from '@/hooks/queries/useCollections'

const PAGE_SIZE = 24
const GRID = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-5 lg:gap-6'

function CollectionListing() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const pageParam = Number(searchParams.get('page'))
  const page = Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1

  const { data, isPending, isError, refetch, isFetching } = useCollections({ page, limit: PAGE_SIZE })
  const collections = data?.items ?? []

  function goToPage(next: number) {
    const params = new URLSearchParams(searchParams.toString())
    if (next > 1) params.set('page', String(next))
    else params.delete('page')
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    window.scrollTo({ top: 0 })
  }

  let body: React.ReactNode
  if (isPending) {
    body = (
      <div className={GRID} role="status" aria-label="Loading collections">
        {Array.from({ length: 6 }).map((_, i) => (
          <CollectionCardSkeleton key={i} />
        ))}
      </div>
    )
  } else if (isError && !data) {
    body = (
      <div role="alert" className="py-12 max-w-[520px]">
        <h2 className="type-h3 text-ink">We couldn&apos;t load collections</h2>
        <p className="mt-2 type-body text-muted">
          Something went wrong while fetching collections — usually a brief connection problem. Please try again.
        </p>
        <Button variant="primary" size="lg" className="mt-6" loading={isFetching} onClick={() => refetch()}>
          Retry
        </Button>
      </div>
    )
  } else if (collections.length === 0) {
    body = (
      <div className="py-12 max-w-[520px]">
        <h2 className="type-h3 text-ink">No collections yet</h2>
        <p className="mt-2 type-body text-muted">
          Our team hasn&apos;t published any collections yet. In the meantime, you can search the full catalogue or
          browse by category from the menu.
        </p>
        <Button asChild variant="primary" size="lg" className="mt-6">
          <Link href="/search?sort=newest">Browse new products</Link>
        </Button>
      </div>
    )
  } else {
    body = (
      <>
        <ul className={GRID}>
          {collections.map((collection) => (
            <li key={collection.id} className="min-w-0">
              <CollectionCard collection={collection} />
            </li>
          ))}
        </ul>
        <Pagination page={page} totalPages={data?.totalPages ?? 1} onPageChange={goToPage} />
      </>
    )
  }

  return (
    <div className="sb-container pt-4 lg:pt-6 pb-12 lg:pb-[72px]">
      <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Collections' }]} />
      <header className="mt-4">
        <p className="type-eyebrow text-brass-dark">Curated by Solomon Bharat</p>
        <h1 className="mt-2 type-h1 text-ink">Collections</h1>
        <p className="mt-4 max-w-[660px] type-body text-muted">
          Editorial groupings of products from our catalogue, put together around themes, seasons and uses.
        </p>
      </header>
      <div className="mt-8">{body}</div>
    </div>
  )
}

export default function CollectionListingPage() {
  return (
    <div className="min-h-screen bg-ivory flex flex-col">
      <NavBar />
      <main className="flex-1">
        <Suspense>
          <CollectionListing />
        </Suspense>
      </main>
      <Footer />
    </div>
  )
}
