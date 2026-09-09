'use client'

import { use, useMemo } from 'react'
import Link from 'next/link'
import { ArrowLeft, AlertTriangle } from 'lucide-react'
import { useMyProduct } from '@/hooks/queries/useProducts'
import { useCategoryTree } from '@/hooks/queries/useCategories'
import { categoryPathLabel } from '@/components/seller-portal/CategoryCascade'
import { ApprovalStatusBadge } from '@/components/seller-portal/StatusBadges'
import { useImageLightbox } from '@/components/shared/ImageLightbox'
import { buttonVariants } from '@/components/ui/button'
import { cn, formatINR } from '@/lib/utils'
import type { MyProduct, ProductPriceTier } from '@/types'

// ─── Small presentational helpers ──────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface border border-border-warm rounded overflow-hidden">
      <div className="px-5 py-3 border-b border-border-warm bg-muted-bg/40">
        <h3 className="text-[12px] font-[600] font-public-sans text-muted-text uppercase tracking-[0.06em]">{title}</h3>
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </div>
  )
}

function Field({ label, value }: { label: string; value?: React.ReactNode }) {
  if (value === undefined || value === null || value === '') return null
  return (
    <div>
      <p className="text-[11px] font-[600] font-public-sans text-muted-text uppercase tracking-[0.06em] mb-0.5">{label}</p>
      <div className="text-[13.5px] font-public-sans text-primary leading-[1.5] whitespace-pre-wrap break-words">{value}</div>
    </div>
  )
}

// ─── Price tiers, grouped by variant when the product has any ─────────────────

interface TierRow {
  key: string
  groupLabel: string | null
  tier: ProductPriceTier
}

function collectAllTiers(product: MyProduct): TierRow[] {
  if (product.variants.length === 0) {
    return product.priceTiers.map((t, i) => ({ key: t.id ?? `flat-${i}`, groupLabel: null, tier: t }))
  }
  return product.variants.flatMap((v) =>
    (v.priceTiers ?? []).map((t, i) => ({ key: t.id ?? `${v.id}-${i}`, groupLabel: `${v.type}: ${v.value}`, tier: t }))
  )
}

function PriceTierTable({ tiers }: { tiers: TierRow[] }) {
  const groups = useMemo(() => {
    const map = new Map<string | null, TierRow[]>()
    for (const row of tiers) {
      const arr = map.get(row.groupLabel) ?? []
      arr.push(row)
      map.set(row.groupLabel, arr)
    }
    return Array.from(map.entries())
  }, [tiers])

  if (tiers.length === 0) {
    return <p className="text-[13px] font-public-sans text-muted-text">No price tiers set.</p>
  }

  return (
    <div className="space-y-4">
      {groups.map(([label, groupTiers]) => (
        <div key={label ?? 'flat'} className="space-y-1.5">
          {label && <p className="text-[12.5px] font-[600] font-public-sans text-primary">{label}</p>}
          <div className="rounded border border-border-warm overflow-hidden">
            <table className="w-full text-[12.5px] font-public-sans">
              <thead>
                <tr className="bg-muted-bg/40 border-b border-border-warm">
                  <th className="text-left py-1.5 px-2.5 font-[600] text-muted-text">MOQ</th>
                  <th className="text-left py-1.5 px-2.5 font-[600] text-muted-text">Price per unit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-warm">
                {groupTiers.map(({ key, tier }) => (
                  <tr key={key}>
                    <td className="px-2.5 py-1.5 text-primary">{tier.moq}</td>
                    <td className="px-2.5 py-1.5 text-primary">{formatINR(tier.sellerPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Page ───────────────────────────────────────────────────────────────────────

export default function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data: product, isLoading, error } = useMyProduct(id)
  const { data: tree = [] } = useCategoryTree()
  const { openLightbox, lightboxNode } = useImageLightbox()

  const allTiers = useMemo(() => (product ? collectAllTiers(product) : []), [product])

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-8">
        <div className="flex items-center gap-3">
          <Link
            href="/portal/products"
            className="inline-flex items-center justify-center w-8 h-8 rounded border border-border-warm text-muted-text hover:text-primary hover:bg-muted-bg transition-colors"
            aria-label="Back to products"
          >
            <ArrowLeft size={15} />
          </Link>
          <h1 className="text-[24px] leading-[1.3] font-[500] font-playfair text-primary">
            {product?.name ?? 'Product'}
          </h1>
        </div>
        <Link href={`/portal/products/${id}/edit`} className={cn(buttonVariants({ variant: 'primary', size: 'sm' }))}>
          Edit
        </Link>
      </div>

      {isLoading ? (
        <div className="max-w-3xl space-y-4 animate-pulse">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 bg-muted-bg rounded" />
          ))}
        </div>
      ) : error || !product ? (
        <p className="text-[14px] font-public-sans text-error">Could not load this product.</p>
      ) : (
        <div className="max-w-3xl space-y-5">
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-[600] font-public-sans text-muted-text uppercase tracking-[0.05em]">Status</span>
            <ApprovalStatusBadge status={product.approvalStatus} />
          </div>

          {product.approvalStatus === 'REJECTED' && product.rejectionReason && (
            <div className="flex items-start gap-3 bg-error/[6%] border border-error/30 rounded p-4">
              <AlertTriangle size={16} className="text-error shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <p className="text-[13px] font-[600] font-public-sans text-error">Rejection reason</p>
                <p className="text-[13px] font-public-sans text-primary mt-1 whitespace-pre-wrap">{product.rejectionReason}</p>
              </div>
            </div>
          )}

          {product.pendingPricingChange && (
            <div className="flex items-start gap-3 bg-muted-bg/60 border border-border-warm rounded p-4">
              <AlertTriangle size={16} className="text-accent shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <p className="text-[13px] font-[600] font-public-sans text-primary">Pricing change awaiting review</p>
                <p className="text-[13px] font-public-sans text-muted-text mt-1">
                  A pricing/variant update for this product is pending admin approval — buyers still see the
                  current pricing shown below until it&apos;s reviewed.
                </p>
              </div>
            </div>
          )}

          {product.images.length > 0 && (
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
              {product.images.map((img, i) => (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => openLightbox(img.url, product.name)}
                  className="relative aspect-square rounded overflow-hidden border border-border-warm bg-muted-bg cursor-zoom-in"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.url} alt="" className="w-full h-full object-cover" />
                  {i === 0 && (
                    <span className="absolute bottom-1 left-1 text-[10px] font-[600] font-public-sans bg-black/60 text-white px-1.5 py-0.5 rounded">Cover</span>
                  )}
                </button>
              ))}
            </div>
          )}

          <Section title="Description">
            <p className="text-[13.5px] font-public-sans text-primary leading-[1.7] whitespace-pre-wrap break-words">
              {product.description}
            </p>
          </Section>

          <Section title="Price Tiers">
            <PriceTierTable tiers={allTiers} />
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
              <Field label="Category" value={categoryPathLabel(tree, product.categoryId)} />
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
      )}
      {lightboxNode}
    </div>
  )
}
