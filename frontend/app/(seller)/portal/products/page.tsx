'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useMyProducts, useResubmitProduct, useDeleteMyProduct } from '@/hooks/queries/useProducts'
import { useCategoryTree } from '@/hooks/queries/useCategories'
import { categoryPathLabel } from '@/components/seller-portal/CategoryCascade'
import { ApprovalStatusBadge } from '@/components/seller-portal/StatusBadges'
import { useImageLightbox } from '@/components/shared/ImageLightbox'
import type { ApprovalStatus } from '@/types'

type FilterValue = 'All' | ApprovalStatus

const STATUS_FILTERS: { label: string; value: FilterValue }[] = [
  { label: 'All', value: 'All' },
  { label: 'Pending', value: 'PENDING' },
  { label: 'Resubmitted', value: 'RESUBMITTED' },
  { label: 'Approved', value: 'APPROVED' },
  { label: 'Rejected', value: 'REJECTED' },
]

function SkeletonRows() {
  return (
    <div className="bg-surface border border-border-warm rounded overflow-hidden animate-pulse">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-border-warm last:border-0">
          <div className="w-10 h-10 rounded bg-muted-bg shrink-0" />
          <div className="flex-1">
            <div className="h-4 bg-muted-bg rounded w-1/3 mb-1" />
            <div className="h-3 bg-muted-bg rounded w-1/4" />
          </div>
          <div className="h-4 bg-muted-bg rounded w-16" />
          <div className="h-4 bg-muted-bg rounded w-16" />
          <div className="h-5 bg-muted-bg rounded w-20" />
        </div>
      ))}
    </div>
  )
}

const PAGE_LIMIT = 20

export default function ProductsPage() {
  const router = useRouter()
  const [filter, setFilter] = useState<FilterValue>('All')
  const [page, setPage] = useState(1)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const { openLightbox, lightboxNode } = useImageLightbox()

  const { data: tree = [] } = useCategoryTree()
  const { data, isLoading, error } = useMyProducts({
    approvalStatus: filter === 'All' ? undefined : filter,
    page,
    limit: PAGE_LIMIT,
  })
  const resubmit = useResubmitProduct()
  const del = useDeleteMyProduct()

  const products = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_LIMIT))

  function handleFilterChange(value: FilterValue) {
    setFilter(value)
    setPage(1)
  }

  function handleDelete(id: string, name: string) {
    if (!window.confirm(`Remove "${name}"? This can't be undone.`)) return
    setDeletingId(id)
    del.mutate(id, { onSettled: () => setDeletingId(null) })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[24px] leading-[1.3] font-[500] font-playfair text-primary">
          My Products
        </h1>
        <Link href="/portal/products/new" className={cn(buttonVariants({ variant: 'primary', size: 'sm' }), 'gap-1.5')}>
          <Plus size={14} aria-hidden="true" />
          Submit Product
        </Link>
      </div>

      {/* Status filter tabs */}
      <div className="flex items-center gap-1 mb-6 border-b border-border-warm overflow-x-auto">
        {STATUS_FILTERS.map(({ label, value }) => (
          <button
            key={value}
            type="button"
            onClick={() => handleFilterChange(value)}
            className={cn(
              'px-4 py-2.5 text-[14px] font-[600] font-public-sans whitespace-nowrap transition-colors',
              filter === value
                ? 'border-b-2 border-accent text-primary -mb-px'
                : 'text-muted-text hover:text-primary'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <SkeletonRows />
      ) : error ? (
        <div className="py-8 text-center">
          <p className="text-[14px] font-public-sans text-error">Failed to load products.</p>
        </div>
      ) : products.length === 0 ? (
        <div className="py-20 text-center">
          <p className="text-[16px] font-[500] font-public-sans text-primary mb-1">No products yet</p>
          <p className="text-[14px] font-public-sans text-muted-text mb-6">
            Submit your first product for Solomon Bharat&apos;s review.
          </p>
          <Link href="/portal/products/new" className={cn(buttonVariants({ variant: 'primary', size: 'sm' }), 'gap-1.5')}>
            <Plus size={14} aria-hidden="true" />
            Submit Product
          </Link>
        </div>
      ) : (
        <>
          <div className="bg-surface border border-border-warm rounded overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px]">
                <thead>
                  <tr className="border-b border-border-warm">
                    {['', 'Product', 'Category', 'Declared Stock', 'Status', 'Submitted', 'Actions'].map((col) => (
                      <th key={col} className="px-4 py-3 text-left text-[12px] font-[600] font-public-sans text-muted-text uppercase tracking-[0.04em]">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => {
                    const imageUrl = product.images?.[0]?.url ?? null
                    const canEdit = product.approvalStatus !== 'APPROVED'
                    const canResubmit = product.approvalStatus === 'REJECTED'

                    return (
                      <tr key={product.id} className="border-b border-border-warm last:border-0 hover:bg-muted-bg/30 transition-colors">
                        <td className="px-4 py-3">
                          {imageUrl ? (
                            <button
                              type="button"
                              onClick={() => openLightbox(imageUrl, product.name)}
                              className="w-10 h-10 rounded border border-border-warm overflow-hidden bg-muted-bg relative shrink-0 cursor-zoom-in"
                              aria-label={`View ${product.name} full size`}
                            >
                              <Image src={imageUrl} alt="" width={40} height={40} className="object-cover w-full h-full" unoptimized />
                            </button>
                          ) : (
                            <div className="w-10 h-10 rounded border border-border-warm overflow-hidden bg-muted-bg relative shrink-0" />
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => router.push(`/portal/products/${product.id}`)}
                            className="text-[14px] font-[500] font-public-sans text-primary hover:text-accent transition-colors text-left"
                          >
                            {product.name}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-[13px] font-public-sans text-muted-text">
                            {categoryPathLabel(tree, product.categoryId)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="tabular-nums text-[14px] font-public-sans text-muted-text">{product.declaredStock}</span>
                        </td>
                        <td className="px-4 py-3">
                          <ApprovalStatusBadge status={product.approvalStatus} />
                          {product.approvalStatus === 'REJECTED' && product.rejectionReason && (
                            <p className="text-[11px] font-public-sans text-error mt-1 max-w-[220px] leading-snug">
                              {product.rejectionReason}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-muted-text text-[13px] font-public-sans">
                            {new Date(product.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {canEdit && (
                              <Link href={`/portal/products/${product.id}/edit`} className="text-[12px] font-[600] font-public-sans text-accent hover:text-accent-hover underline underline-offset-2 transition-colors">
                                Edit
                              </Link>
                            )}
                            {canResubmit && (
                              <button
                                type="button"
                                disabled={resubmit.isPending}
                                onClick={() => resubmit.mutate(product.id)}
                                className="text-[12px] font-[600] font-public-sans text-muted-text hover:text-primary transition-colors"
                              >
                                Resubmit
                              </button>
                            )}
                            <button
                              type="button"
                              disabled={deletingId === product.id}
                              onClick={() => handleDelete(product.id, product.name)}
                              className="text-[12px] font-[600] font-public-sans text-error hover:opacity-70 transition-opacity"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-[13px] font-public-sans text-muted-text">{total} product{total !== 1 ? 's' : ''} total</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="h-8 px-3 rounded border border-border-warm text-[13px] font-[600] font-public-sans text-primary hover:bg-muted-bg transition-colors disabled:opacity-40"
                >
                  Prev
                </button>
                <span className="text-[13px] font-public-sans text-muted-text px-2">{page} / {totalPages}</span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="h-8 px-3 rounded border border-border-warm text-[13px] font-[600] font-public-sans text-primary hover:bg-muted-bg transition-colors disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
      {lightboxNode}
    </div>
  )
}
