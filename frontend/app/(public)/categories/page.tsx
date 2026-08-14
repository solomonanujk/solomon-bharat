'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Search, X } from 'lucide-react'
import { NavBar } from '@/components/shared/NavBar'
import { Footer } from '@/components/shared/Footer'
import { EmptyState } from '@/components/shared/EmptyState'
import { useCategoryTree } from '@/hooks/queries/useCategories'
import type { CategoryNode } from '@/types'

interface FlatCategory {
  id: string
  slug: string
  name: string
  heroImage: string | null
  productCount: number
  path: string
}

/** Flattens the L1→L2→L3 tree so search can match a category at any level. */
function flattenTree(nodes: CategoryNode[], trail: string[] = []): FlatCategory[] {
  return nodes.flatMap((node) => {
    const path = [...trail, node.name]
    const self: FlatCategory = {
      id: node.id,
      slug: node.slug,
      name: node.name,
      heroImage: node.heroImage,
      productCount: node.productCount ?? 0,
      path: path.join(' / '),
    }
    const children = node.children ? flattenTree(node.children, path) : []
    return [self, ...children]
  })
}

function CategorySkeleton() {
  return (
    <div className="flex flex-col bg-surface border border-border-warm rounded overflow-hidden animate-pulse">
      <div className="aspect-[4/3] bg-muted-bg" />
      <div className="p-4">
        <div className="h-5 bg-muted-bg rounded w-3/4" />
        <div className="h-3 bg-muted-bg rounded w-1/3 mt-2" />
      </div>
    </div>
  )
}

export default function CategoryListingPage() {
  const { data: tree = [], isLoading } = useCategoryTree()
  const [search, setSearch] = useState('')

  const flat = useMemo(() => flattenTree(tree), [tree])
  const query = search.trim().toLowerCase()
  const results = query ? flat.filter((c) => c.name.toLowerCase().includes(query)) : []
  const isSearching = query.length > 0

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <NavBar />

      <main className="flex-1">
        <div className="max-w-[1280px] mx-auto w-full px-4 py-10 sm:py-14">
          <div className="mb-8 max-w-[560px]">
            <p className="font-public-sans text-[12px] font-[600] text-accent uppercase tracking-[0.08em] mb-3">
              Discover
            </p>
            <h1 className="font-playfair font-[500] text-primary leading-[1.15] text-[30px] sm:text-[40px]">
              Browse Categories
            </h1>
            <p className="font-public-sans text-[14px] text-muted-text mt-3 leading-[1.6]">
              Explore Solomon Bharat's curated catalog of Indian artisan goods, organized by category.
            </p>
          </div>

          {/* Search — matches a category, subcategory, or sub-subcategory by name */}
          <div className="relative max-w-[420px] mb-10">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-text" aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search categories..."
              className="w-full h-10 pl-10 pr-9 border border-border-warm rounded-full text-[13px] font-public-sans placeholder:text-muted-text/50 bg-surface focus:outline-none focus:border-accent transition-colors"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-text hover:text-primary transition-colors"
              >
                <X size={14} aria-hidden="true" />
              </button>
            )}
          </div>

          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
              {Array.from({ length: 8 }).map((_, i) => <CategorySkeleton key={i} />)}
            </div>
          ) : isSearching ? (
            results.length === 0 ? (
              <EmptyState title="No categories match your search" description={`Nothing found for "${search}".`} />
            ) : (
              <div className="flex flex-col divide-y divide-border-warm border-t border-b border-border-warm">
                {results.map((category) => (
                  <Link
                    key={category.id}
                    href={`/categories/${category.slug}`}
                    className="group flex items-center gap-4 py-3 hover:bg-surface transition-colors"
                  >
                    <div className="w-14 h-14 flex-shrink-0 rounded overflow-hidden bg-muted-bg relative">
                      {category.heroImage ? (
                        <Image src={category.heroImage} alt={category.name} fill sizes="56px" className="object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-[#F0EBE3]">
                          <span className="font-playfair text-[18px] font-[500] text-[#C8BEAE] select-none leading-none">
                            {category.name.charAt(0)}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-public-sans text-[11px] text-muted-text truncate">{category.path}</p>
                      <p className="font-playfair font-[500] text-primary text-[16px] leading-snug group-hover:text-accent transition-colors">
                        {category.name}
                      </p>
                    </div>
                    {category.productCount > 0 && (
                      <span className="font-public-sans text-[12px] text-muted-text flex-shrink-0">
                        {category.productCount} products
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            )
          ) : tree.length === 0 ? (
            <EmptyState title="No categories yet" description="Check back soon." />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
              {tree.map((category) => (
                <Link
                  key={category.id}
                  href={`/categories/${category.slug}`}
                  className="group flex flex-col bg-surface border border-border-warm rounded overflow-hidden hover:border-primary/30 hover:shadow-[0_4px_20px_rgba(26,26,26,0.06)] transition-all duration-200"
                >
                  <div className="aspect-[4/3] overflow-hidden bg-muted-bg relative">
                    {category.heroImage ? (
                      <Image
                        src={category.heroImage}
                        alt={category.name}
                        fill
                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-[#F0EBE3]">
                        <span className="font-playfair text-[36px] font-[500] text-[#C8BEAE] select-none leading-none">
                          {category.name.charAt(0)}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <p className="font-playfair font-[500] text-primary text-[16px] leading-snug">
                      {category.name}
                    </p>
                    {category.productCount > 0 && (
                      <p className="font-public-sans text-[12px] text-muted-text mt-1">
                        {category.productCount} products
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
