import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

export interface Crumb {
  label: string
  /** Omit for the current page. */
  href?: string
}

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-x-1 text-[14px] leading-[20px]">
        {items.map((item, i) => {
          const last = i === items.length - 1
          return (
            <li key={`${item.label}-${i}`} className="inline-flex items-center gap-1 min-w-0">
              {item.href && !last ? (
                <Link
                  href={item.href}
                  className="inline-flex items-center min-h-11 text-forest underline underline-offset-4 decoration-1 hover:decoration-2"
                >
                  {item.label}
                </Link>
              ) : (
                <span aria-current={last ? 'page' : undefined} className="inline-flex items-center min-h-11 text-muted break-words">
                  {item.label}
                </span>
              )}
              {!last && <ChevronRight size={14} className="text-muted flex-shrink-0" aria-hidden="true" />}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
