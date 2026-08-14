'use client'

import { useMemo, useState } from 'react'
import { Download, FileBarChart } from 'lucide-react'
import { useAdminReport, downloadAdminReportCsv } from '@/hooks/queries/useAdmin'
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable'
import { EmptyState } from '@/components/shared/EmptyState'
import { Button } from '@/components/ui/button'
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import type { ReportType } from '@/types'

// ─── Report type options ────────────────────────────────────────────────────────

const REPORT_TYPES: { value: ReportType; label: string }[] = [
  { value: 'revenue', label: 'Revenue' },
  { value: 'orders-by-status', label: 'Orders by Status' },
  { value: 'orders-by-country', label: 'Orders by Country' },
  { value: 'sellers-performance', label: 'Sellers Performance' },
  { value: 'products-performance', label: 'Products Performance' },
  { value: 'categories-performance', label: 'Categories Performance' },
  { value: 'collections-performance', label: 'Collections Performance' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function humanizeKey(key: string): string {
  const withSpaces = key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
  return withSpaces
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminReportsPage() {
  const [type, setType] = useState<ReportType>('revenue')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [downloading, setDownloading] = useState(false)

  const { data: rows = [], isLoading, isFetching } = useAdminReport({
    type,
    from: from || undefined,
    to: to || undefined,
  })

  const columns: DataTableColumn[] = useMemo(() => {
    if (!rows.length) return []
    return Object.keys(rows[0]).map((key) => ({
      key,
      label: humanizeKey(key),
      sortable: true,
    }))
  }, [rows])

  const typeLabel = REPORT_TYPES.find((r) => r.value === type)?.label ?? type

  async function handleDownload() {
    setDownloading(true)
    try {
      await downloadAdminReportCsv({ type, from: from || undefined, to: to || undefined }, `${type}-report.csv`)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-[28px] leading-[1.3] font-[500] font-playfair text-primary">Reports</h1>
        <p className="text-[14px] font-public-sans text-muted-text mt-1">
          Analytics and exports across revenue, orders, sellers, products, categories, and collections
        </p>
      </div>

      {/* Controls */}
      <div className="bg-surface border border-border-warm rounded p-5 mb-6 flex flex-wrap items-end gap-4">
        <div className="w-full sm:w-[260px]">
          <Label>Report type</Label>
          <Select value={type} onValueChange={(v) => setType(v as ReportType)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REPORT_TYPES.map((r) => (
                <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="report-from">From</Label>
          <input
            id="report-from"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="h-10 px-3 rounded border border-border-warm bg-surface text-[14px] font-public-sans text-primary focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent transition-colors"
          />
        </div>

        <div>
          <Label htmlFor="report-to">To</Label>
          <input
            id="report-to"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="h-10 px-3 rounded border border-border-warm bg-surface text-[14px] font-public-sans text-primary focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent transition-colors"
          />
        </div>

        {(from || to) && (
          <button
            type="button"
            onClick={() => { setFrom(''); setTo('') }}
            className="h-10 text-[12px] font-public-sans text-muted-text hover:text-primary transition-colors underline underline-offset-2"
          >
            Clear dates
          </button>
        )}

        <Button
          variant="ghost"
          size="md"
          className="gap-1.5 ml-auto"
          disabled={downloading || !rows.length}
          onClick={handleDownload}
        >
          <Download size={14} aria-hidden="true" />
          {downloading ? 'Downloading…' : 'Download CSV'}
        </Button>
      </div>

      {/* Results */}
      {isLoading || isFetching ? (
        <div className="bg-surface border border-border-warm rounded overflow-hidden">
          <div className="p-4 space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-9 bg-muted-bg rounded animate-pulse" />
            ))}
          </div>
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-surface border border-border-warm rounded overflow-hidden">
          <EmptyState
            title={`No data for ${typeLabel}`}
            description="Try a different date range or report type."
          />
        </div>
      ) : (
        <DataTable columns={columns} data={rows} />
      )}

      {rows.length === 0 && !isLoading && !isFetching && (
        <p className="text-[12px] font-public-sans text-muted-text mt-3 flex items-center gap-1.5">
          <FileBarChart size={12} aria-hidden="true" />
          Reports refresh automatically as you change the type or date range.
        </p>
      )}
    </div>
  )
}
