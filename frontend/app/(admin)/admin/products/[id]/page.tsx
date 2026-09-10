'use client'

import { useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Package, Star, CheckCircle2, XCircle, AlertTriangle, Clock } from 'lucide-react'
import { useAdminProduct } from '@/hooks/queries/useProducts'
import { useAdminCategoryTree } from '@/hooks/queries/useCategories'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { useImageLightbox } from '@/components/shared/ImageLightbox'
import { buttonVariants } from '@/components/ui/button'
import { Section, Field, collectAllTiers, TierPriceTable, flattenLeaves } from '@/components/admin/ProductAdminShared'
import { cn, formatINR } from '@/lib/utils'
import { cloudinaryFill } from '@/lib/cloudinaryImage'

export default function AdminProductDetailPage() {
  const params = useParams<{ id: string }>()
  const { data: product, isLoading, isError } = useAdminProduct(params.id)
  const { data: tree = [] } = useAdminCategoryTree()

  const leafCategories = useMemo(() => flattenLeaves(tree), [tree])

  const sortedImages = useMemo(
    () => (product ? [...product.images].sort((a, b) => a.sortOrder - b.sortOrder) : []),
    [product]
  )
  const [activeImage, setActiveImage] = useState(0)
  const { openLightbox, lightboxNode } = useImageLightbox()

  const allTiers = useMemo(() => (product ? collectAllTiers(product) : []), [product])

  // ── Loading / error states ────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto animate-pulse space-y-5">
        <div className="h-5 bg-muted-bg rounded w-24" />
        <div className="h-64 bg-muted-bg rounded" />
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
          <div className="space-y-5">
            <div className="h-40 bg-muted-bg rounded" />
            <div className="h-40 bg-muted-bg rounded" />
          </div>
          <div className="space-y-5">
            <div className="h-40 bg-muted-bg rounded" />
          </div>
        </div>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="max-w-5xl mx-auto">
        <Link href="/admin/products" className="flex items-center gap-1.5 text-[13px] font-public-sans text-muted-text hover:text-primary transition-colors mb-6">
          <ArrowLeft size={14} aria-hidden="true" /> Back to Products
        </Link>
        <div className="bg-surface border border-border-warm rounded py-20 flex flex-col items-center gap-3">
          <Package size={32} className="text-border-warm" aria-hidden="true" />
          <p className="text-[15px] font-[600] font-public-sans text-primary">
            {isError ? 'Failed to load product — check that the backend is running' : 'Product not found'}
          </p>
          {isError && <p className="text-[12px] font-public-sans text-muted-text">ID: {params.id}</p>}
        </div>
      </div>
    )
  }

  const needsReview = product.approvalStatus === 'PENDING' || product.approvalStatus === 'RESUBMITTED'
  const isApproved = product.approvalStatus === 'APPROVED'
  const showEditButton = needsReview || isApproved
  const categoryLabel = leafCategories.find((c) => c.id === product.categoryId)?.label

  return (
    <div className="max-w-5xl mx-auto">
      {/* Back */}
      <Link href="/admin/products" className="flex items-center gap-1.5 text-[13px] font-public-sans text-muted-text hover:text-primary transition-colors mb-6">
        <ArrowLeft size={14} aria-hidden="true" /> Back to Products
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <div className="flex flex-wrap items-center gap-2.5 mb-2">
            <StatusBadge status={product.approvalStatus} />
            {product.isPublished ? (
              <span className="inline-flex items-center gap-1 text-[12px] font-[600] font-public-sans text-success">
                <CheckCircle2 size={12} aria-hidden="true" /> Published
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[12px] font-[600] font-public-sans text-muted-text">
                <XCircle size={12} aria-hidden="true" /> Unpublished
              </span>
            )}
            {product.isFeatured && (
              <span className="inline-flex items-center gap-1 text-[12px] font-[600] font-public-sans text-accent">
                <Star size={12} className="fill-accent" aria-hidden="true" /> Featured
              </span>
            )}
            {product.pendingPricingChange && (
              <Link
                href="/admin/pricing-changes"
                className="inline-flex items-center gap-1 text-[12px] font-[600] font-public-sans text-warning hover:underline"
              >
                <Clock size={12} aria-hidden="true" /> Pricing change pending
              </Link>
            )}
          </div>
          <h1 className="text-[28px] leading-[1.3] font-[500] font-playfair text-primary">{product.name}</h1>
          <p className="text-[13px] font-public-sans text-muted-text mt-1">/{product.slug}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link href={`/admin/products/${product.id}/edit-product`} className={cn(buttonVariants({ variant: 'primary', size: 'sm' }))}>
            Edit Product
          </Link>
          {showEditButton && (
            <Link href={`/admin/products/${product.id}/edit`} className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}>
              Edit Pricing
            </Link>
          )}
        </div>
      </div>

      {/* Rejection reason */}
      {product.approvalStatus === 'REJECTED' && product.rejectionReason && (
        <div className="mb-5 flex items-start gap-3 bg-error/[6%] border border-error/30 rounded p-4">
          <AlertTriangle size={16} className="text-error shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <p className="text-[13px] font-[600] font-public-sans text-error">Rejection reason</p>
            <p className="text-[13px] font-public-sans text-primary mt-1 whitespace-pre-wrap">{product.rejectionReason}</p>
          </div>
        </div>
      )}

      {/* Image gallery */}
      {sortedImages.length > 0 && (
        <div className="mb-5">
          <button
            type="button"
            onClick={() => openLightbox(sortedImages[Math.min(activeImage, sortedImages.length - 1)].url, product.name)}
            className="w-full bg-surface border border-border-warm rounded overflow-hidden aspect-[16/9] flex items-center justify-center cursor-zoom-in"
            aria-label={`View ${product.name} full size`}
          >
            <img
              src={cloudinaryFill(sortedImages[Math.min(activeImage, sortedImages.length - 1)].url, 1200, 675)}
              alt={product.name}
              className="w-full h-full object-contain"
            />
          </button>
          {sortedImages.length > 1 && (
            <div className="flex gap-2 mt-2 overflow-x-auto pb-1">
              {sortedImages.map((img, i) => (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => setActiveImage(i)}
                  className={cn(
                    'w-16 h-16 rounded overflow-hidden border-2 shrink-0 bg-muted-bg transition-colors',
                    i === activeImage ? 'border-accent' : 'border-border-warm opacity-70 hover:opacity-100'
                  )}
                >
                  <img src={cloudinaryFill(img.url, 160, 160)} alt="" className="w-full h-full object-contain" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
        {/* Left column */}
        <div className="space-y-5 min-w-0">
          <Section title="Pricing Summary">
            <div className="grid grid-cols-3 gap-4">
              <Field label="Seller Price (from)" value={formatINR(product.sellerPrice)} />
              <Field
                label="Admin Price (from)"
                value={product.adminPrice != null ? formatINR(product.adminPrice) : <span className="italic text-muted-text">not set</span>}
              />
              <Field
                label="Agent Price (from)"
                value={product.agentPrice != null ? formatINR(product.agentPrice) : <span className="italic text-muted-text">not set</span>}
              />
            </div>
          </Section>

          <Section title="Seller Price Tiers">
            <TierPriceTable tiers={allTiers} />
          </Section>

          <Section title="Description">
            <p className="text-[13.5px] font-public-sans text-primary leading-[1.7] whitespace-pre-wrap break-words">
              {product.description}
            </p>
          </Section>

          <Section title="Details">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Materials" value={product.materials} />
              <Field label="Dimensions" value={product.dimensions ?? '—'} />
              <Field label="Weight" value={product.weight != null ? `${product.weight} kg` : '—'} />
              <Field label="MOQ" value={product.moq} />
              <Field label="Order Step" value={product.stepQty} />
              <Field label="Declared Stock" value={product.declaredStock} />
              <Field label="Lead Time" value={product.leadTime ?? '—'} />
              <Field label="Category" value={categoryLabel ?? `${product.categoryId} (unresolved)`} />
              <Field label="Tags" value={product.tags.length > 0 ? product.tags.join(', ') : '—'} />
              <Field label="Place of Origin" value={product.placeOfOrigin ?? '—'} />
              <Field label="Handmade" value={product.isHandmade ? 'Yes' : 'No'} />
              <Field label="GI Tagged" value={product.isGITagged ? 'Yes' : 'No'} />
            </div>
          </Section>

          {(product.howItIsMade || product.artisanName) && (
            <Section title="Craft Story">
              <Field label="How It's Made" value={product.howItIsMade ?? '—'} />
              <Field label="Artisan Name" value={product.artisanName ?? '—'} />
            </Section>
          )}

          <Section title="Variants">
            {product.variants.length === 0 ? (
              <p className="text-[13px] font-public-sans text-muted-text">No variants.</p>
            ) : (
              <div className="space-y-3">
                {product.variants.map((v) => (
                  <div key={v.id} className="flex flex-wrap items-center gap-2">
                    <span className="text-[12.5px] font-[600] font-public-sans text-primary bg-muted-bg border border-border-warm px-3 py-1.5 rounded">
                      {v.type}: {v.value}
                    </span>
                    {v.sku && (
                      <span className="text-[11.5px] font-public-sans text-muted-text">SKU: {v.sku}</span>
                    )}
                    {(v.attributes ?? []).length > 1 && (
                      <span className="text-[11.5px] font-public-sans text-muted-text">
                        {v.attributes!.map((a) => `${a.name}: ${a.value}`).join(', ')}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>

        {/* Right column */}
        <div className="space-y-5">
          <div className="bg-surface border border-border-warm rounded p-5 space-y-2">
            <p className="text-[11px] font-[600] font-public-sans text-muted-text uppercase tracking-[0.06em]">Timeline</p>
            <p className="text-[13px] font-public-sans text-primary">
              Created {new Date(product.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
            <p className="text-[13px] font-public-sans text-muted-text">
              Updated {new Date(product.updatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          </div>
        </div>
      </div>
      {lightboxNode}
    </div>
  )
}
