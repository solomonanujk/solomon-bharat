'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Package, Search, Star, CheckCircle2, X, Plus } from 'lucide-react'
import { useAdminProducts } from '@/hooks/queries/useProducts'
import { useAdminCategoryTree } from '@/hooks/queries/useCategories'
import { CategoryCascadeSelect } from '@/components/seller-portal/CategoryCascade'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { EmptyState } from '@/components/shared/EmptyState'
import { buttonVariants } from '@/components/ui/button'
import { cn, formatINR } from '@/lib/utils'
import { cloudinaryFill } from '@/lib/cloudinaryImage'
import type { AdminProduct, ApprovalStatus } from '@/types'

// ─── Filter tabs ────────────────────────────────────────────────────────────────

const STATUS_TABS: { value: ApprovalStatus | ''; label: string; needsAttention?: boolean }[] = [
  { value: '', label: 'All' },
  { value: 'PENDING', label: 'Pending', needsAttention: true },
  { value: 'RESUBMITTED', label: 'Resubmitted', needsAttention: true },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
]

const PAGE_LIMIT = 20

// ─── Row ────────────────────────────────────────────────────────────────────────

function ProductRow({ product, onOpen }: { product: AdminProduct; onOpen: (id: string) => void }) {
  const thumb = product.images?.[0]?.url

  return (
    <tr
      onClick={() => onOpen(product.id)}
      className="border-b border-[#E5E1D8] last:border-0 hover:bg-[#F5F0E8]/30 transition-colors cursor-pointer"
    >
      <td className="py-3 px-4">
        <div className="flex items-center gap-3">
          {thumb ? (
            <img src={cloudinaryFill(thumb, 160, 160)} alt="" className="w-9 h-9 rounded object-contain bg-[#F5F0E8] border border-[#E5E1D8] flex-shrink-0" />
          ) : (
            <div className="w-9 h-9 rounded bg-[#F5F0E8] border border-[#E5E1D8] flex items-center justify-center flex-shrink-0">
              <Package size={14} className="text-[#6B6460]" />
            </div>
          )}
          <p className="text-[13px] font-[600] font-sans text-[#1A1A1A] truncate max-w-[220px]">{product.name}</p>
        </div>
      </td>
      <td className="py-3 px-4 text-[13px] font-sans text-[#1A1A1A]">{formatINR(product.sellerPrice)}</td>
      <td className="py-3 px-4 text-[13px] font-sans">
        {product.adminPrice != null ? (
          <span className="text-[#1A1A1A] font-[600]">{formatINR(product.adminPrice)}</span>
        ) : (
          <span className="text-[#6B6460] italic">not set</span>
        )}
      </td>
      <td className="py-3 px-4 text-[13px] font-sans text-[#6B6460] text-center">{product.moq}</td>
      <td className="py-3 px-4"><StatusBadge status={product.approvalStatus} /></td>
      <td className="py-3 px-4 text-center">
        {product.isPublished ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-[600] font-sans text-emerald-600">
            <CheckCircle2 size={12} aria-hidden="true" /> Published
          </span>
        ) : (
          <span className="text-[11px] font-sans text-[#6B6460]">Unpublished</span>
        )}
      </td>
      <td className="py-3 px-4 text-center">
        {product.isFeatured ? (
          <Star size={14} className="text-[#A68B67] fill-[#A68B67] inline-block" aria-label="Featured" />
        ) : (
          <span className="text-[#6B6460]">—</span>
        )}
      </td>
      <td className="py-3 px-4 text-[12px] font-sans text-[#6B6460] whitespace-nowrap">
        {new Date(product.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}
      </td>
    </tr>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminProductsPage() {
  const router = useRouter()

  const [approvalStatus, setApprovalStatus] = useState<ApprovalStatus | ''>('')
  const [categoryId, setCategoryId] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const { data, isLoading } = useAdminProducts({
    approvalStatus: approvalStatus || undefined,
    categoryId: categoryId || undefined,
    page,
    limit: PAGE_LIMIT,
  })
  const { data: tree = [] } = useAdminCategoryTree()

  const items = data?.items ?? []
  const total = data?.total ?? 0
  const limit = data?.limit ?? PAGE_LIMIT
  const totalPages = data?.totalPages ?? 1

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return items
    return items.filter((p) => p.name.toLowerCase().includes(q))
  }, [items, search])

  function handleTabChange(value: ApprovalStatus | '') {
    setApprovalStatus(value)
    setPage(1)
  }

  function handleCategoryChange(value: string) {
    setCategoryId(value)
    setPage(1)
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-[28px] leading-[1.3] font-[500] font-sans text-[#1A1A1A]">Products</h1>
          <p className="text-[14px] font-sans text-[#6B6460] mt-1">
            Review, price, and publish seller-submitted products — {total.toLocaleString()} total
          </p>
        </div>
        <Link href="/admin/products/new" className={cn(buttonVariants({ variant: 'primary', size: 'sm' }), 'gap-1.5 flex-shrink-0')}>
          <Plus size={14} aria-hidden="true" />
          New Product
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1 max-w-[320px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B6460]" aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products by name…"
            className="w-full h-9 pl-9 pr-4 rounded-lg border border-[#E5E1D8] bg-white text-[13px] font-sans text-[#1A1A1A] placeholder:text-[#6B6460] focus:outline-none focus:border-[#A68B67] transition-colors"
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-[280px]">
          <div className="flex-1 min-w-0">
            <CategoryCascadeSelect tree={tree} value={categoryId} onChange={handleCategoryChange} />
          </div>
          {categoryId && (
            <button
              type="button"
              onClick={() => handleCategoryChange('')}
              title="Clear category filter"
              aria-label="Clear category filter"
              className="h-9 w-9 flex-shrink-0 rounded border border-[#E5E1D8] bg-white flex items-center justify-center text-[#6B6460] hover:text-[#1A1A1A] hover:bg-[#F5F0E8] transition-colors"
            >
              <X size={14} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 mb-4 border-b border-[#E5E1D8] overflow-x-auto">
        {STATUS_TABS.map(({ value, label, needsAttention }) => (
          <button
            key={label}
            type="button"
            onClick={() => handleTabChange(value)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-[600] font-sans border-b-2 -mb-px transition-colors whitespace-nowrap',
              approvalStatus === value ? 'border-[#A68B67] text-[#1A1A1A]' : 'border-transparent text-[#6B6460] hover:text-[#1A1A1A]'
            )}
          >
            {label}
            {needsAttention && <span className="w-1.5 h-1.5 rounded-full bg-warning" aria-hidden="true" />}
          </button>
        ))}
      </div>

      <div className="bg-white border border-[#E5E1D8] rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="divide-y divide-[#E5E1D8]">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="p-4 flex gap-4 animate-pulse">
                <div className="w-9 h-9 bg-[#F5F0E8] rounded flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 bg-[#F5F0E8] rounded w-40" />
                  <div className="h-3 bg-[#F5F0E8] rounded w-24" />
                </div>
                <div className="h-5 bg-[#F5F0E8] rounded w-14" />
              </div>
            ))}
          </div>
        ) : !filtered.length ? (
          <EmptyState
            title="No products found"
            description="Try adjusting your search or filters."
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#E5E1D8] bg-[#F5F0E8]/40">
                    {[
                      { label: 'Product', align: 'left' },
                      { label: 'Seller Price', align: 'left' },
                      { label: 'Admin Price', align: 'left' },
                      { label: 'MOQ', align: 'center' },
                      { label: 'Status', align: 'left' },
                      { label: 'Published', align: 'center' },
                      { label: 'Featured', align: 'center' },
                      { label: 'Created', align: 'left' },
                    ].map(({ label, align }) => (
                      <th
                        key={label}
                        className={cn(
                          'py-3 px-4 text-[12px] font-[600] font-sans text-[#6B6460] uppercase tracking-[0.06em]',
                          align === 'center' ? 'text-center' : 'text-left'
                        )}
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => (
                    <ProductRow key={p.id} product={p} onOpen={(id) => router.push(`/admin/products/${id}`)} />
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-[#E5E1D8]">
                <p className="text-[12px] font-sans text-[#6B6460]">
                  {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total.toLocaleString()}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="h-8 px-3 rounded-lg border border-[#E5E1D8] text-[12px] font-[500] font-sans text-[#6B6460] hover:text-[#1A1A1A] hover:bg-[#F5F0E8] disabled:opacity-40 transition-colors"
                  >
                    Prev
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="h-8 px-3 rounded-lg border border-[#E5E1D8] text-[12px] font-[500] font-sans text-[#6B6460] hover:text-[#1A1A1A] hover:bg-[#F5F0E8] disabled:opacity-40 transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
