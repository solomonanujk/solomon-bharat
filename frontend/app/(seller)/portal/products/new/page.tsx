'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { ProductForm } from '@/components/seller-portal/ProductForm'

export default function NewProductPage() {
  return (
    <div>
      <div className="flex items-center gap-3 mb-8">
        <Link
          href="/portal/products"
          className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-[#E5E1D8] text-[#C4BDB4] hover:text-[#1A1A1A] hover:bg-[#F5F0E8] transition-colors"
          aria-label="Back to products"
        >
          <ArrowLeft size={15} />
        </Link>
        <div>
          <h1 className="text-[24px] font-[700] font-sans text-[#1A1A1A] leading-tight">Submit Product</h1>
          <p className="text-[13px] font-sans text-[#6B6460] mt-0.5">Fill in the details below to submit for review.</p>
        </div>
      </div>

      <ProductForm />
    </div>
  )
}
