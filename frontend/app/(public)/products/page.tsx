'use client'

import { Suspense } from 'react'
import { NavBar } from '@/components/shared/NavBar'
import { Footer } from '@/components/shared/Footer'
import type { Crumb } from '@/components/catalogue/Breadcrumbs'
import { CatalogueView, CataloguePageSkeleton } from '@/components/catalogue/CatalogueView'

// Every published product, with the full catalogue filters. Target of "Browse products".
const CRUMBS: Crumb[] = [{ label: 'Home', href: '/' }, { label: 'All products' }]

export default function AllProductsPage() {
  return (
    <div className="min-h-screen bg-ivory flex flex-col">
      <NavBar />
      <main className="flex-1">
        <Suspense fallback={<CataloguePageSkeleton breadcrumbs={CRUMBS} />}>
          <CatalogueView
            breadcrumbs={CRUMBS}
            eyebrow="Browse"
            title="All products"
            intro="Handmade products from Indian makers and brands, across every category."
            emptyBody="No products have been published yet. Check back soon."
          />
        </Suspense>
      </main>
      <Footer />
    </div>
  )
}
