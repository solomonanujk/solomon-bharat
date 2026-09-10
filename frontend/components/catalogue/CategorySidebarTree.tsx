'use client'

import { cn } from '@/lib/utils'
import type { CategoryNode } from '@/types'

const INDENT_CLASS = { 0: '', 1: 'pl-4', 2: 'pl-8' } as const

function Row({ label, active, level = 0, bold, onClick }: { label: string; active: boolean; level?: 0 | 1 | 2; bold?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'block text-left py-1.5 text-[14px] font-public-sans transition-colors',
        INDENT_CLASS[level],
        active ? 'font-[600] text-primary underline underline-offset-2' : bold ? 'font-[600] text-primary hover:opacity-70' : 'text-primary hover:opacity-70'
      )}
    >
      {label}
    </button>
  )
}

interface CategorySidebarTreeProps {
  /** The current category page's own category — its direct children (and, for
   *  whichever one is selected/expanded, their own children) are listed flat
   *  and indented, all expanded in place at once (not a single-branch
   *  drill-down like /search's site-wide `CategoryFilterDrilldown`). */
  root: Pick<CategoryNode, 'id' | 'name' | 'children'>
  value: string | null
  onChange: (categoryId: string) => void
}

/** Faire-style flat category list scoped to one category: the root itself,
 *  then every direct child, with whichever child is on the selected path
 *  expanded in place (its own children indented beneath it) while its
 *  siblings stay visible and collapsed. */
export function CategorySidebarTree({ root, value, onChange }: CategorySidebarTreeProps) {
  return (
    <div className="flex flex-col">
      <Row label={root.name} active={value === root.id} onClick={() => onChange(root.id)} />
      {(root.children ?? []).map((child) => {
        const childActive = value === child.id
        const grandchildren = child.children ?? []
        const expanded = childActive || grandchildren.some((g) => g.id === value)
        return (
          <div key={child.id}>
            <Row label={child.name} active={childActive} bold={expanded} level={1} onClick={() => onChange(child.id)} />
            {expanded && grandchildren.map((grandchild) => (
              <Row
                key={grandchild.id}
                label={grandchild.name}
                active={value === grandchild.id}
                level={2}
                onClick={() => onChange(grandchild.id)}
              />
            ))}
          </div>
        )
      })}
    </div>
  )
}
