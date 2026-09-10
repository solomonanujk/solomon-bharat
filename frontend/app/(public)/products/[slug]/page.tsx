'use client'

import { use, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { NavBar } from '@/components/shared/NavBar'
import { Footer } from '@/components/shared/Footer'
import { PhotoGallery } from '@/components/pdp/PhotoGallery'
import { ProductInfo } from '@/components/pdp/ProductInfo'
import { ProductCard } from '@/components/shared/ProductCard'
import { EmptyState } from '@/components/shared/EmptyState'
import { useProduct } from '@/hooks/queries/useProducts'
import { useRecentlyViewed } from '@/hooks/useRecentlyViewed'

// ─── Related products ─────────────────────────────────────────────────────────

function RelatedProducts({ products }: { products: import('@/types').Product[] }) {
  if (!products || products.length === 0) return null

  return (
    <section className="border-t border-border-warm">
      <div className="max-w-[1280px] mx-auto w-full px-6 lg:px-16 py-10">
        <h2 className="font-playfair font-[600] text-primary text-[20px] leading-tight mb-6">
          Related products
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          {products.slice(0, 6).map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function PDPSkeleton() {
  return (
    <main className="flex-1 max-w-[1280px] mx-auto w-full px-6 lg:px-16 py-12">
      <div className="flex items-center gap-2 mb-8">
        {[12, 20, 2, 32].map((w, i) => (
          <div key={i} className={`h-3 bg-muted-bg rounded w-${w} animate-pulse`} />
        ))}
      </div>
      <div className="flex flex-col lg:flex-row gap-12 lg:gap-16">
        <div className="w-full lg:w-[60%] flex flex-col gap-2">
          <div className="flex gap-2 h-[340px]">
            <div className="flex-[2] bg-muted-bg rounded animate-pulse" />
            <div className="flex-[3] bg-muted-bg rounded animate-pulse" />
          </div>
        </div>
        <div className="w-full lg:w-[40%] flex flex-col gap-4">
          <div className="h-7 bg-muted-bg rounded w-3/4 animate-pulse" />
          <div className="h-10 bg-muted-bg rounded w-1/2 animate-pulse" />
          <div className="h-12 bg-muted-bg rounded animate-pulse mt-4" />
        </div>
      </div>
    </main>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProductDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  const router = useRouter()
  const { data: product, isLoading, isError } = useProduct(slug)
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
        <main className="flex-1 flex items-center justify-center">
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

  return (
    <div className="bg-bg min-h-screen flex flex-col">
      <NavBar />

      <main className="flex-1">
        <div className="max-w-[1280px] mx-auto w-full px-4 sm:px-6 lg:px-16 py-6 sm:py-10">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-0.5 mb-8 text-[11px] font-public-sans text-muted-text" aria-label="Breadcrumb">
            <button
              type="button"
              onClick={() => router.back()}
              className="inline-flex items-center gap-1 mr-3 font-[700] hover:text-primary transition-colors"
            >
              <ArrowLeft size={13} />
              Back
            </button>
            <span aria-hidden="true">/</span>
            <Link href="/" className="hover:text-primary transition-colors">Home</Link>
            <span aria-hidden="true">/</span>
            <span className="text-primary truncate max-w-[200px]">{product.name}</span>
          </nav>

          {/* Two-column layout */}
          <div className="flex flex-col lg:flex-row gap-10 lg:gap-12 lg:items-start">
            <div className="w-full lg:w-[67%] lg:sticky lg:top-[88px] lg:self-start">
              <PhotoGallery images={images} productName={product.name} />
            </div>

            <div className="w-full lg:w-[33%]">
              <ProductInfo product={product} />
            </div>
          </div>
        </div>

        <RelatedProducts products={product.related ?? []} />
      </main>

      <Footer />
    </div>
  )
}
