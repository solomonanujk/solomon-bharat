'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { useSellerType } from '@/hooks/queries/useBrandPortal'
import { ProductForm } from '@/components/seller-portal/ProductForm'

export default function NewProductPage() {
  const { isMarketplace: isBrand } = useSellerType()
  return (
    <div>
      <div className="flex items-center gap-3 mb-8">
        <Link
          href="/portal/products"
          className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-[#E5DCCB] text-[#C4BDB4] hover:text-[#20201E] hover:bg-[#F5F0E5] transition-colors"
          aria-label="Back to products"
        >
          <ArrowLeft size={15} />
        </Link>
        <div>
          <h1 className="text-[24px] font-[700] font-sans text-[#20201E] leading-tight">{isBrand ? 'Add Product' : 'Submit Product'}</h1>
          <p className="text-[13px] font-sans text-[#665F55] mt-0.5">
            {isBrand
              ? 'Set the price buyers pay. Your product goes live as soon as you publish it. Solomon keeps 25% on your first order and 15% after.'
              : 'Fill in the details below to submit for review.'}
          </p>
        </div>
      </div>

      <ProductForm />
    </div>
  )
}
