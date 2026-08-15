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
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  FlatCategory,
  Section,
  TierPriceTable,
  collectAllTiers,
  flattenLeaves,
  useTierPriceForm,
} from '@/components/admin/ProductAdminShared'
import { cn } from '@/lib/utils'
import type { AdminProduct } from '@/types'

// ─── Approve dialog ─────────────────────────────────────────────────────────────

function ApproveDialog({ product, onClose }: { product: AdminProduct; onClose: () => void }) {
  const approveProduct = useApproveProduct()
  const { allTiers, values, setValue, buildPayload, hasAnyPriced } = useTierPriceForm(product)

  function handleSubmit() {
    if (!hasAnyPriced) return
    approveProduct.mutate({ id: product.id, ...buildPayload() }, { onSuccess: onClose })
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Approve &quot;{product.name}&quot;</DialogTitle>
          <DialogDescription>
            Set your selling price for at least one MOQ tier to approve and publish this product.
          </DialogDescription>
        </DialogHeader>
        <div className="px-6 pb-2 max-h-[50vh] overflow-y-auto">
          <TierPriceTable tiers={allTiers} values={values} onChange={setValue} editable disabled={approveProduct.isPending} />
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button variant="primary" size="sm" disabled={!hasAnyPriced || approveProduct.isPending} onClick={handleSubmit}>
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

// ─── Admin pricing card (post-approval tier price editing) ─────────────────────

function AdminPricingCard({ product }: { product: AdminProduct }) {
  const setAdminPrice = useSetAdminPrice()
  const { allTiers, values, setValue, buildPayload, hasAnyPriced } = useTierPriceForm(product)

  return (
    <div className="space-y-3">
      <p className="text-[12px] font-[600] font-public-sans text-muted-text uppercase tracking-[0.06em]">Admin Pricing</p>
      <TierPriceTable tiers={allTiers} values={values} onChange={setValue} editable disabled={setAdminPrice.isPending} />
      <Button
        variant="ghost"
        size="sm"
        disabled={!hasAnyPriced || setAdminPrice.isPending}
        onClick={() => setAdminPrice.mutate({ id: product.id, ...buildPayload() })}
      >
        {setAdminPrice.isPending ? 'Saving…' : 'Update Prices'}
      </Button>
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

export default function AdminProductEditPage() {
  const params = useParams<{ id: string }>()
  const { data: product, isLoading, isError } = useAdminProduct(params.id)
  const { data: tree = [] } = useAdminCategoryTree()

  const [dialog, setDialog] = useState<'approve' | 'reject' | null>(null)

  const publishProduct = usePublishProduct()
  const unpublishProduct = useUnpublishProduct()
  const featureProduct = useFeatureProduct()
  const unfeatureProduct = useUnfeatureProduct()

  const leafCategories = useMemo(() => flattenLeaves(tree), [tree])
  const allTiers = useMemo(() => (product ? collectAllTiers(product) : []), [product])

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto animate-pulse space-y-5">
        <div className="h-5 bg-muted-bg rounded w-24" />
        <div className="h-40 bg-muted-bg rounded" />
        <div className="h-40 bg-muted-bg rounded" />
      </div>
    )
  }

  if (!product) {
    return (
      <div className="max-w-3xl mx-auto">
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

  return (
    <div className="max-w-3xl mx-auto">
      {/* Back to the read-only detail page */}
      <Link href={`/admin/products/${product.id}`} className="flex items-center gap-1.5 text-[13px] font-public-sans text-muted-text hover:text-primary transition-colors mb-6">
        <ArrowLeft size={14} aria-hidden="true" /> Back to {product.name}
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
        <h1 className="text-[24px] leading-[1.3] font-[500] font-playfair text-primary">{product.name}</h1>
      </div>

      {product.approvalStatus === 'REJECTED' && product.rejectionReason && (
        <div className="mb-5 flex items-start gap-3 bg-error/[6%] border border-error/30 rounded p-4">
          <AlertTriangle size={16} className="text-error shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <p className="text-[13px] font-[600] font-public-sans text-error">Rejection reason</p>
            <p className="text-[13px] font-public-sans text-primary mt-1 whitespace-pre-wrap">{product.rejectionReason}</p>
          </div>
        </div>
      )}

      <div className="space-y-5">
        <Section title="Seller Price Tiers">
          <TierPriceTable tiers={allTiers} />
        </Section>

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
              <AdminPricingCard product={product} />
            </div>

            <div className="bg-surface border border-border-warm rounded p-5">
              <ReassignCategoryCard product={product} categories={leafCategories} />
            </div>
          </>
        )}
      </div>

      {dialog === 'approve' && <ApproveDialog product={product} onClose={() => setDialog(null)} />}
      {dialog === 'reject' && <RejectDialog product={product} onClose={() => setDialog(null)} />}
    </div>
  )
}
