'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Package, Search, Star, CheckCircle2, X, Plus, MessageCircle, Trash2 } from 'lucide-react'
import { useAdminProducts, useRejectProduct } from '@/hooks/queries/useProducts'
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

function ProductRow({
  product,
  onOpen,
  selected,
  onToggle,
}: {
  product: AdminProduct
  onOpen: (id: string) => void
  selected: boolean
  onToggle: (id: string) => void
}) {
  const thumb = product.images?.[0]?.url

  return (
    <tr
      className={cn('border-b border-[#D9E2DA] last:border-0 hover:bg-[#E7EDE7]/30 transition-colors cursor-pointer', selected && 'bg-[#E7EDE7]/50')}
    >
      <td className="py-3 px-3 w-10" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggle(product.id)}
          className="w-4 h-4 rounded border-[#D9E2DA] accent-[#183D33] cursor-pointer"
          aria-label={`Select ${product.name}`}
        />
      </td>
      <td className="py-3 px-4" onClick={() => onOpen(product.id)}>
        <div className="flex items-center gap-3">
          {thumb ? (
            <img src={cloudinaryFill(thumb, 160, 160)} alt="" className="w-9 h-9 rounded object-contain bg-[#E7EDE7] border border-[#D9E2DA] flex-shrink-0" />
          ) : (
            <div className="w-9 h-9 rounded bg-[#E7EDE7] border border-[#D9E2DA] flex items-center justify-center flex-shrink-0">
              <Package size={14} className="text-[#183D33B3]" />
            </div>
          )}
          <div className="min-w-0">
            <p className="text-[13px] font-[600] font-sans text-[#0F241D] truncate max-w-[220px]">{product.name}</p>
            {product.source === 'WHATSAPP' && (
              <span className="inline-flex items-center gap-1 text-[10px] font-[600] font-sans text-[#183D33] bg-[#E7EDE7] rounded px-1.5 py-0.5 mt-0.5">
                <MessageCircle size={10} aria-hidden="true" /> via WhatsApp
              </span>
            )}
          </div>
        </div>
      </td>
      <td className="py-3 px-4 text-[13px] font-sans text-[#183D33B3] max-w-[140px] truncate" onClick={() => onOpen(product.id)}>
        {product.privateSupplier?.name ?? product.seller?.businessName ?? '—'}
        {product.privateSupplier && <span className="ml-1 text-[10px] font-[600] uppercase tracking-wide text-[#183D33B3]/60">(private)</span>}
      </td>
      <td className="py-3 px-4 text-[13px] font-sans text-[#0F241D]" onClick={() => onOpen(product.id)}>{formatINR(product.sellerPrice)}</td>
      <td className="py-3 px-4 text-[13px] font-sans" onClick={() => onOpen(product.id)}>
        {product.adminPrice != null ? (
          <span className="text-[#0F241D] font-[600]">{formatINR(product.adminPrice)}</span>
        ) : (
          <span className="text-[#183D33B3] italic">not set</span>
        )}
      </td>
      <td className="py-3 px-4 text-[13px] font-sans text-[#183D33B3] text-center" onClick={() => onOpen(product.id)}>{product.moq}</td>
      <td className="py-3 px-4" onClick={() => onOpen(product.id)}><StatusBadge status={product.approvalStatus} /></td>
      <td className="py-3 px-4 text-center" onClick={() => onOpen(product.id)}>
        {product.isPublished ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-[600] font-sans text-[#183D33]">
            <CheckCircle2 size={12} aria-hidden="true" /> Published
          </span>
        ) : (
          <span className="text-[11px] font-sans text-[#183D33B3]">Unpublished</span>
        )}
      </td>
      <td className="py-3 px-4 text-center" onClick={() => onOpen(product.id)}>
        {product.isFeatured ? (
          <Star size={14} className="text-[#183D33] fill-[#183D33] inline-block" aria-label="Featured" />
        ) : (
          <span className="text-[#183D33B3]">—</span>
        )}
      </td>
      <td className="py-3 px-4 text-[12px] font-sans text-[#183D33B3] whitespace-nowrap" onClick={() => onOpen(product.id)}>
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
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkWorking, setBulkWorking] = useState(false)
  const reject = useRejectProduct()

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

  const allSelected = filtered.length > 0 && filtered.every((p) => selected.has(p.id))
  const someSelected = selected.size > 0

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filtered.map((p) => p.id)))
    }
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function handleTabChange(value: ApprovalStatus | '') {
    setApprovalStatus(value)
    setPage(1)
    setSelected(new Set())
  }

  function handleCategoryChange(value: string) {
    setCategoryId(value)
    setPage(1)
  }

  async function handleBulkReject() {
    const reason = window.prompt(`Reject ${selected.size} product${selected.size !== 1 ? 's' : ''}?\n\nEnter rejection reason:`)
    if (reason === null) return
    setBulkWorking(true)
    const ids = [...selected]
    for (const id of ids) {
      await new Promise<void>((resolve) =>
        reject.mutate({ id, reason: reason || 'Rejected by admin' }, { onSettled: () => resolve() })
      )
    }
    setSelected(new Set())
    setBulkWorking(false)
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-[28px] leading-[1.3] font-[500] font-sans text-[#0F241D]">Products</h1>
          <p className="text-[14px] font-sans text-[#183D33B3] mt-1">
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
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#183D33B3]" aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products by name…"
            className="w-full h-9 pl-9 pr-4 rounded-lg border border-[#D9E2DA] bg-white text-[13px] font-sans text-[#0F241D] placeholder:text-[#183D33B3] focus:outline-none focus:border-[#183D33] transition-colors"
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
              className="h-9 w-9 flex-shrink-0 rounded border border-[#D9E2DA] bg-white flex items-center justify-center text-[#183D33B3] hover:text-[#0F241D] hover:bg-[#E7EDE7] transition-colors"
            >
              <X size={14} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 mb-4 border-b border-[#D9E2DA] overflow-x-auto">
        {STATUS_TABS.map(({ value, label, needsAttention }) => (
          <button
            key={label}
            type="button"
            onClick={() => handleTabChange(value)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-[600] font-sans border-b-2 -mb-px transition-colors whitespace-nowrap',
              approvalStatus === value ? 'border-[#183D33] text-[#0F241D]' : 'border-transparent text-[#183D33B3] hover:text-[#0F241D]'
            )}
          >
            {label}
            {needsAttention && <span className="w-1.5 h-1.5 rounded-full bg-warning" aria-hidden="true" />}
          </button>
        ))}
      </div>

      <div className="bg-white border border-[#D9E2DA] rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="divide-y divide-[#D9E2DA]">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="p-4 flex gap-4 animate-pulse">
                <div className="w-9 h-9 bg-[#E7EDE7] rounded flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 bg-[#E7EDE7] rounded w-40" />
                  <div className="h-3 bg-[#E7EDE7] rounded w-24" />
                </div>
                <div className="h-5 bg-[#E7EDE7] rounded w-14" />
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
                  <tr className="border-b border-[#D9E2DA] bg-[#E7EDE7]/40">
                    <th className="py-3 px-3 w-10">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleAll}
                        className="w-4 h-4 rounded border-[#D9E2DA] accent-[#183D33] cursor-pointer"
                        aria-label="Select all"
                      />
                    </th>
                    {[
                      { label: 'Product', align: 'left' },
                      { label: 'Seller', align: 'left' },
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
                          'py-3 px-4 text-[12px] font-[600] font-sans text-[#183D33B3] uppercase tracking-[0.06em]',
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
                    <ProductRow
                      key={p.id}
                      product={p}
                      onOpen={(id) => router.push(`/admin/products/${id}`)}
                      selected={selected.has(p.id)}
                      onToggle={toggleOne}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-[#D9E2DA]">
                <p className="text-[12px] font-sans text-[#183D33B3]">
                  {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total.toLocaleString()}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="h-8 px-3 rounded-lg border border-[#D9E2DA] text-[12px] font-[500] font-sans text-[#183D33B3] hover:text-[#0F241D] hover:bg-[#E7EDE7] disabled:opacity-40 transition-colors"
                  >
                    Prev
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="h-8 px-3 rounded-lg border border-[#D9E2DA] text-[12px] font-[500] font-sans text-[#183D33B3] hover:text-[#0F241D] hover:bg-[#E7EDE7] disabled:opacity-40 transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
      {/* Bulk action bar */}
      {someSelected && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-[#0F241D] text-white px-5 py-3 rounded-2xl shadow-xl">
          <span className="text-[13px] font-[600] font-sans">{selected.size} selected</span>
          <div className="w-px h-5 bg-white/20" />
          <button
            type="button"
            disabled={bulkWorking}
            onClick={handleBulkReject}
            className="flex items-center gap-1.5 text-[13px] font-[600] font-sans text-red-300 hover:text-red-200 transition-colors disabled:opacity-40"
          >
            <Trash2 size={13} />
            Reject selected
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
    </div>
  )
}
