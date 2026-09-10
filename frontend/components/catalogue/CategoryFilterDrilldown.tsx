'use client'

import { useState } from 'react'
import { useCategoryTree } from '@/hooks/queries/useCategories'
import { cn } from '@/lib/utils'
import type { CategoryNode } from '@/types'

const VISIBLE_COLLAPSED = 4

/** Walks the 3-level tree to find the root-to-node path for `id`, at any level. */
function findPath(tree: CategoryNode[], id: string | null | undefined): CategoryNode[] {
  if (!id) return []
  for (const l1 of tree) {
    if (l1.id === id) return [l1]
    for (const l2 of l1.children ?? []) {
      if (l2.id === id) return [l1, l2]
      for (const l3 of l2.children ?? []) {
        if (l3.id === id) return [l1, l2, l3]
      }
    }
  }
  return []
}

function Row({ label, active, indent, onClick }: { label: string; active: boolean; indent?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'block text-left py-1.5 text-[14px] font-public-sans transition-colors',
        indent && 'pl-4',
        active ? 'text-primary underline underline-offset-2' : 'text-primary hover:opacity-70'
      )}
    >
      {label}
    </button>
  )
}

function ShowMoreToggle({ expanded, onClick, indent }: { expanded: boolean; onClick: () => void; indent?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'text-left py-1.5 text-[14px] font-[500] font-public-sans text-primary underline underline-offset-2 hover:opacity-70 transition-opacity',
        indent && 'pl-4'
      )}
    >
      {expanded ? 'Show less' : 'Show more'}
    </button>
  )
}

interface CategoryFilterDrilldownProps {
  /** A category id at any level (L1 or L2) — the backend already resolves any
   *  level to its full set of leaf-descendant products. */
  value: string | null
  onChange: (categoryId: string | null) => void
}

/**
 * Faire-style category filter: "All categories" is always the first, permanent
 * row (clicking it clears the selection). Below it: with nothing selected, every
 * Level-1 category (collapsed to 4 with a "Show more"); picking one replaces the
 * L1 list with just that L1 (still clickable/underlined-when-active) plus its own
 * Level-2 children indented beneath (same collapse-to-4 pattern).
 */
export function CategoryFilterDrilldown({ value, onChange }: CategoryFilterDrilldownProps) {
  const { data: tree = [] } = useCategoryTree()
  const path = findPath(tree, value)
  const selectedL1 = path[0] ?? null
  const selectedL2 = path[1] ?? null

  const [expandedL1, setExpandedL1] = useState(false)
  const [expandedL2, setExpandedL2] = useState(false)

  // Collapse the L2 list back to 4 whenever the selected L1 itself changes —
  // adjusting state during render (React's documented pattern) rather than an
  // effect, so it takes effect in the same paint.
  const [lastL1Id, setLastL1Id] = useState(selectedL1?.id ?? null)
  if ((selectedL1?.id ?? null) !== lastL1Id) {
    setLastL1Id(selectedL1?.id ?? null)
    setExpandedL2(false)
  }

  if (!selectedL1) {
    const visible = expandedL1 ? tree : tree.slice(0, VISIBLE_COLLAPSED)
    return (
      <div className="flex flex-col">
        <Row label="All categories" active={!value} onClick={() => onChange(null)} />
        {visible.map((l1) => (
          <Row key={l1.id} label={l1.name} active={false} onClick={() => onChange(l1.id)} />
        ))}
        {tree.length > VISIBLE_COLLAPSED && (
          <ShowMoreToggle expanded={expandedL1} onClick={() => setExpandedL1((v) => !v)} />
        )}
      </div>
    )
  }

  const l2Children = selectedL1.children ?? []
  const visibleL2 = expandedL2 ? l2Children : l2Children.slice(0, VISIBLE_COLLAPSED)

  return (
    <div className="flex flex-col">
      <Row label="All categories" active={false} onClick={() => onChange(null)} />
      <Row label={selectedL1.name} active={!selectedL2} onClick={() => onChange(selectedL1.id)} />
      {visibleL2.map((l2) => (
        <Row key={l2.id} label={l2.name} active={selectedL2?.id === l2.id} indent onClick={() => onChange(l2.id)} />
      ))}
      {l2Children.length > VISIBLE_COLLAPSED && (
        <ShowMoreToggle expanded={expandedL2} onClick={() => setExpandedL2((v) => !v)} indent />
      )}
    </div>
  )
}
