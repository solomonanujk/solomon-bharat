import { cn } from '@/lib/utils'

/** Small pieces shared by the admin list pages (WhatsApp, Bulk Messages). */

export const cell = 'py-3 px-4 text-[13px] font-sans text-[#183D33B3]'

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
}

export function timeAgo(iso: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000))
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  return `${Math.round(hours / 24)} d ago`
}

export function Pager({
  page,
  totalPages,
  total,
  limit,
  onPage,
}: {
  page: number
  totalPages: number
  total: number
  limit: number
  onPage: (p: number) => void
}) {
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

export function Skeleton() {
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

export function Table({ heads, children, className }: { heads: string[]; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('overflow-x-auto', className)}>
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
