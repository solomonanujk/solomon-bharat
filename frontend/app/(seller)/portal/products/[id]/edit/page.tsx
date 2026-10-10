'use client'

import { use } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { useMyProduct } from '@/hooks/queries/useProducts'
import { useSellerType } from '@/hooks/queries/useBrandPortal'
import { ProductForm } from '@/components/seller-portal/ProductForm'

export default function ProductEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data: product, isLoading, error } = useMyProduct(id)
  const { isMarketplace: isBrand } = useSellerType()

  return (
    <div>
      <div className="flex items-center gap-3 mb-8">
        <Link
          href={`/portal/products/${id}`}
          className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-[#E5DCCB] text-[#C4BDB4] hover:text-[#20201E] hover:bg-[#F5F0E5] transition-colors"
          aria-label="Back to product"
        >
          <ArrowLeft size={15} />
        </Link>
        <div>
          <h1 className="text-[24px] font-[700] font-sans text-[#20201E] leading-tight">
            {product?.name ?? 'Edit Product'}
          </h1>
          <p className="text-[13px] font-sans text-[#665F55] mt-0.5">{isBrand ? 'Changes go live as soon as you save.' : 'Update product details and resubmit for review.'}</p>
        </div>
      </div>

      {isLoading ? (
        <div className="max-w-2xl space-y-4 animate-pulse">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 bg-white border border-[#E5DCCB] rounded-xl" />
          ))}
        </div>
      ) : error || !product ? (
        <p className="text-[14px] font-sans text-red-500">Could not load this product.</p>
      ) : (
        <ProductForm product={product} />
      )}
    </div>
  )
}
