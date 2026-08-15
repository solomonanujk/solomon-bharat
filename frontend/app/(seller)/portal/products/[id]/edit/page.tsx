'use client'

import { use } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { useMyProduct } from '@/hooks/queries/useProducts'
import { ProductForm } from '@/components/seller-portal/ProductForm'

export default function ProductEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data: product, isLoading, error } = useMyProduct(id)

  return (
    <div>
      <div className="flex items-center gap-3 mb-8">
        <Link
          href={`/portal/products/${id}`}
          className="inline-flex items-center justify-center w-8 h-8 rounded border border-border-warm text-muted-text hover:text-primary hover:bg-muted-bg transition-colors"
          aria-label="Back to product"
        >
          <ArrowLeft size={15} />
        </Link>
        <h1 className="text-[24px] leading-[1.3] font-[500] font-playfair text-primary">
          {product?.name ?? 'Product'}
        </h1>
      </div>

      {isLoading ? (
        <div className="max-w-2xl space-y-4 animate-pulse">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 bg-muted-bg rounded" />
          ))}
        </div>
      ) : error || !product ? (
        <p className="text-[14px] font-public-sans text-error">Could not load this product.</p>
      ) : (
        <ProductForm product={product} />
      )}
    </div>
  )
}
