'use client'

import { useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Package, Star, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react'
import {
  useAdminProduct,
  useApproveProduct,
  useRejectProduct,
  useSetAdminPrice,
  useReassignProductCategory,
  usePublishProduct,
  useUnpublishProduct,
  useFeatureProduct,
  useUnfeatureProduct,
} from '@/hooks/queries/useProducts'
import { useAdminCategoryTree } from '@/hooks/queries/useCategories'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { useImageLightbox } from '@/components/shared/ImageLightbox'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { cn, formatINR } from '@/lib/utils'
import type { AdminProduct, CategoryNode } from '@/types'

// ─── Category flattening (leaf nodes only) ─────────────────────────────────────

interface FlatCategory {
  id: string
  label: string
}

function flattenLeaves(nodes: CategoryNode[], trail: string[] = []): FlatCategory[] {
  return nodes.flatMap((node) => {
    const path = [...trail, node.name]
    if (!node.children || node.children.length === 0) {
      return [{ id: node.id, label: path.join(' / ') }]
    }
    return flattenLeaves(node.children, path)
  })
}

// ─── Small presentational helpers ──────────────────────────────────────────────

function Section({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('bg-surface border border-border-warm rounded overflow-hidden', className)}>
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

// ─── Approve dialog ─────────────────────────────────────────────────────────────

function ApproveDialog({ product, onClose }: { product: AdminProduct; onClose: () => void }) {
  const approveProduct = useApproveProduct()
  const [priceInput, setPriceInput] = useState(product.adminPrice != null ? String(product.adminPrice) : '')

  const priceNum = Number(priceInput)
  const isValid = priceInput.trim() !== '' && !Number.isNaN(priceNum) && priceNum > 0
  const atOrBelowSellerPrice = isValid && priceNum <= product.sellerPrice

  function handleSubmit() {
    if (!isValid) return
    approveProduct.mutate({ id: product.id, adminPrice: priceNum }, { onSuccess: onClose })
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Approve &quot;{product.name}&quot;</DialogTitle>
          <DialogDescription>
            Approval and pricing happen together — set the admin selling price to approve and publish this product.
          </DialogDescription>
        </DialogHeader>
        <div className="px-6 pb-2 space-y-4">
          <div className="flex items-center justify-between text-[13px] font-public-sans">
            <span className="text-muted-text">Seller price</span>
            <span className="text-primary font-[600]">{formatINR(product.sellerPrice)}</span>
          </div>
          <div>
            <label className="block text-[12px] font-[600] font-public-sans text-muted-text uppercase tracking-[0.05em] mb-1.5">
              Admin selling price <span className="text-error">*</span>
            </label>
            <input
              type="number"
              min={1}
              value={priceInput}
              onChange={(e) => setPriceInput(e.target.value)}
              placeholder="e.g. 1500"
              autoFocus
              className="w-full h-10 px-3 rounded border border-border-warm bg-muted-bg/30 text-[14px] font-public-sans text-primary placeholder:text-muted-text/40 focus:outline-none focus:border-accent transition-colors"
            />
            {atOrBelowSellerPrice && (
              <p className="text-[12px] font-public-sans text-warning mt-1.5">
                This is at or below the seller&apos;s price of {formatINR(product.sellerPrice)} — double check before approving.
              </p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button variant="primary" size="sm" disabled={!isValid || approveProduct.isPending} onClick={handleSubmit}>
            {approveProduct.isPending ? 'Approving…' : 'Approve & Publish'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Reject dialog ──────────────────────────────────────────────────────────────

function RejectDialog({ product, onClose }: { product: AdminProduct; onClose: () => void }) {
  const rejectProduct = useRejectProduct()
  const [reason, setReason] = useState('')
  const isValid = reason.trim().length > 0

  function handleSubmit() {
    if (!isValid) return
    rejectProduct.mutate({ id: product.id, reason: reason.trim() }, { onSuccess: onClose })
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject &quot;{product.name}&quot;</DialogTitle>
          <DialogDescription>The seller will see this reason on their listing.</DialogDescription>
        </DialogHeader>
        <div className="px-6 pb-2">
          <label className="block text-[12px] font-[600] font-public-sans text-muted-text uppercase tracking-[0.05em] mb-1.5">
            Reason <span className="text-error">*</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            placeholder="Explain what needs to change before this can be approved…"
            autoFocus
            className="w-full px-3 py-2 rounded border border-border-warm bg-muted-bg/30 text-[14px] font-public-sans text-primary placeholder:text-muted-text/40 focus:outline-none focus:border-accent transition-colors resize-none"
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" size="sm" disabled={!isValid || rejectProduct.isPending} onClick={handleSubmit}>
            {rejectProduct.isPending ? 'Rejecting…' : 'Confirm Reject'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Update price mini-form ─────────────────────────────────────────────────────

function UpdatePriceCard({ product }: { product: AdminProduct }) {
  const setAdminPrice = useSetAdminPrice()
  const [priceInput, setPriceInput] = useState(product.adminPrice != null ? String(product.adminPrice) : '')

  const priceNum = Number(priceInput)
  const isValid = priceInput.trim() !== '' && !Number.isNaN(priceNum) && priceNum > 0
  const unchanged = isValid && priceNum === product.adminPrice

  return (
    <div className="space-y-2">
      <p className="text-[12px] font-[600] font-public-sans text-muted-text uppercase tracking-[0.06em]">Admin selling price</p>
      <div className="flex gap-2">
        <input
          type="number"
          min={1}
          value={priceInput}
          onChange={(e) => setPriceInput(e.target.value)}
          className="flex-1 h-9 px-3 rounded border border-border-warm bg-muted-bg/30 text-[13px] font-public-sans text-primary focus:outline-none focus:border-accent transition-colors"
        />
        <Button
          variant="ghost"
          size="sm"
          disabled={!isValid || unchanged || setAdminPrice.isPending}
          onClick={() => setAdminPrice.mutate({ id: product.id, adminPrice: priceNum })}
        >
          {setAdminPrice.isPending ? 'Saving…' : 'Update'}
        </Button>
      </div>
      <p className="text-[11px] font-public-sans text-muted-text">Seller price: {formatINR(product.sellerPrice)}</p>
    </div>
  )
}

// ─── Reassign category control ─────────────────────────────────────────────────

function ReassignCategoryCard({ product, categories }: { product: AdminProduct; categories: FlatCategory[] }) {
  const reassignCategory = useReassignProductCategory()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const currentLabel = categories.find((c) => c.id === product.categoryId)?.label ?? product.categoryId

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return categories
    return categories.filter((c) => c.label.toLowerCase().includes(q))
  }, [categories, query])

  function handleSelect(id: string) {
    if (id === product.categoryId) {
      setOpen(false)
      return
    }
    reassignCategory.mutate({ id: product.id, categoryId: id }, { onSuccess: () => setOpen(false) })
  }

  return (
    <div className="space-y-2">
      <p className="text-[12px] font-[600] font-public-sans text-muted-text uppercase tracking-[0.06em]">Category</p>
      <p className="text-[13.5px] font-public-sans text-primary">{currentLabel}</p>
      {!open ? (
        <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>Reassign category</Button>
      ) : (
        <div className="space-y-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search categories…"
            autoFocus
            className="w-full h-9 px-3 rounded border border-border-warm bg-muted-bg/30 text-[13px] font-public-sans text-primary placeholder:text-muted-text/40 focus:outline-none focus:border-accent transition-colors"
          />
          <div className="max-h-[220px] overflow-y-auto border border-border-warm rounded divide-y divide-border-warm">
            {filtered.length === 0 ? (
              <p className="text-[12px] font-public-sans text-muted-text p-3">No matching categories.</p>
            ) : (
              filtered.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleSelect(c.id)}
                  disabled={reassignCategory.isPending}
                  className={cn(
                    'w-full text-left px-3 py-2 text-[12.5px] font-public-sans hover:bg-muted-bg/50 transition-colors disabled:opacity-50',
                    c.id === product.categoryId ? 'text-accent font-[600]' : 'text-primary'
                  )}
                >
                  {c.label}
                </button>
              ))
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={() => { setOpen(false); setQuery('') }}>Cancel</Button>
        </div>
      )}
    </div>
  )
}

// ─── Page ───────────────────────────────────────────────────────────────────────

export default function AdminProductDetailPage() {
  const params = useParams<{ id: string }>()
  const { data: product, isLoading, isError } = useAdminProduct(params.id)
  const { data: tree = [] } = useAdminCategoryTree()

  const [dialog, setDialog] = useState<'approve' | 'reject' | null>(null)

  const publishProduct = usePublishProduct()
  const unpublishProduct = useUnpublishProduct()
  const featureProduct = useFeatureProduct()
  const unfeatureProduct = useUnfeatureProduct()

  const leafCategories = useMemo(() => flattenLeaves(tree), [tree])

  const sortedImages = useMemo(
    () => (product ? [...product.images].sort((a, b) => a.sortOrder - b.sortOrder) : []),
    [product]
  )
  const [activeImage, setActiveImage] = useState(0)
  const { openLightbox, lightboxNode } = useImageLightbox()

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
  const categoryLabel = leafCategories.find((c) => c.id === product.categoryId)?.label

  return (
    <div className="max-w-5xl mx-auto">
      {/* Back */}
      <Link href="/admin/products" className="flex items-center gap-1.5 text-[13px] font-public-sans text-muted-text hover:text-primary transition-colors mb-6">
        <ArrowLeft size={14} aria-hidden="true" /> Back to Products
      </Link>

      {/* Header */}
      <div className="mb-5">
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
        </div>
        <h1 className="text-[28px] leading-[1.3] font-[500] font-playfair text-primary">{product.name}</h1>
        <p className="text-[13px] font-public-sans text-muted-text mt-1">/{product.slug}</p>
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
              src={sortedImages[Math.min(activeImage, sortedImages.length - 1)].url}
              alt={product.name}
              className="w-full h-full object-cover"
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
                    'w-16 h-16 rounded overflow-hidden border-2 shrink-0 transition-colors',
                    i === activeImage ? 'border-accent' : 'border-border-warm opacity-70 hover:opacity-100'
                  )}
                >
                  <img src={img.url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
        {/* Left column */}
        <div className="space-y-5 min-w-0">
          <Section title="Pricing">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Seller Price" value={formatINR(product.sellerPrice)} />
              <Field
                label="Admin Price"
                value={product.adminPrice != null ? formatINR(product.adminPrice) : <span className="italic text-muted-text">not set</span>}
              />
            </div>
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
              <Field label="Declared Stock" value={product.declaredStock} />
              <Field label="Lead Time" value={product.leadTime ?? '—'} />
              <Field label="Category" value={categoryLabel ?? `${product.categoryId} (unresolved)`} />
              <Field label="Certifications" value={product.certifications ?? '—'} />
            </div>
          </Section>

          <Section title="Variants">
            {product.variants.length === 0 ? (
              <p className="text-[13px] font-public-sans text-muted-text">No variants.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {product.variants.map((v) => (
                  <span
                    key={v.id}
                    className="text-[12.5px] font-public-sans text-primary bg-muted-bg border border-border-warm px-3 py-1.5 rounded"
                  >
                    <span className="text-muted-text">{v.type}:</span> {v.value}
                  </span>
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

          {needsReview && (
            <div className="bg-surface border border-border-warm rounded p-5 space-y-3">
              <p className="text-[12px] font-[600] font-public-sans text-muted-text uppercase tracking-[0.06em]">Review</p>
              <div className="flex flex-col gap-2">
                <Button variant="primary" size="sm" onClick={() => setDialog('approve')}>
                  Approve
                </Button>
                <Button variant="destructive" size="sm" onClick={() => setDialog('reject')}>
                  Reject
                </Button>
              </div>
            </div>
          )}

          {isApproved && (
            <>
              <div className="bg-surface border border-border-warm rounded p-5 space-y-4">
                <p className="text-[12px] font-[600] font-public-sans text-muted-text uppercase tracking-[0.06em]">Publishing</p>
                <div className="flex flex-wrap gap-2">
                  {product.isPublished ? (
                    <Button variant="ghost" size="sm" disabled={unpublishProduct.isPending} onClick={() => unpublishProduct.mutate(product.id)}>
                      {unpublishProduct.isPending ? 'Unpublishing…' : 'Unpublish'}
                    </Button>
                  ) : (
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={product.adminPrice == null || publishProduct.isPending}
                      title={product.adminPrice == null ? 'Set an admin price before publishing' : undefined}
                      onClick={() => publishProduct.mutate(product.id)}
                    >
                      {publishProduct.isPending ? 'Publishing…' : 'Publish'}
                    </Button>
                  )}
                  {product.isFeatured ? (
                    <Button variant="ghost" size="sm" disabled={unfeatureProduct.isPending} onClick={() => unfeatureProduct.mutate(product.id)}>
                      {unfeatureProduct.isPending ? 'Removing…' : 'Unfeature'}
                    </Button>
                  ) : (
                    <Button variant="ghost" size="sm" disabled={featureProduct.isPending} onClick={() => featureProduct.mutate(product.id)}>
                      {featureProduct.isPending ? 'Featuring…' : 'Feature'}
                    </Button>
                  )}
                </div>
                {product.adminPrice == null && !product.isPublished && (
                  <p className="text-[11px] font-public-sans text-warning">Set an admin price below before publishing.</p>
                )}
              </div>

              <div className="bg-surface border border-border-warm rounded p-5">
                <UpdatePriceCard product={product} />
              </div>

              <div className="bg-surface border border-border-warm rounded p-5">
                <ReassignCategoryCard product={product} categories={leafCategories} />
              </div>
            </>
          )}
        </div>
      </div>

      {dialog === 'approve' && <ApproveDialog product={product} onClose={() => setDialog(null)} />}
      {dialog === 'reject' && <RejectDialog product={product} onClose={() => setDialog(null)} />}
      {lightboxNode}
    </div>
  )
}
