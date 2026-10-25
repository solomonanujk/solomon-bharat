'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MessageCircle, Package, Search } from 'lucide-react'
import {
  useWhatsAppAdminProducts,
  useWhatsAppAdminSellers,
  useWhatsAppAdminSessions,
  useWhatsAppAdminSummary,
  type WhatsAppLinkedSeller,
  type WhatsAppLiveListing,
  type WhatsAppSessionState,
} from '@/hooks/queries/useWhatsApp'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { EmptyState } from '@/components/shared/EmptyState'
import { cn } from '@/lib/utils'
import { cloudinaryFill } from '@/lib/cloudinaryImage'
import type { AdminProduct, ApprovalStatus } from '@/types'

type Tab = 'products' | 'sessions' | 'sellers'

const PAGE_LIMIT = 20

const STATUS_TABS: { value: ApprovalStatus | ''; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'RESUBMITTED', label: 'Resubmitted' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
]

const STAGE_LABEL: Record<WhatsAppSessionState, string> = {
  COLLECTING: 'Sending photos and details',
  AWAITING_ANSWERS: 'Answering our questions',
  AWAITING_CONFIRM: 'Checking the summary',
}

const FIELD_LABEL: Record<string, string> = {
  photos: 'photos',
  name: 'name',
  category: 'category',
  price: 'price',
  moq: 'min. order',
  stock: 'stock',
  materials: 'material',
  description: 'description',
  craftTechnique: 'craft',
  placeOfOrigin: 'made in',
  weight: 'weight',
  dimensions: 'size',
  leadTime: 'dispatch time',
  careInstructions: 'care',
  hsn: 'HSN',
}

const LANGUAGE_LABEL: Record<string, string> = { en: 'English', hi: 'Hindi', hinglish: 'Hinglish' }

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })
}

function timeAgo(iso: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000))
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  return `${Math.round(hours / 24)} d ago`
}

// ─── Shared pieces ──────────────────────────────────────────────────────────────

function Pager({ page, totalPages, total, limit, onPage }: { page: number; totalPages: number; total: number; limit: number; onPage: (p: number) => void }) {
  if (totalPages <= 1) return null
  const button =
    'h-8 px-3 rounded-lg border border-[#D9E2DA] text-[12px] font-[500] font-sans text-[#183D33B3] hover:text-[#0F241D] hover:bg-[#E7EDE7] disabled:opacity-40 transition-colors'
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-[#D9E2DA]">
      <p className="text-[12px] font-sans text-[#183D33B3]">
        {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total.toLocaleString()}
      </p>
      <div className="flex gap-2">
        <button type="button" onClick={() => onPage(Math.max(1, page - 1))} disabled={page === 1} className={button}>
          Prev
        </button>
        <button type="button" onClick={() => onPage(Math.min(totalPages, page + 1))} disabled={page >= totalPages} className={button}>
          Next
        </button>
      </div>
    </div>
  )
}

function Skeleton() {
  return (
    <div className="divide-y divide-[#D9E2DA]">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="p-4 flex gap-4 animate-pulse">
          <div className="flex-1 space-y-2">
            <div className="h-3.5 bg-[#E7EDE7] rounded w-40" />
            <div className="h-3 bg-[#E7EDE7] rounded w-24" />
          </div>
          <div className="h-5 bg-[#E7EDE7] rounded w-14" />
        </div>
      ))}
    </div>
  )
}

function Table({ heads, children }: { heads: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-[#D9E2DA] bg-[#E7EDE7]/40">
            {heads.map((h) => (
              <th key={h} className="py-3 px-4 text-left text-[12px] font-[600] font-sans text-[#183D33B3] uppercase tracking-[0.06em]">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

const cell = 'py-3 px-4 text-[13px] font-sans text-[#183D33B3]'

// ─── Products ───────────────────────────────────────────────────────────────────

function ProductsTab() {
  const router = useRouter()
  const [status, setStatus] = useState<ApprovalStatus | ''>('')
  const [page, setPage] = useState(1)
  const { data, isLoading } = useWhatsAppAdminProducts({ approvalStatus: status || undefined, page, limit: PAGE_LIMIT })
  const items = data?.items ?? []

  return (
    <>
      <div className="flex gap-1 mb-4 border-b border-[#D9E2DA] overflow-x-auto">
        {STATUS_TABS.map(({ value, label }) => (
          <button
            key={label}
            type="button"
            onClick={() => {
              setStatus(value)
              setPage(1)
            }}
            className={cn(
              'px-4 py-2.5 text-[13px] font-[600] font-sans border-b-2 -mb-px transition-colors whitespace-nowrap',
              status === value ? 'border-[#183D33] text-[#0F241D]' : 'border-transparent text-[#183D33B3] hover:text-[#0F241D]',
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="bg-white border border-[#D9E2DA] rounded-xl overflow-hidden">
        {isLoading ? (
          <Skeleton />
        ) : !items.length ? (
          <EmptyState title="No WhatsApp products" description="Products sellers list by chat will appear here for review." />
        ) : (
          <>
            <Table heads={['Product', 'Seller', 'Status', 'Photos', 'Created']}>
              {items.map((p: AdminProduct) => {
                const thumb = p.images?.[0]?.url
                return (
                  <tr
                    key={p.id}
                    onClick={() => router.push(`/admin/products/${p.id}`)}
                    className="border-b border-[#D9E2DA] last:border-0 hover:bg-[#E7EDE7]/30 transition-colors cursor-pointer"
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        {thumb ? (
                          <img src={cloudinaryFill(thumb, 160, 160)} alt="" className="w-9 h-9 rounded object-contain bg-[#E7EDE7] border border-[#D9E2DA] flex-shrink-0" />
                        ) : (
                          <div className="w-9 h-9 rounded bg-[#E7EDE7] border border-[#D9E2DA] flex items-center justify-center flex-shrink-0">
                            <Package size={14} className="text-[#183D33B3]" />
                          </div>
                        )}
                        <p className="text-[13px] font-[600] font-sans text-[#0F241D] truncate max-w-[240px]">{p.name}</p>
                      </div>
                    </td>
                    <td className={cn(cell, 'max-w-[180px] truncate')}>{p.seller?.businessName ?? '—'}</td>
                    <td className="py-3 px-4"><StatusBadge status={p.approvalStatus} /></td>
                    <td className={cell}>{p.images?.length ?? 0}</td>
                    <td className={cn(cell, 'whitespace-nowrap')}>{formatDate(p.createdAt)}</td>
                  </tr>
                )
              })}
            </Table>
            <Pager page={page} totalPages={data?.totalPages ?? 1} total={data?.total ?? 0} limit={data?.limit ?? PAGE_LIMIT} onPage={setPage} />
          </>
        )}
      </div>
    </>
  )
}

// ─── In progress ────────────────────────────────────────────────────────────────

function SessionRow({ s }: { s: WhatsAppLiveListing }) {
  const missing = s.missing.map((m) => FIELD_LABEL[m] ?? m)
  return (
    <tr className="border-b border-[#D9E2DA] last:border-0">
      <td className="py-3 px-4">
        <p className="text-[13px] font-[600] font-sans text-[#0F241D] truncate max-w-[240px]">{s.productName ?? 'Not named yet'}</p>
        {s.categoryPath && <p className="text-[11px] font-sans text-[#183D33B3] truncate max-w-[240px]">{s.categoryPath}</p>}
      </td>
      <td className={cell}>
        <p className="text-[#0F241D] truncate max-w-[160px]">{s.businessName}</p>
        <p className="text-[11px]">{s.phone}</p>
      </td>
      <td className={cell}>{STAGE_LABEL[s.state] ?? s.state}</td>
      <td className={cn(cell, 'max-w-[220px]')}>{missing.length ? missing.join(', ') : '—'}</td>
      <td className={cell}>{s.photoCount} photos{s.videoCount ? `, ${s.videoCount} video` : ''}</td>
      <td className={cell}>{LANGUAGE_LABEL[s.language] ?? s.language}</td>
      <td className={cn(cell, 'whitespace-nowrap')}>{timeAgo(s.lastMessageAt)}</td>
    </tr>
  )
}

function SessionsTab() {
  const [page, setPage] = useState(1)
  const { data, isLoading } = useWhatsAppAdminSessions({ page, limit: PAGE_LIMIT })
  const items = data?.items ?? []

  return (
    <div className="bg-white border border-[#D9E2DA] rounded-xl overflow-hidden">
      <p className="px-4 py-3 text-[12px] font-sans text-[#183D33B3] border-b border-[#D9E2DA]">
        Listings sellers have started on WhatsApp and not finished. A listing is dropped after 24 hours of silence, or when the seller sends cancel. Refreshes every 30 seconds.
      </p>
      {isLoading ? (
        <Skeleton />
      ) : !items.length ? (
        <EmptyState title="Nobody is listing right now" description="Open listings will show here while sellers chat." />
      ) : (
        <>
          <Table heads={['Product so far', 'Seller', 'Stage', 'Still missing', 'Media', 'Language', 'Last message']}>
            {items.map((s) => (
              <SessionRow key={s.phone} s={s} />
            ))}
          </Table>
          <Pager page={page} totalPages={data?.totalPages ?? 1} total={data?.total ?? 0} limit={data?.limit ?? PAGE_LIMIT} onPage={setPage} />
        </>
      )}
    </div>
  )
}

// ─── Sellers ────────────────────────────────────────────────────────────────────

function SellersTab() {
  const [input, setInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(input.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(t)
  }, [input])

  const { data, isLoading } = useWhatsAppAdminSellers({ search: search || undefined, page, limit: PAGE_LIMIT })
  const items = data?.items ?? []

  return (
    <>
      <div className="relative max-w-[320px] mb-4">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#183D33B3]" aria-hidden="true" />
        <input
          type="search"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Search by business or number…"
          className="w-full h-9 pl-9 pr-4 rounded-lg border border-[#D9E2DA] bg-white text-[13px] font-sans text-[#0F241D] placeholder:text-[#183D33B3] focus:outline-none focus:border-[#183D33] transition-colors"
        />
      </div>
      <div className="bg-white border border-[#D9E2DA] rounded-xl overflow-hidden">
        {isLoading ? (
          <Skeleton />
        ) : !items.length ? (
          <EmptyState title="No linked sellers" description="Sellers who verify a WhatsApp number in their settings will appear here." />
        ) : (
          <>
            <Table heads={['Seller', 'WhatsApp number', 'Linked on', 'Products by chat', 'AI calls today']}>
              {items.map((s: WhatsAppLinkedSeller) => (
                <tr key={s.sellerId} className="border-b border-[#D9E2DA] last:border-0">
                  <td className={cn(cell, 'text-[#0F241D] font-[600]')}>{s.businessName}</td>
                  <td className={cell}>{s.whatsappNumber}</td>
                  <td className={cn(cell, 'whitespace-nowrap')}>{formatDate(s.linkedAt)}</td>
                  <td className={cell}>{s.productsByChat}</td>
                  <td className={cell}>{s.aiCallsToday}</td>
                </tr>
              ))}
            </Table>
            <Pager page={page} totalPages={data?.totalPages ?? 1} total={data?.total ?? 0} limit={data?.limit ?? PAGE_LIMIT} onPage={setPage} />
          </>
        )}
      </div>
    </>
  )
}

// ─── Page ───────────────────────────────────────────────────────────────────────

export default function AdminWhatsAppPage() {
  const [tab, setTab] = useState<Tab>('products')
  const { data: summary } = useWhatsAppAdminSummary()

  const tabs: { value: Tab; label: string; count?: number }[] = [
    { value: 'products', label: 'Products', count: summary?.pendingProducts },
    { value: 'sessions', label: 'In progress', count: summary?.liveListings },
    { value: 'sellers', label: 'Linked sellers', count: summary?.linkedSellers },
  ]

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-[28px] leading-[1.3] font-[500] font-sans text-[#0F241D] flex items-center gap-2">
          <MessageCircle size={24} aria-hidden="true" /> WhatsApp listing
        </h1>
        <p className="text-[14px] font-sans text-[#183D33B3] mt-1">
          Products sellers create by chat, listings in progress, and who has linked a number.
        </p>
      </div>

      <div className="flex gap-2 mb-5">
        {tabs.map(({ value, label, count }) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={cn(
              'h-9 px-4 rounded-lg border text-[13px] font-[600] font-sans transition-colors flex items-center gap-2',
              tab === value
                ? 'bg-[#183D33] border-[#183D33] text-white'
                : 'bg-white border-[#D9E2DA] text-[#183D33B3] hover:text-[#0F241D] hover:bg-[#E7EDE7]',
            )}
          >
            {label}
            {count != null && (
              <span className={cn('text-[11px] rounded-full px-1.5 min-w-[18px] text-center', tab === value ? 'bg-white/20' : 'bg-[#E7EDE7]')}>
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === 'products' && <ProductsTab />}
      {tab === 'sessions' && <SessionsTab />}
      {tab === 'sellers' && <SellersTab />}
    </div>
  )
}
