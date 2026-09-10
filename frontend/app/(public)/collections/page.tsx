'use client'

import Image from 'next/image'
import Link from 'next/link'
import { NavBar } from '@/components/shared/NavBar'
import { Footer } from '@/components/shared/Footer'
import { EmptyState } from '@/components/shared/EmptyState'
import { useCollections } from '@/hooks/queries/useCollections'
import { cloudinaryFill } from '@/lib/cloudinaryImage'

function CollectionSkeleton() {
  return (
    <div className="flex flex-col bg-surface border border-border-warm rounded overflow-hidden animate-pulse">
      <div className="aspect-[16/10] bg-muted-bg" />
      <div className="p-5">
        <div className="h-5 bg-muted-bg rounded w-2/3" />
        <div className="h-3 bg-muted-bg rounded w-full mt-3" />
        <div className="h-3 bg-muted-bg rounded w-4/5 mt-1.5" />
      </div>
    </div>
  )
}

export default function CollectionListingPage() {
  const { data, isLoading } = useCollections({ limit: 48 })
  const collections = data?.items ?? []

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <NavBar />

      <main className="flex-1">
        <div className="max-w-[1280px] mx-auto w-full px-4 py-10 sm:py-14">
          <div className="mb-10 max-w-[560px]">
            <p className="font-public-sans text-[12px] font-[600] text-accent uppercase tracking-[0.08em] mb-3">
              Curated by Solomon Bharat
            </p>
            <h1 className="font-playfair font-[500] text-primary leading-[1.15] text-[30px] sm:text-[40px]">
              Collections
            </h1>
            <p className="font-public-sans text-[14px] text-muted-text mt-3 leading-[1.6]">
              Editorial groupings of our finest products, curated around themes, seasons, and use cases.
            </p>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => <CollectionSkeleton key={i} />)}
            </div>
          ) : collections.length === 0 ? (
            <EmptyState title="No collections yet" description="Check back soon." />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {collections.map((collection) => (
                <Link
                  key={collection.id}
                  href={`/collections/${collection.slug}`}
                  className="group flex flex-col bg-surface border border-border-warm rounded overflow-hidden hover:border-primary/30 hover:shadow-[0_4px_20px_rgba(26,26,26,0.06)] transition-all duration-200"
                >
                  <div className="aspect-[16/10] overflow-hidden bg-muted-bg relative">
                    {collection.heroImage ? (
                      <Image
                        src={cloudinaryFill(collection.heroImage, 1000, 625)}
                        alt={collection.name}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        className="object-contain transition-transform duration-500 group-hover:scale-[1.04]"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-[#F0EBE3]">
                        <span className="font-playfair text-[36px] font-[500] text-[#C8BEAE] select-none leading-none">
                          {collection.name.charAt(0)}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="p-5">
                    <p className="font-playfair font-[500] text-primary text-[18px] leading-snug">
                      {collection.name}
                    </p>
                    {collection.editorialIntro && (
                      <p className="font-public-sans text-[13px] text-muted-text mt-2 leading-[1.6] line-clamp-2">
                        {collection.editorialIntro}
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  )
}
