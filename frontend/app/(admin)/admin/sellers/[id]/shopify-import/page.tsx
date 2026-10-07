'use client'

import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { useAdminSeller } from '@/hooks/queries/useSellers'
import { ShopifyProductPicker } from '@/components/seller-portal/ShopifyProductPicker'

export default function AdminShopifyImportPage() {
  const params = useParams<{ id: string }>()
  const { data: seller } = useAdminSeller(params.id)

  return (
    <div>
      <div className="mb-6">
        <Link
          href={`/admin/sellers/${params.id}`}
          className="inline-flex items-center gap-1.5 text-[13px] font-[600] font-sans text-[#6B6460] hover:text-[#1A1A1A] transition-colors mb-3"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          Back to seller
        </Link>
        <h1 className="text-[24px] font-[700] font-sans text-[#1A1A1A] leading-tight">
          Import from Shopify{seller ? ` — ${seller.businessName}` : ''}
        </h1>
        <p className="text-[13px] font-sans text-[#6B6460] mt-0.5">
          Connect and import products on behalf of this seller.
        </p>
      </div>

      <ShopifyProductPicker sellerIdOverride={params.id} />
    </div>
  )
}
