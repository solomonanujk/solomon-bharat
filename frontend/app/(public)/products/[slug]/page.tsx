'use client'

import { use, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ChevronRight } from 'lucide-react'
import { NavBar } from '@/components/shared/NavBar'
import { Footer } from '@/components/shared/Footer'
import { PhotoGallery } from '@/components/pdp/PhotoGallery'
import { ProductVideoStrip } from '@/components/pdp/ProductVideoStrip'
import { ProductInfo } from '@/components/pdp/ProductInfo'
import { ProductCard } from '@/components/shared/ProductCard'
import { EmptyState } from '@/components/shared/EmptyState'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { useProduct } from '@/hooks/queries/useProducts'
import { useCategoryTree } from '@/hooks/queries/useCategories'
import { useRecentlyViewed } from '@/hooks/useRecentlyViewed'
import type { CategoryNode, Product } from '@/types'

// ─── Category path ────────────────────────────────────────────────────────────
// The product record only carries its Level-3 categoryId, so the breadcrumb and
// eyebrow are resolved against the (already cached, NavBar-shared) public tree.

function findCategoryPath(nodes: CategoryNode[] | undefined, id: string): CategoryNode[] {
  for (const node of nodes ?? []) {
    if (node.id === id) return [node]
    const sub = findCategoryPath(node.children, id)
    if (sub.length) return [node, ...sub]
  }
  return []
}

// ─── Related products ─────────────────────────────────────────────────────────

function RelatedProducts({ products, currentId }: { products: Product[]; currentId: string }) {
  const items = products.filter((p) => p.id !== currentId).slice(0, 8)
  if (items.length === 0) return null

  return (
    <section aria-labelledby="pdp-related-heading" className="sb-section bg-white border-t border-line">
      <div className="sb-container">
        <h2 id="pdp-related-heading" className="type-h2 text-ink mb-6 lg:mb-8">Related products</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-5 lg:gap-6">
          {items.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Loading skeleton — final layout sizes, neutral fills ─────────────────────

function PDPSkeleton() {
  return (
    <main className="flex-1 sb-container py-6 lg:py-8" aria-busy="true" aria-label="Loading product">
      <div className="h-5 w-64 max-w-full bg-line/60 rounded-[4px] animate-pulse mb-6" />
      <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-8 lg:gap-14">
        <div className="flex flex-col gap-3">
          <div className="w-full aspect-square bg-line/60 rounded-[6px] animate-pulse" />
          <div className="flex gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="w-16 h-16 lg:w-[72px] lg:h-[72px] bg-line/60 rounded-[4px] animate-pulse" />
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-4 pt-3">
          <div className="h-4 w-32 bg-line/60 rounded-[4px] animate-pulse" />
          <div className="h-10 w-3/4 bg-line/60 rounded-[4px] animate-pulse" />
          <div className="h-20 w-full bg-line/60 rounded-[4px] animate-pulse" />
          <div className="h-5 w-28 bg-line/60 rounded-[2px] animate-pulse" />
          <div className="h-[220px] w-full bg-line/60 rounded-[6px] animate-pulse mt-2" />
        </div>
      </div>
    </main>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProductDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  const router = useRouter()
  const { isAuthenticated } = useAuth()
  const { data: product, isLoading, isError } = useProduct(slug)
  const { data: categoryTree } = useCategoryTree()
  const { track } = useRecentlyViewed()

  useEffect(() => {
    if (!product) return
    track({
      id: product.id,
      slug: product.slug,
      name: product.name,
      imageUrl: product.images?.[0]?.url ?? '',
      price: product.adminPrice,
      moq: product.moq,
      avgRating: product.avgRating,
      reviewCount: product.reviewCount,
      leadTime: product.leadTime,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id])

  const categoryPath = useMemo(
    () => (product ? findCategoryPath(categoryTree, product.categoryId) : []),
    [categoryTree, product]
  )

  if (isLoading) {
    return (
      <div className="bg-bg min-h-screen flex flex-col">
        <NavBar />
        <PDPSkeleton />
        <Footer />
      </div>
    )
  }

  if (isError || !product) {
    return (
      <div className="bg-bg min-h-screen flex flex-col">
        <NavBar />
        <main className="flex-1 flex items-center justify-center sb-container sb-section">
          <EmptyState
            title="Product not found"
            description="This product may have been removed or the link is incorrect."
            action={{ label: 'Back to Home', onClick: () => { window.location.href = '/' } }}
          />
        </main>
        <Footer />
      </div>
    )
  }

  const images = [...(product.images ?? [])].sort((a, b) => a.sortOrder - b.sortOrder).map((img) => img.url)
  const categoryName = categoryPath.length ? categoryPath[categoryPath.length - 1].name : null

  const crumbLink =
    'inline-flex items-center min-h-11 underline underline-offset-4 decoration-line hover:text-ink hover:decoration-forest transition-colors duration-150'

  return (
    // Guests on mobile get bottom padding matching the sticky signup bar
    // (ProductInfo) so it never covers the footer's last row.
    <div
      className={cn(
        'bg-bg min-h-screen flex flex-col',
        !isAuthenticated && 'pb-[calc(76px+env(safe-area-inset-bottom))] lg:pb-0'
      )}
    >
      <NavBar />

      <main className="flex-1">
        <div className="sb-container pt-2 pb-12 lg:pt-4 lg:pb-[72px]">
          {/* Breadcrumb */}
          <div className="flex flex-wrap items-center gap-x-4 mb-4 lg:mb-6">
            <button
              type="button"
              onClick={() => router.back()}
              className="inline-flex items-center gap-1 min-h-11 text-[14px] leading-[20px] font-[600] text-forest hover:text-forest-hover transition-colors duration-150"
            >
              <ArrowLeft size={16} aria-hidden="true" />
              Back
            </button>
            <nav aria-label="Breadcrumb" className="min-w-0">
              <ol className="flex flex-wrap items-center gap-x-1.5 text-[13px] leading-[20px] text-muted">
                <li className="inline-flex items-center">
                  <Link href="/" className={crumbLink}>Home</Link>
                </li>
                {categoryPath.map((c) => (
                  <li key={c.id} className="inline-flex items-center gap-1.5">
                    <ChevronRight size={14} className="text-muted" aria-hidden="true" />
                    <Link href={`/categories/${c.slug}`} className={crumbLink}>{c.name}</Link>
                  </li>
                ))}
                <li className="inline-flex items-center gap-1.5 min-w-0">
                  <ChevronRight size={14} className="text-muted flex-shrink-0" aria-hidden="true" />
                  <span aria-current="page" className="text-ink truncate max-w-[200px] sm:max-w-[320px]">{product.name}</span>
                </li>
              </ol>
            </nav>
          </div>

          {/* Gallery : details = 1.1 : 1, 56px gap; stacked with 32px gap below 1024px */}
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] gap-8 lg:gap-14 lg:items-start">
            <div className="min-w-0 lg:sticky lg:top-[136px]">
              <PhotoGallery images={images} productName={product.name} />
              <ProductVideoStrip videos={product.videos ?? []} productName={product.name} />
            </div>

            <div className="min-w-0">
              <ProductInfo product={product} categoryName={categoryName} />
            </div>
          </div>
        </div>

        <RelatedProducts products={product.related ?? []} currentId={product.id} />
      </main>

      <Footer />
    </div>
  )
}
