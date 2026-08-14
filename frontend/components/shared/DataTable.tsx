'use client'

import { useState, useMemo, useCallback } from 'react'
import { ChevronUp, ChevronDown, Download } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import { EmptyState } from '@/components/shared/EmptyState'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DataTableColumn<T = Record<string, unknown>> {
  key: string
  label: string
  sortable?: boolean
  render?: (value: unknown, row: T) => React.ReactNode
}

interface DataTableProps<T = Record<string, unknown>> {
  columns: DataTableColumn<T>[]
  data: T[]
  pageSize?: number
  className?: string
}

type SortDirection = 'asc' | 'desc' | null

// ─── CSV Export ───────────────────────────────────────────────────────────────

function exportToCSV(columns: DataTableColumn[], data: Record<string, unknown>[]) {
  const headers = columns.map((c) => c.label).join(',')
  const rows = data.map((row) =>
    columns
      .map((c) => {
        const value = row[c.key]
        const str = value == null ? '' : String(value)
        // Escape quotes and wrap in quotes if comma present
        return str.includes(',') || str.includes('"')
          ? `"${str.replace(/"/g, '""')}"`
          : str
      })
      .join(',')
  )
  const csv = [headers, ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'export.csv'
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  pageSize = 20,
  className,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<SortDirection>(null)
  const [page, setPage] = useState(1)

  // ── Sort ────────────────────────────────────────────────────────────────────
  const handleSort = useCallback(
    (key: string) => {
      if (sortKey === key) {
        setSortDir((prev) => (prev === 'asc' ? 'desc' : prev === 'desc' ? null : 'asc'))
        if (sortDir === 'desc') setSortKey(null)
      } else {
        setSortKey(key)
        setSortDir('asc')
      }
      setPage(1)
    },
    [sortKey, sortDir]
  )

  const sortedData = useMemo(() => {
    if (!sortKey || !sortDir) return data
    return [...data].sort((a, b) => {
      const aVal = a[sortKey]
      const bVal = b[sortKey]
      if (aVal == null && bVal == null) return 0
      if (aVal == null) return 1
      if (bVal == null) return -1
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal
      }
      const aStr = String(aVal).toLowerCase()
      const bStr = String(bVal).toLowerCase()
      if (aStr < bStr) return sortDir === 'asc' ? -1 : 1
      if (aStr > bStr) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }, [data, sortKey, sortDir])

  // ── Pagination ───────────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const start = (safePage - 1) * pageSize
  const pagedData = sortedData.slice(start, start + pageSize)

  const rangeStart = sortedData.length === 0 ? 0 : start + 1
  const rangeEnd = Math.min(safePage * pageSize, sortedData.length)

  return (
    <div className={cn('w-full border border-border-warm rounded bg-surface', className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-end px-4 py-3 border-b border-border-warm">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => exportToCSV(columns as DataTableColumn[], data as Record<string, unknown>[])}
          className="gap-1.5"
        >
          <Download size={14} aria-hidden="true" />
          Export CSV
        </Button>
      </div>

      {/* Table */}
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {columns.map((col) => (
              <TableHead
                key={col.key}
                onClick={col.sortable ? () => handleSort(col.key) : undefined}
                className={cn(
                  col.sortable && 'cursor-pointer select-none group',
                  col.sortable && 'hover:text-primary'
                )}
              >
                <span className="inline-flex items-center gap-1">
                  {col.label}
                  {col.sortable && (
                    <span className="inline-flex flex-col" aria-hidden="true">
                      {sortKey === col.key && sortDir === 'asc' ? (
                        <ChevronUp
                          size={12}
                          className="text-primary"
                        />
                      ) : sortKey === col.key && sortDir === 'desc' ? (
                        <ChevronDown
                          size={12}
                          className="text-primary"
                        />
                      ) : (
                        <ChevronDown
                          size={12}
                          className="text-muted-text opacity-0 group-hover:opacity-100 transition-opacity"
                        />
                      )}
                    </span>
                  )}
                </span>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>

        <TableBody>
          {pagedData.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <td colSpan={columns.length}>
                <EmptyState
                  title="No data yet"
                  description="There is nothing to display here at the moment."
                />
              </td>
            </TableRow>
          ) : (
            pagedData.map((row, rowIndex) => (
              <TableRow key={rowIndex}>
                {columns.map((col) => (
                  <TableCell key={col.key}>
                    {col.render
                      ? col.render(row[col.key], row)
                      : (row[col.key] as React.ReactNode) ?? '—'}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {/* Pagination */}
      {sortedData.length > 0 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-border-warm">
          {/* Count label */}
          <span className="text-[12px] leading-[1.3] font-[400] font-public-sans text-muted-text">
            Showing {rangeStart}&ndash;{rangeEnd} of {sortedData.length}
          </span>

          {/* Prev / Next */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              aria-label="Previous page"
            >
              Prev
            </Button>

            <span className="text-[12px] font-[500] font-public-sans text-muted-text px-2 select-none tabular-nums">
              {safePage} / {totalPages}
            </span>

            <Button
              variant="ghost"
              size="sm"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              aria-label="Next page"
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
