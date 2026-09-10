'use client'

import { use, useState, useMemo } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Search } from 'lucide-react'
import { NavBar } from '@/components/shared/NavBar'
import { Footer } from '@/components/shared/Footer'
import { EmptyState } from '@/components/shared/EmptyState'
import { ProductGrid } from '@/components/catalogue/ProductGrid'
import { useCollection, useCollections } from '@/hooks/queries/useCollections'
import { useInfiniteProducts } from '@/hooks/queries/useProducts'
import { cloudinaryFill } from '@/lib/cloudinaryImage'

const PAGE_SIZE = 24

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="animate-pulse">
          <div className="aspect-square bg-[#F0EBE3] rounded-lg mb-3" />
          <div className="h-3 bg-[#F0EBE3] rounded w-1/2 mb-2" />
          <div className="h-4 bg-[#F0EBE3] rounded w-3/4 mb-2" />
          <div className="h-4 bg-[#F0EBE3] rounded w-1/3" />
        </div>
      ))}
    </div>
  )
}

function RelatedCollections({ currentSlug }: { currentSlug: string }) {
  const { data } = useCollections({ limit: 8 })
  const others = (data?.items ?? []).filter((c) => c.slug !== currentSlug).slice(0, 4)

  if (others.length === 0) return null

  return (
    <section className="border-t border-border-warm">
      <div className="max-w-[1280px] mx-auto w-full px-4 py-10">
        <h2 className="font-playfair font-[500] text-primary text-[22px] leading-tight mb-6">
          Related Collections
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {others.map((c) => (
            <Link
              key={c.id}
              href={`/collections/${c.slug}`}
              className="group flex flex-col bg-surface border border-border-warm rounded overflow-hidden hover:border-primary/30 transition-colors"
            >
              <div className="aspect-[4/3] overflow-hidden bg-muted-bg relative">
                {c.heroImage ? (
                  <Image src={cloudinaryFill(c.heroImage, 700, 525)} alt={c.name} fill sizes="25vw" className="object-contain group-hover:scale-[1.04] transition-transform duration-500" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-[#F0EBE3]">
                    <span className="font-playfair text-[28px] font-[500] text-[#C8BEAE]">{c.name.charAt(0)}</span>
                  </div>
                )}
              </div>
              <div className="p-3">
                <p className="font-playfair font-[500] text-primary text-[14px] leading-snug">{c.name}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}

export default function CollectionDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  const [search, setSearch] = useState('')

  const { data: collection, isLoading: collectionLoading } = useCollection(slug)

  const productsParams = useMemo(
    () => ({
      collectionId: collection?.id,
      search: search || undefined,
      limit: PAGE_SIZE,
    }),
    [collection?.id, search]
  )

  const {
    data,
    isLoading: productsLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteProducts(productsParams)
  const products = data?.pages.flatMap((p) => p.items) ?? []
  const total = data?.pages[0]?.total ?? 0

  if (collectionLoading) {
    return (
      <div className="min-h-screen bg-bg flex flex-col">
        <NavBar />
        <main className="flex-1 max-w-[1280px] mx-auto w-full px-4 py-8">
          <LoadingSkeleton />
        </main>
        <Footer />
      </div>
    )
  }

  if (!collection) {
    return (
      <div className="min-h-screen bg-bg flex flex-col">
        <NavBar />
        <main className="flex-1 flex items-center justify-center">
          <EmptyState
            title="Collection not found"
            description="This collection may have been removed or the link is incorrect."
            action={{ label: 'Browse Collections', onClick: () => { window.location.href = '/collections' } }}
          />
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <NavBar />

      <main className="flex-1">
        {/* Editorial hero */}
        <div className="relative h-[300px] sm:h-[380px] bg-muted-bg overflow-hidden">
          {collection.heroImage && (
            <img src={cloudinaryFill(collection.heroImage, 1600, 500)} alt={collection.name} className="absolute inset-0 w-full h-full object-contain" />
          )}
          <div className="absolute inset-0 bg-black/35" />
          <div className="relative max-w-[900px] mx-auto w-full h-full px-4 flex flex-col items-center justify-center text-center">
            <p className="font-public-sans text-[11px] font-[600] text-white/80 uppercase tracking-[0.12em] mb-3">
              Solomon Bharat Collection
            </p>
            <h1 className="font-playfair text-[32px] sm:text-[46px] font-[500] text-white leading-tight">
              {collection.name}
            </h1>
            {collection.editorialIntro && (
              <p className="font-public-sans text-[14px] sm:text-[15px] text-white/90 mt-4 max-w-[620px] leading-[1.7]">
                {collection.editorialIntro}
              </p>
            )}
          </div>
        </div>

        <div className="max-w-[1280px] mx-auto w-full px-4 py-8">
          {/* Context search */}
          <div className="relative max-w-[420px] mb-8">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-text" aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search in ${collection.name}...`}
              className="w-full h-10 pl-10 pr-4 border border-border-warm rounded-full text-[13px] font-public-sans placeholder:text-muted-text/50 bg-surface focus:outline-none focus:border-accent transition-colors"
            />
          </div>

          {productsLoading ? (
            <LoadingSkeleton />
          ) : products.length === 0 ? (
            <EmptyState
              title="No products found"
              description={search ? 'Try a different search term.' : 'This collection has no products yet.'}
            />
          ) : (
            <ProductGrid
              products={products}
              totalCount={total}
              hasMore={!!hasNextPage}
              isLoadingMore={isFetchingNextPage}
              onLoadMore={fetchNextPage}
            />
          )}
        </div>

        <RelatedCollections currentSlug={slug} />
      </main>

      <Footer />
    </div>
  )
}
