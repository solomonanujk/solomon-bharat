'use client'

import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { useAdminSeller } from '@/hooks/queries/useSellers'
import { SpreadsheetProductImport } from '@/components/seller-portal/SpreadsheetProductImport'

export default function AdminSellerProductImportPage() {
  const params = useParams<{ id: string }>()
  const { data: seller } = useAdminSeller(params.id)

  return (
    <div>
      <div className="mb-6">
        <Link
          href={`/admin/sellers/${params.id}`}
          className="inline-flex items-center gap-1.5 text-[13px] font-[600] font-sans text-muted-text hover:text-primary transition-colors mb-3"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          Back to seller
        </Link>
        <h1 className="text-[24px] font-[700] font-sans text-primary leading-tight">
          Import products{seller ? ` — ${seller.businessName}` : ''}
        </h1>
        <p className="text-[13px] font-sans text-muted-text mt-0.5">
          Import products from this seller’s Shopify or WooCommerce export on their behalf. Products are created as
          drafts under this seller.
        </p>
      </div>

      <SpreadsheetProductImport sellerProfileId={params.id} />
    </div>
  )
}
