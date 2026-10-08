'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { ProductForm } from '@/components/seller-portal/ProductForm'

export default function AdminNewProductPage() {
  return (
    <div>
      <div className="flex items-center gap-3 mb-8">
        <Link
          href="/admin/products"
          className="inline-flex items-center justify-center w-8 h-8 rounded border border-[#E5DCCB] text-[#665F55] hover:text-[#20201E] hover:bg-[#F5F0E5] transition-colors"
          aria-label="Back to products"
        >
          <ArrowLeft size={15} />
        </Link>
        <h1 className="text-[24px] leading-[1.3] font-[500] font-sans text-[#20201E]">New Product</h1>
      </div>

      <ProductForm mode="admin-create" />
    </div>
  )
}
