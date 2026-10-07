'use client'

import { ShopifyProductPicker } from '@/components/seller-portal/ShopifyProductPicker'

export default function ShopifyImportPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-[24px] font-[700] font-sans text-[#1A1A1A] leading-tight">Import from Shopify</h1>
        <p className="text-[13px] font-sans text-[#6B6460] mt-0.5">
          Bring products from your Shopify store in as drafts, ready to finish and submit.
        </p>
      </div>

      <ShopifyProductPicker />
    </div>
  )
}
