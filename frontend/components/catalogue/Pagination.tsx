'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

type PageItem = number | 'gap-start' | 'gap-end'

/** 1 … (current-1) current (current+1) … last — at most 7 items. */
function pageItems(current: number, total: number): PageItem[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const items: PageItem[] = [1]
  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)
  if (start > 2) items.push('gap-start')
  for (let p = start; p <= end; p += 1) items.push(p)
  if (end < total - 1) items.push('gap-end')
  items.push(total)
  return items
}

const ITEM =
  'inline-flex items-center justify-center min-w-12 h-12 px-3 rounded-[4px] border text-[14px] leading-[20px] font-[600] transition-colors duration-150'

interface PaginationProps {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
  className?: string
}

/** 48px targets, 8px gaps on mobile / 12px on desktop, 32px above. */
export function Pagination({ page, totalPages, onPageChange, className }: PaginationProps) {
  if (totalPages <= 1) return null
  const items = pageItems(page, totalPages)

  return (
    <nav aria-label="Pagination" className={cn('mt-8', className)}>
      <ul className="flex flex-wrap items-center justify-center gap-2 lg:gap-3">
        <li>
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className={cn(
              ITEM,
              'gap-1 border-line bg-white text-forest hover:border-forest disabled:text-muted disabled:border-line disabled:bg-white disabled:cursor-not-allowed'
            )}
          >
            <ChevronLeft size={16} aria-hidden="true" />
            <span className="hidden sm:inline">Previous</span>
            <span className="sr-only sm:hidden">Previous page</span>
          </button>
        </li>

        {items.map((item) =>
          typeof item === 'number' ? (
            <li key={item} className={cn(item !== page && item !== 1 && item !== totalPages && 'hidden sm:block')}>
              <button
                type="button"
                onClick={() => onPageChange(item)}
                aria-current={item === page ? 'page' : undefined}
                aria-label={`Page ${item}`}
                className={cn(
                  ITEM,
                  item === page
                    ? 'bg-forest border-forest text-white'
                    : 'bg-white border-line text-ink hover:border-forest'
                )}
              >
                {item}
              </button>
            </li>
          ) : (
            <li key={item} aria-hidden="true" className="hidden sm:inline-flex items-center justify-center w-6 h-12 text-muted">
              …
            </li>
          )
        )}

        <li>
          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className={cn(
              ITEM,
              'gap-1 border-line bg-white text-forest hover:border-forest disabled:text-muted disabled:border-line disabled:bg-white disabled:cursor-not-allowed'
            )}
          >
            <span className="hidden sm:inline">Next</span>
            <span className="sr-only sm:hidden">Next page</span>
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        </li>
      </ul>
      <p className="mt-3 text-center type-caption text-muted sm:hidden">
        Page {page} of {totalPages}
      </p>
    </nav>
  )
}
