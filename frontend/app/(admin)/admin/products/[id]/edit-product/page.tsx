'use client'

import { use } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { useAdminProduct } from '@/hooks/queries/useProducts'
import { ProductForm } from '@/components/seller-portal/ProductForm'

export default function AdminProductEditDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data: product, isLoading, error } = useAdminProduct(id)

  return (
    <div>
      <div className="flex items-center gap-3 mb-8">
        <Link
          href={`/admin/products/${id}`}
          className="inline-flex items-center justify-center w-8 h-8 rounded border border-[#D9E2DA] text-[#183D33B3] hover:text-[#0F241D] hover:bg-[#E7EDE7] transition-colors"
          aria-label="Back to product"
        >
          <ArrowLeft size={15} />
        </Link>
        <h1 className="text-[24px] leading-[1.3] font-[500] font-sans text-[#0F241D]">
          {product?.name ?? 'Product'}
        </h1>
      </div>

      {isLoading ? (
        <div className="max-w-2xl space-y-4 animate-pulse">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 bg-[#E7EDE7] rounded" />
          ))}
        </div>
      ) : error || !product ? (
        <p className="text-[14px] font-sans text-[#183D33]">Could not load this product.</p>
      ) : (
        <ProductForm product={product} mode="admin-edit" />
      )}
    </div>
  )
}
