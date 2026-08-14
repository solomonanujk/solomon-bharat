'use client'

import { useEffect, useState } from 'react'
import type { CategoryNode } from '@/types'

// ─── Path resolution helpers ───────────────────────────────────────────────────
// The 3-level category tree only exposes children nesting — to render
// "Home Décor > Textiles > Table Runners" or to drive the cascade selects below,
// we need to walk the tree to find the L1 → L2 → L3 chain for a given leaf id.

export function findCategoryPath(tree: CategoryNode[], id: string | null | undefined): CategoryNode[] {
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

export function categoryPathLabel(tree: CategoryNode[], id: string | null | undefined): string {
  const path = findCategoryPath(tree, id)
  return path.length ? path.map((c) => c.name).join(' > ') : '—'
}

// ─── Cascading 3-level select ──────────────────────────────────────────────────
// `value` is always a Level-3 (leaf) category id or null/empty. Intermediate
// Level-1/Level-2 picks are local UI state only — they're not valid values on
// their own, so `onChange` only fires once a Level-3 leaf is chosen.

const SELECT_CLS =
  'w-full h-10 px-3 rounded border border-border-warm bg-muted-bg/30 text-[14px] font-public-sans text-primary focus:outline-none focus:border-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed'

interface CategoryCascadeSelectProps {
  tree: CategoryNode[]
  value: string
  onChange: (level3Id: string) => void
  disabled?: boolean
}

export function CategoryCascadeSelect({ tree, value, onChange, disabled }: CategoryCascadeSelectProps) {
  const initialPath = findCategoryPath(tree, value)
  const [l1Id, setL1Id] = useState(initialPath[0]?.id ?? '')
  const [l2Id, setL2Id] = useState(initialPath[1]?.id ?? '')

  // Re-sync local L1/L2 selection if the committed value or tree changes from
  // outside (e.g. tree finishes loading after `value` was already set).
  useEffect(() => {
    const path = findCategoryPath(tree, value)
    setL1Id(path[0]?.id ?? '')
    setL2Id(path[1]?.id ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, tree.length])

  const l2Options = tree.find((c) => c.id === l1Id)?.children ?? []
  const l3Options = l2Options.find((c) => c.id === l2Id)?.children ?? []

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <select
        value={l1Id}
        disabled={disabled}
        onChange={(e) => {
          setL1Id(e.target.value)
          setL2Id('')
          onChange('')
        }}
        className={SELECT_CLS}
      >
        <option value="">Select category…</option>
        {tree.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>

      <select
        value={l2Id}
        disabled={disabled || !l1Id}
        onChange={(e) => {
          setL2Id(e.target.value)
          onChange('')
        }}
        className={SELECT_CLS}
      >
        <option value="">Select subcategory…</option>
        {l2Options.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>

      <select
        value={value}
        disabled={disabled || !l2Id}
        onChange={(e) => onChange(e.target.value)}
        className={SELECT_CLS}
      >
        <option value="">Select type…</option>
        {l3Options.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
    </div>
  )
}
