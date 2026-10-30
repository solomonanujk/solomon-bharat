'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { Plus, Package, Upload, Trash2, RefreshCw, CheckSquare } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useMyProducts, useResubmitProduct, useDeleteMyProduct } from '@/hooks/queries/useProducts'
import { useCategoryTree } from '@/hooks/queries/useCategories'
import { categoryPathLabel } from '@/components/seller-portal/CategoryCascade'
import { ApprovalStatusBadge } from '@/components/seller-portal/StatusBadges'
import { useImageLightbox } from '@/components/shared/ImageLightbox'
import { cloudinaryFill } from '@/lib/cloudinaryImage'
import type { ApprovalStatus } from '@/types'

type FilterValue = 'All' | ApprovalStatus

const STATUS_FILTERS: { label: string; value: FilterValue }[] = [
  { label: 'All', value: 'All' },
  { label: 'Drafts', value: 'DRAFT' },
  { label: 'Pending', value: 'PENDING' },
  { label: 'Resubmitted', value: 'RESUBMITTED' },
  { label: 'Approved', value: 'APPROVED' },
  { label: 'Rejected', value: 'REJECTED' },
]

function SkeletonRows() {
  return (
    <div className="bg-white border border-[#D9E2DA] rounded-xl overflow-hidden animate-pulse">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-[#FFFFFF] last:border-0">
          <div className="w-11 h-11 rounded-lg bg-[#E7EDE7] shrink-0" />
          <div className="flex-1">
            <div className="h-4 bg-[#E7EDE7] rounded w-1/3 mb-1.5" />
            <div className="h-3 bg-[#E7EDE7] rounded w-1/4" />
          </div>
          <div className="h-4 bg-[#E7EDE7] rounded w-16" />
          <div className="h-5 bg-[#E7EDE7] rounded-full w-20" />
          <div className="h-4 bg-[#E7EDE7] rounded w-12" />
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
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkWorking, setBulkWorking] = useState(false)
  const { openLightbox, lightboxNode } = useImageLightbox()

  const { data: tree = [] } = useCategoryTree()
  const { data, isLoading, error } = useMyProducts({
    approvalStatus: filter === 'All' ? undefined : filter,
    page,
    limit: PAGE_LIMIT,
  })
  const resubmit = useResubmitProduct()
  const del = useDeleteMyProduct()
  const statusFilters = STATUS_FILTERS

  const products = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_LIMIT))

  const allIds = useMemo(() => products.map((p) => p.id), [products])
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id))
  const someSelected = selected.size > 0

  const selectedProducts = useMemo(
    () => products.filter((p) => selected.has(p.id)),
    [products, selected],
  )
  const canBulkResubmit = selectedProducts.every((p) => p.approvalStatus === 'REJECTED')
  const hasRejected = selectedProducts.some((p) => p.approvalStatus === 'REJECTED')

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set())
    } else {
      setSelected(new Set(allIds))
    }
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function handleFilterChange(value: FilterValue) {
    setFilter(value)
    setPage(1)
    setSelected(new Set())
  }

  function handleDelete(id: string, name: string) {
    if (!window.confirm(`Remove "${name}"? This can't be undone.`)) return
    setDeletingId(id)
    del.mutate(id, { onSettled: () => setDeletingId(null) })
  }

  async function handleBulkDelete() {
    if (!window.confirm(`Delete ${selected.size} product${selected.size !== 1 ? 's' : ''}? This can't be undone.`)) return
    setBulkWorking(true)
    const ids = [...selected]
    for (const id of ids) {
      await new Promise<void>((resolve) => del.mutate(id, { onSettled: () => resolve() }))
    }
    setSelected(new Set())
    setBulkWorking(false)
  }

  async function handleBulkResubmit() {
    setBulkWorking(true)
    const ids = [...selected].filter((id) => {
      const p = products.find((x) => x.id === id)
      return p?.approvalStatus === 'REJECTED'
    })
    for (const id of ids) {
      await new Promise<void>((resolve) => resubmit.mutate(id, { onSettled: () => resolve() }))
    }
    setSelected(new Set())
    setBulkWorking(false)
  }

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[24px] font-[700] font-sans text-[#0F241D] leading-tight">
            My Products
          </h1>
          <p className="text-[13px] font-sans text-[#183D33B3] mt-0.5">
            {'Submit and manage your product catalogue.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/portal/products/import"
            className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'gap-1.5')}
          >
            <Upload size={14} aria-hidden="true" />
            Import products
          </Link>
          <Link
            href="/portal/products/new"
            className={cn(buttonVariants({ variant: 'primary', size: 'sm' }), 'gap-1.5')}
          >
            <Plus size={14} aria-hidden="true" />
            {'Submit Product'}
          </Link>
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="flex items-center gap-1 mb-5 border-b border-[#D9E2DA] overflow-x-auto">
        {statusFilters.map(({ label, value }) => (
          <button
            key={value}
            type="button"
            onClick={() => handleFilterChange(value)}
            className={cn(
              'px-4 py-2.5 text-[13.5px] font-[600] font-sans whitespace-nowrap transition-colors border-b-2',
              filter === value
                ? 'border-[#183D33] text-[#0F241D] -mb-px'
                : 'border-transparent text-[#183D33B3] hover:text-[#0F241D]'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <SkeletonRows />
      ) : error ? (
        <div className="py-12 text-center">
          <p className="text-[14px] font-sans text-[#183D33]">Failed to load products.</p>
        </div>
      ) : products.length === 0 ? (
        <div className="py-20 flex flex-col items-center justify-center text-center bg-white border border-[#D9E2DA] rounded-xl">
          <div className="w-14 h-14 rounded-full bg-[#E7EDE7] flex items-center justify-center mb-4">
            <Package size={24} className="text-[#6B7E6B]" aria-hidden="true" />
          </div>
          <p className="text-[16px] font-[600] font-sans text-[#0F241D] mb-1">
            {filter === 'All' ? 'No products yet' : `No ${filter.toLowerCase()} products`}
          </p>
          <p className="text-[13.5px] font-sans text-[#183D33B3] mb-6">
            {filter === 'All'
              ? 'Submit your first product for Solomon Bharat’s review.'
              : 'Try a different filter to see your other products.'}
          </p>
          {filter === 'All' && (
            <Link
              href="/portal/products/new"
              className={cn(buttonVariants({ variant: 'primary', size: 'sm' }), 'gap-1.5')}
            >
              <Plus size={14} aria-hidden="true" />
              {'Submit Product'}
            </Link>
          )}
        </div>
      ) : (
        <>
          <div className="bg-white border border-[#D9E2DA] rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px]">
                <thead>
                  <tr className="border-b border-[#D9E2DA] bg-[#E7EDE7]">
                    <th className="px-4 py-3 w-10">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleAll}
                        className="w-4 h-4 rounded border-[#D9E2DA] text-[#183D33] accent-[#183D33] cursor-pointer"
                        aria-label="Select all"
                      />
                    </th>
                    {['', 'Product', 'Category', 'Stock', 'Status', 'Submitted', 'Actions'].map((col) => (
                      <th key={col} className="px-5 py-3 text-left text-[11px] font-[700] font-sans text-[#6B7E6B] uppercase tracking-[0.07em]">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E7EDE7]">
                  {products.map((product) => {
                    const imageUrl = product.images?.[0]?.url ?? null
                    const canResubmit = product.approvalStatus === 'REJECTED'

                    return (
                      <tr key={product.id} className={cn('hover:bg-[#E7EDE7] transition-colors', selected.has(product.id) && 'bg-[#E7EDE7]')}>
                        <td className="px-4 py-4 w-10">
                          <input
                            type="checkbox"
                            checked={selected.has(product.id)}
                            onChange={() => toggleOne(product.id)}
                            className="w-4 h-4 rounded border-[#D9E2DA] text-[#183D33] accent-[#183D33] cursor-pointer"
                            aria-label={`Select ${product.name}`}
                          />
                        </td>
                        <td className="px-5 py-4">
                          {imageUrl ? (
                            <button
                              type="button"
                              onClick={() => openLightbox(imageUrl, product.name)}
                              className="w-11 h-11 rounded-lg border border-[#D9E2DA] overflow-hidden bg-[#E7EDE7] relative shrink-0 cursor-zoom-in"
                              aria-label={`View ${product.name} full size`}
                            >
                              <Image
                                src={cloudinaryFill(imageUrl, 160, 160)}
                                alt=""
                                width={44}
                                height={44}
                                className="object-contain w-full h-full"
                                unoptimized
                              />
                            </button>
                          ) : (
                            <div className="w-11 h-11 rounded-lg border border-[#D9E2DA] bg-[#E7EDE7] shrink-0" />
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <button
                            type="button"
                            onClick={() => router.push(`/portal/products/${product.id}`)}
                            className="text-[14px] font-[600] font-sans text-[#0F241D] hover:text-[#183D33] transition-colors text-left leading-snug"
                          >
                            {product.name}
                          </button>
                        </td>
                        <td className="px-5 py-4">
                          <span className="text-[12.5px] font-sans text-[#183D33B3]">
                            {categoryPathLabel(tree, product.categoryId)}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span className="tabular-nums text-[13.5px] font-[500] font-sans text-[#0F241D]">
                            {product.declaredStock}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex flex-col gap-1">
                            {(
                              <ApprovalStatusBadge status={product.approvalStatus} />
                            )}
                            {product.approvalStatus === 'REJECTED' && product.rejectionReason && (
                              <p className="text-[11px] font-sans text-[#183D33] max-w-[200px] leading-snug">
                                {product.rejectionReason}
                              </p>
                            )}
                            {product.pendingPricingChange && (
                              <p className="text-[11px] font-[600] font-sans text-[#183D33]">
                                Pricing update pending review
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span className="text-[12.5px] font-sans text-[#6B7E6B] whitespace-nowrap">
                            {new Date(product.createdAt).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <Link
                              href={`/portal/products/${product.id}/edit`}
                              className="text-[12px] font-[600] font-sans text-[#183D33] hover:text-[#0F241D] transition-colors"
                            >
                              Edit
                            </Link>
                            {canResubmit && (
                              <button
                                type="button"
                                disabled={resubmit.isPending}
                                onClick={() => resubmit.mutate(product.id)}
                                className="text-[12px] font-[600] font-sans text-[#183D33B3] hover:text-[#0F241D] transition-colors disabled:opacity-40"
                              >
                                Resubmit
                              </button>
                            )}
                            <button
                              type="button"
                              disabled={deletingId === product.id}
                              onClick={() => handleDelete(product.id, product.name)}
                              className="text-[12px] font-[600] font-sans text-[#183D33] hover:text-[#183D33] transition-colors disabled:opacity-40"
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
              <p className="text-[13px] font-sans text-[#183D33B3]">
                {total} product{total !== 1 ? 's' : ''} total
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="h-8 px-3.5 rounded-lg border border-[#D9E2DA] text-[13px] font-[600] font-sans text-[#0F241D] hover:bg-[#E7EDE7] transition-colors disabled:opacity-40"
                >
                  Prev
                </button>
                <span className="text-[13px] font-sans text-[#183D33B3] px-2">
                  {page} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="h-8 px-3.5 rounded-lg border border-[#D9E2DA] text-[13px] font-[600] font-sans text-[#0F241D] hover:bg-[#E7EDE7] transition-colors disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
      {/* Bulk action bar */}
      {someSelected && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-[#0F241D] text-white px-5 py-3 rounded-2xl shadow-xl">
          <span className="text-[13px] font-[600] font-sans">
            {selected.size} selected
          </span>
          <div className="w-px h-5 bg-white/20" />
          {hasRejected && (
            <button
              type="button"
              disabled={bulkWorking}
              onClick={handleBulkResubmit}
              className="flex items-center gap-1.5 text-[13px] font-[600] font-sans hover:text-[#A8C5A8] transition-colors disabled:opacity-40"
            >
              <RefreshCw size={13} />
              Resubmit rejected
            </button>
          )}
          <button
            type="button"
            disabled={bulkWorking}
            onClick={handleBulkDelete}
            className="flex items-center gap-1.5 text-[13px] font-[600] font-sans text-red-300 hover:text-red-200 transition-colors disabled:opacity-40"
          >
            <Trash2 size={13} />
            Delete
          </button>
          <div className="w-px h-5 bg-white/20" />
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="text-[12px] font-sans text-white/60 hover:text-white transition-colors"
          >
            Clear
          </button>
        </div>
      )}
      {lightboxNode}
    </div>
  )
}
