'use client'

import { use, useMemo } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, AlertTriangle, Clock, CheckCircle2, XCircle, Hammer, Leaf, Tag, Layers,
} from 'lucide-react'
import { useMyProduct } from '@/hooks/queries/useProducts'
import { useCategoryTree } from '@/hooks/queries/useCategories'
import { categoryPathLabel } from '@/components/seller-portal/CategoryCascade'
import { ApprovalStatusBadge } from '@/components/seller-portal/StatusBadges'
import { PhotoGallery } from '@/components/pdp/PhotoGallery'
import { ProductVideoStrip } from '@/components/pdp/ProductVideoStrip'
import { Badge, type BadgeProps } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { cn, formatINR } from '@/lib/utils'
import { cloudinaryFit } from '@/lib/cloudinaryImage'
import type { MyProduct, ProductPriceTier, VariantStatus } from '@/types'

function SectionCard({
  title,
  icon: Icon,
  children,
}: {
  title: string
  icon?: React.ComponentType<{ size?: number; className?: string; 'aria-hidden'?: boolean }>
  children: React.ReactNode
}) {
  return (
    <div className="bg-white border border-[#E5E1D8] rounded-xl overflow-hidden">
      <div className="px-5 py-3.5 border-b border-[#E5E1D8] bg-[#F9F7F2] flex items-center gap-2">
        {Icon && <Icon size={13} className="text-[#C4BDB4]" aria-hidden={true} />}
        <h3 className="text-[11px] font-[700] font-sans text-[#9CA3AF] uppercase tracking-[0.07em]">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

function Field({ label, value }: { label: string; value?: React.ReactNode }) {
  if (value === undefined || value === null || value === '') return null
  return (
    <div>
      <p className="text-[11px] font-[700] font-sans text-[#9CA3AF] uppercase tracking-[0.06em] mb-0.5">{label}</p>
      <div className="text-[13.5px] font-sans text-[#1A1A1A] leading-[1.5] whitespace-pre-wrap break-words">{value}</div>
    </div>
  )
}

const VARIANT_STATUS_CONFIG: Record<VariantStatus, { label: string; variant: NonNullable<BadgeProps['variant']> }> = {
  ACTIVE: { label: 'Active', variant: 'success' },
  INACTIVE: { label: 'Hidden', variant: 'default' },
  OUT_OF_STOCK: { label: 'Out of stock', variant: 'warning' },
}

function VariantStatusPill({ status }: { status?: VariantStatus }) {
  const config = VARIANT_STATUS_CONFIG[status ?? 'ACTIVE']
  return <Badge variant={config.variant}>{config.label}</Badge>
}

function variantAttrs(v: MyProduct['variants'][number]) {
  return v.attributes?.length ? v.attributes : [{ name: v.type, value: v.value }]
}

function priceTierLadder(tiers?: ProductPriceTier[]): string {
  if (!tiers || tiers.length === 0) return '—'
  return [...tiers]
    .sort((a, b) => a.moq - b.moq)
    .map((t) => `${t.moq}+: ${formatINR(t.sellerPrice)}`)
    .join(' · ')
}

function FlatTierTable({ tiers }: { tiers: ProductPriceTier[] }) {
  if (tiers.length === 0) return <p className="text-[13px] font-sans text-[#6B6460]">No price tiers set.</p>
  const sorted = [...tiers].sort((a, b) => a.moq - b.moq)
  return (
    <div className="rounded-lg border border-[#E5E1D8] overflow-hidden">
      <table className="w-full text-[13px] font-sans">
        <thead>
          <tr className="bg-[#F9F7F2] border-b border-[#E5E1D8]">
            <th className="text-left py-2.5 px-4 font-[700] text-[#9CA3AF] text-[11px] uppercase tracking-[0.06em]">MOQ</th>
            <th className="text-left py-2.5 px-4 font-[700] text-[#9CA3AF] text-[11px] uppercase tracking-[0.06em]">Price per unit</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#F5F0E8]">
          {sorted.map((t, i) => (
            <tr key={t.id ?? i}>
              <td className="px-4 py-2.5 text-[#6B6460]">{t.moq}+ units</td>
              <td className="px-4 py-2.5 text-[#1A1A1A] font-[600]">{formatINR(t.sellerPrice)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function VariantsTable({ variants }: { variants: MyProduct['variants'] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[920px] text-[12.5px] font-sans">
        <thead>
          <tr className="bg-[#F9F7F2] border-b border-[#E5E1D8]">
            {['Photo', 'Option', 'SKU', 'Price ladder', 'Inventory', 'Weight', 'Dimensions', 'Tariff code', 'Status'].map((col) => (
              <th key={col} className="text-left py-2.5 px-3 font-[700] text-[#9CA3AF] text-[11px] uppercase tracking-[0.06em] whitespace-nowrap">{col}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#F5F0E8]">
          {variants.map((v) => {
            const label = variantAttrs(v).map((a) => a.value).join(' / ')
            const weight = v.weight != null ? `${v.weight} ${v.weightUnit ?? 'kg'}` : '—'
            const dims = v.length != null || v.width != null || v.height != null
              ? `${v.length ?? 0} × ${v.width ?? 0} × ${v.height ?? 0} ${v.dimensionUnit ?? 'cm'}`
              : '—'
            return (
              <tr key={v.id} className="hover:bg-[#FDFCF9] transition-colors">
                <td className="px-3 py-3">
                  {v.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={cloudinaryFit(v.imageUrl, 80)} alt="" className="w-9 h-9 rounded-lg object-cover border border-[#E5E1D8]" />
                  ) : (
                    <div className="w-9 h-9 rounded-lg bg-[#F5F0E8] border border-[#E5E1D8]" />
                  )}
                </td>
                <td className="px-3 py-3 text-[#1A1A1A] font-[600] whitespace-nowrap">{label || '—'}</td>
                <td className="px-3 py-3 text-[#6B6460] whitespace-nowrap">{v.sku || '—'}</td>
                <td className="px-3 py-3 text-[#1A1A1A] whitespace-nowrap">{priceTierLadder(v.priceTiers)}</td>
                <td className="px-3 py-3 text-[#1A1A1A] tabular-nums">{v.inventory ?? '—'}</td>
                <td className="px-3 py-3 text-[#6B6460] whitespace-nowrap">{weight}</td>
                <td className="px-3 py-3 text-[#6B6460] whitespace-nowrap">{dims}</td>
                <td className="px-3 py-3 text-[#6B6460] whitespace-nowrap">{v.tariffCode || '—'}</td>
                <td className="px-3 py-3"><VariantStatusPill status={v.status} /></td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function PendingChangeCard({ change }: { change: NonNullable<MyProduct['pendingPricingChange']> }) {
  return (
    <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
      <Clock size={16} className="text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
      <div className="flex-1 min-w-0 space-y-3">
        <div>
          <p className="text-[13px] font-[600] font-sans text-[#1A1A1A]">Pricing update awaiting admin review</p>
          <p className="text-[12px] font-sans text-[#6B6460] mt-0.5">
            Submitted{' '}
            {new Date(change.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            {' '}— buyers still see the current pricing below until this is approved.
          </p>
        </div>
        {change.proposedVariants.length > 0 ? (
          <div className="space-y-1.5">
            {change.proposedVariants.map((v, i) => {
              const attrs = v.attributes?.length ? v.attributes : [{ name: v.type, value: v.value }]
              return (
                <div key={i} className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 text-[12.5px] font-sans">
                  <span className="font-[600] text-[#1A1A1A]">{attrs.map((a) => a.value).join(' / ')}</span>
                  {v.sku && <span className="text-[#6B6460]">SKU: {v.sku}</span>}
                  <span className="text-[#1A1A1A]">{priceTierLadder(v.priceTiers)}</span>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="space-y-1">
            <p className="text-[12.5px] font-sans text-[#1A1A1A]">Proposed MOQ: {change.proposedMoq}</p>
            {change.proposedPriceTiers.map((t, i) => (
              <p key={i} className="text-[12.5px] font-sans text-[#1A1A1A]">
                {t.moq}+ units — {formatINR(t.sellerPrice)}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data: product, isLoading, error } = useMyProduct(id)
  const { data: tree = [] } = useCategoryTree()

  const sortedImageUrls = useMemo(
    () => (product ? [...product.images].sort((a, b) => a.sortOrder - b.sortOrder).map((img) => img.url) : []),
    [product]
  )
  const sortedVideos = useMemo(
    () => (product ? [...product.videos].sort((a, b) => a.sortOrder - b.sortOrder) : []),
    [product]
  )
  const ecoTags = useMemo(
    () => (product ? [...product.ecoMaterials, ...product.ecoPackaging, ...product.ecoProduction] : []),
    [product]
  )

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/portal/products"
            className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-[#E5E1D8] text-[#C4BDB4] hover:text-[#1A1A1A] hover:bg-[#F5F0E8] transition-colors shrink-0"
            aria-label="Back to products"
          >
            <ArrowLeft size={15} />
          </Link>
          <h1 className="text-[24px] font-[700] font-sans text-[#1A1A1A] leading-tight truncate">
            {product?.name ?? 'Product'}
          </h1>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {product?.isPublished && product.approvalStatus === 'APPROVED' && (
            <Link
              href={`/products/${product.slug}`}
              target="_blank"
              className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}
            >
              View live
            </Link>
          )}
          <Link href={`/portal/products/${id}/edit`} className={cn(buttonVariants({ variant: 'primary', size: 'sm' }))}>
            Edit
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4 animate-pulse">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 bg-white border border-[#E5E1D8] rounded-xl" />
          ))}
        </div>
      ) : error || !product ? (
        <p className="text-[14px] font-sans text-red-500">Could not load this product.</p>
      ) : (
        <div className="space-y-5">
          {/* Status row */}
          <div className="flex flex-wrap items-center gap-2">
            <ApprovalStatusBadge status={product.approvalStatus} />
            {product.isPublished ? (
              <span className="inline-flex items-center gap-1 text-[12px] font-[600] font-sans text-emerald-600">
                <CheckCircle2 size={12} aria-hidden="true" /> Published
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[12px] font-[600] font-sans text-[#9CA3AF]">
                <XCircle size={12} aria-hidden="true" /> Unpublished
              </span>
            )}
            {product.isBestseller && <Badge variant="accent">Bestseller</Badge>}
            {product.isHandmade && <Badge variant="primary">Handmade</Badge>}
            {product.isGITagged && <Badge variant="primary">GI Tagged</Badge>}
          </div>

          {product.approvalStatus === 'REJECTED' && product.rejectionReason && (
            <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
              <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <p className="text-[13px] font-[600] font-sans text-red-700">Rejection reason</p>
                <p className="text-[13px] font-sans text-[#1A1A1A] mt-1 whitespace-pre-wrap">{product.rejectionReason}</p>
              </div>
            </div>
          )}

          {product.pendingPricingChange && <PendingChangeCard change={product.pendingPricingChange} />}

          {/* Media */}
          <div className="bg-white border border-[#E5E1D8] rounded-xl p-5">
            <PhotoGallery images={sortedImageUrls} productName={product.name} />
            <ProductVideoStrip videos={sortedVideos} productName={product.name} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5">
            {/* Left column */}
            <div className="space-y-5 min-w-0">
              <SectionCard title="Pricing & Variants" icon={Layers}>
                {product.variants.length > 0 ? (
                  <VariantsTable variants={product.variants} />
                ) : (
                  <FlatTierTable tiers={product.priceTiers} />
                )}
              </SectionCard>

              <SectionCard title="Description">
                <p className="text-[13.5px] font-sans text-[#1A1A1A] leading-[1.7] whitespace-pre-wrap break-words">
                  {product.description}
                </p>
              </SectionCard>

              <SectionCard title="Materials & Sourcing" icon={Leaf}>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Materials" value={product.materials} />
                  <Field label="Place of Origin" value={product.placeOfOrigin ?? '—'} />
                  <Field label="Handmade" value={product.isHandmade ? 'Yes' : 'No'} />
                  <Field label="GI Tagged" value={product.isGITagged ? 'Yes' : 'No'} />
                </div>
                {ecoTags.length > 0 && (
                  <div className="mt-4">
                    <p className="text-[11px] font-[700] font-sans text-[#9CA3AF] uppercase tracking-[0.06em] mb-1.5">
                      Eco attributes
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {ecoTags.map((tag) => (
                        <Badge key={tag} variant="success">{tag}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </SectionCard>

              {(product.howItIsMade || product.artisanName) && (
                <SectionCard title="Craft Story" icon={Hammer}>
                  <div className="space-y-4">
                    <Field label="Artisan Name" value={product.artisanName ?? '—'} />
                    <Field label="How It's Made" value={product.howItIsMade ?? '—'} />
                  </div>
                </SectionCard>
              )}

              {product.variants.length === 0 && (product.dimensions || product.weight != null) && (
                <SectionCard title="Shipping">
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Weight" value={product.weight != null ? `${product.weight} kg` : '—'} />
                    <Field label="Dimensions" value={product.dimensions ?? '—'} />
                  </div>
                </SectionCard>
              )}

              {product.tags.length > 0 && (
                <SectionCard title="Tags" icon={Tag}>
                  <div className="flex flex-wrap gap-1.5">
                    {product.tags.map((t) => <Badge key={t}>{t}</Badge>)}
                  </div>
                </SectionCard>
              )}
            </div>

            {/* Right column */}
            <div className="space-y-5">
              <div className="bg-white border border-[#E5E1D8] rounded-xl p-5 space-y-4">
                <div>
                  <p className="text-[11px] font-[700] font-sans text-[#9CA3AF] uppercase tracking-[0.06em] mb-1">
                    Price{product.variants.length > 0 ? ' (from)' : ''}
                  </p>
                  <p className="text-[22px] font-[700] font-sans text-[#1A1A1A]">{formatINR(product.sellerPrice)}</p>
                </div>
                <Field label="MOQ" value={`${product.moq} units`} />
                <Field label="Order Step" value={product.stepQty} />
                <Field label="Declared Stock" value={`${product.declaredStock} units`} />
                <Field label="Lead Time" value={product.leadTime ?? '—'} />
                <Field label="Category" value={categoryPathLabel(tree, product.categoryId)} />
                <Field label="Tariff / HS code" value={product.tariffCode ?? '—'} />
              </div>

              <div className="bg-white border border-[#E5E1D8] rounded-xl p-5 space-y-2">
                <p className="text-[11px] font-[700] font-sans text-[#9CA3AF] uppercase tracking-[0.06em]">Timeline</p>
                <p className="text-[13px] font-sans text-[#1A1A1A]">
                  Created {new Date(product.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
                <p className="text-[13px] font-sans text-[#6B6460]">
                  Updated {new Date(product.updatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
