'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { SpreadsheetProductImport } from '@/components/seller-portal/SpreadsheetProductImport'

export default function ProductImportPage() {
  return (
    <div>
      <div className="mb-6">
        <Link
          href="/portal/products"
          className="inline-flex items-center gap-1.5 text-[13px] font-[600] font-sans text-muted-text hover:text-primary transition-colors mb-3"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          Back to My Products
        </Link>
        <h1 className="text-[24px] font-[700] font-sans text-primary leading-tight">Import products</h1>
        <p className="text-[13px] font-sans text-muted-text mt-0.5">
          Bring products in from a Shopify or WooCommerce export as drafts, ready to finish and submit.
        </p>
      </div>

      <SpreadsheetProductImport />
    </div>
  )
}
