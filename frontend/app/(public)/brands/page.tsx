'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { notFound, usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Search } from 'lucide-react'
import { NavBar } from '@/components/shared/NavBar'
import { Footer } from '@/components/shared/Footer'
import { Button } from '@/components/ui/button'
import { Breadcrumbs } from '@/components/catalogue/Breadcrumbs'
import { Pagination } from '@/components/catalogue/Pagination'
import { BrandLogo, VerifiedBadge } from '@/components/brands/BrandTag'
import { useBrands } from '@/hooks/queries/useBrands'
import { useAuth } from '@/hooks/useAuth'

const PAGE_SIZE = 24

function BrandsList() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const q = searchParams.get('q')?.trim() ?? ''
  const pageParam = Number(searchParams.get('page'))
  const page = Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1

  const [draft, setDraft] = useState(q)
  const [lastQ, setLastQ] = useState(q)
  if (q !== lastQ) {
    setLastQ(q)
    setDraft(q)
  }

  function go(nextQ: string, nextPage: number) {
    const params = new URLSearchParams()
    if (nextQ) params.set('q', nextQ)
    if (nextPage > 1) params.set('page', String(nextPage))
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  useEffect(() => {
    const next = draft.trim()
    if (next === q) return
    const t = setTimeout(() => go(next, 1), 350)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, q])

  const { data, isPending, isError, refetch, isFetching } = useBrands({ search: q || undefined, page, limit: PAGE_SIZE })
  const brands = data?.items ?? []

  let body: React.ReactNode
  if (isPending) {
    body = (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-5" role="status" aria-label="Loading brands">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-[96px] rounded-[6px] bg-line/60 animate-pulse" />
        ))}
      </div>
    )
  } else if (isError && !data) {
    body = (
      <div role="alert" className="py-12 max-w-[520px]">
        <h2 className="type-h3 text-ink">We couldn&apos;t load brands</h2>
        <p className="mt-2 type-body text-muted">Something went wrong — usually a brief connection problem. Please try again.</p>
        <Button variant="primary" size="lg" className="mt-6" loading={isFetching} onClick={() => refetch()}>
          Retry
        </Button>
      </div>
    )
  } else if (brands.length === 0) {
    body = (
      <div className="py-12 max-w-[520px]">
        <h2 className="type-h3 text-ink">{q ? 'No brands match your search' : 'No brands yet'}</h2>
        <p className="mt-2 type-body text-muted">
          {q ? 'Try a different or shorter name.' : 'Marketplace brands will appear here as they join. Check back soon.'}
        </p>
        {q && (
          <Button variant="primary" size="lg" className="mt-6" onClick={() => go('', 1)}>
            Clear search
          </Button>
        )}
      </div>
    )
  } else {
    body = (
      <div className={isFetching ? 'opacity-60 transition-opacity duration-150' : undefined} aria-busy={isFetching || undefined}>
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-5">
          {brands.map((b) => (
            <li key={b.id} className="min-w-0">
              <Link
                href={`/brands/${b.slug}`}
                className="flex items-center gap-4 min-h-[96px] p-4 bg-white border border-line rounded-[6px] hover:border-forest transition-colors duration-150"
              >
                <BrandLogo brand={b} size={56} />
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 text-[16px] leading-[24px] font-[600] text-ink">
                    <span className="truncate">{b.name}</span>
                    {b.isVerified && <VerifiedBadge size={16} />}
                  </span>
                  <span className="block type-caption text-muted">
                    {b.country ? `${b.country} · ` : ''}
                    {b.productCount} {b.productCount === 1 ? 'product' : 'products'}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <Pagination page={page} totalPages={data?.totalPages ?? 1} onPageChange={(p) => go(q, p)} />
      </div>
    )
  }

  return (
    <div className="sb-container pt-4 lg:pt-6 pb-12 lg:pb-[72px]">
      <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Brands' }]} />
      <header className="mt-4">
        <p className="type-eyebrow text-brass-dark">Marketplace</p>
        <h1 className="mt-2 type-h1 text-ink">Brands</h1>
        <p className="mt-4 max-w-[660px] type-body text-muted">
          Independent Indian brands selling on Solomon Bharat. Each sets its own prices and ships its own orders; we
          collect your payment in one checkout.
        </p>
      </header>

      <form
        role="search"
        className="relative mt-8 w-full lg:max-w-[360px]"
        onSubmit={(e) => {
          e.preventDefault()
          go(draft.trim(), 1)
        }}
      >
        <label htmlFor="brand-search" className="sr-only">
          Search brands
        </label>
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted pointer-events-none" aria-hidden="true" />
        <input
          id="brand-search"
          type="search"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Search brands"
          className="w-full h-12 pl-11 pr-4 rounded-[24px] border border-line bg-white text-[16px] leading-[24px] text-ink placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-forest"
        />
      </form>

      <div className="mt-6">{body}</div>
    </div>
  )
}

export default function BrandsPage() {
  const { user } = useAuth()
  // Agents never see marketplace brands.
  if (user?.role === 'AGENT') notFound()
  return (
    <div className="min-h-screen bg-ivory flex flex-col">
      <NavBar />
      <main className="flex-1">
        <Suspense fallback={<div className="sb-container sb-section" aria-busy="true" />}>
          <BrandsList />
        </Suspense>
      </main>
      <Footer />
    </div>
  )
}
