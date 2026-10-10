'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { NavBar } from '@/components/shared/NavBar'
import { Footer } from '@/components/shared/Footer'
import { Breadcrumbs, type Crumb } from '@/components/catalogue/Breadcrumbs'
import { CatalogueView, CataloguePageSkeleton } from '@/components/catalogue/CatalogueView'

// Unscoped browse modes behind the navbar's curated quick links. These are the
// API's own `sort` modes (see components/catalogue/catalogueParams.ts):
// "featured" narrows to admin-featured products; "trending" is order-volume
// based and the API ignores every filter for it, so facets/sort are hidden there.
const SORT_MODES = {
  newest: {
    title: 'New products',
    intro: 'The most recently added products across every category.',
    empty: 'No products have been published yet. Check back soon.',
  },
  featured: {
    title: 'Bestsellers',
    intro: 'Products our team has picked out from across the catalogue.',
    empty: 'No products are featured yet. Check back soon.',
  },
  trending: {
    title: 'Trending',
    intro: 'Products ordered most often in the last 30 days.',
    empty: 'Nothing is trending yet — trending is based on real orders in the last 30 days.',
  },
} as const

const BASE_CRUMBS: Crumb[] = [{ label: 'Home', href: '/' }]

function SearchResults() {
  const searchParams = useSearchParams()
  const q = searchParams.get('q')?.trim() ?? ''
  const sortParam = searchParams.get('sort')
  const sortMode = sortParam === 'newest' || sortParam === 'featured' || sortParam === 'trending' ? sortParam : null

  if (!q && !sortMode) {
    return (
      <div className="sb-container sb-section">
        <Breadcrumbs items={[...BASE_CRUMBS, { label: 'Search' }]} />
        <div className="mt-4 max-w-[660px]">
          <p className="type-eyebrow text-brass-dark">Search</p>
          <h1 className="mt-2 type-h1 text-ink">Search Solomon Bharat</h1>
          <p className="mt-4 type-body text-muted">
            Use the search bar at the top of the page to find products by name, description, material or brand across
            every category.
          </p>
        </div>
      </div>
    )
  }

  // A text query always wins: with `q`, sort is just an ordering/narrowing choice.
  const trending = !q && sortMode === 'trending'
  const mode = SORT_MODES[sortMode ?? 'newest']

  return (
    <CatalogueView
      breadcrumbs={[...BASE_CRUMBS, { label: q ? 'Search' : mode.title }]}
      eyebrow={q ? 'Search results' : 'Browse'}
      title={q ? `Results for “${q}”` : mode.title}
      intro={q ? 'Matching product names, descriptions, materials and brand names across every category.' : mode.intro}
      facets={!trending}
      sortable={!trending}
      emptyBody={q ? `Nothing matched “${q}”. Try a different or shorter search term.` : mode.empty}
    />
  )
}

function SearchPageInner() {
  const searchParams = useSearchParams()
  return (
    <div className="min-h-screen bg-ivory flex flex-col">
      <NavBar initialSearchQuery={searchParams.get('q')?.trim() ?? ''} />
      <main className="flex-1">
        <SearchResults />
      </main>
      <Footer />
    </div>
  )
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-ivory flex flex-col">
          <NavBar />
          <main className="flex-1">
            <CataloguePageSkeleton breadcrumbs={[...BASE_CRUMBS, { label: 'Search' }]} />
          </main>
          <Footer />
        </div>
      }
    >
      <SearchPageInner />
    </Suspense>
  )
}
