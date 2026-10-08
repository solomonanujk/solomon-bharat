'use client'

import { useState } from 'react'
import { useCategoryTree } from '@/hooks/queries/useCategories'
import { FilterOptionButton, FilterTextButton } from '@/components/catalogue/filterControls'
import type { CategoryNode } from '@/types'

const VISIBLE_COLLAPSED = 5

/** Walks the 3-level tree to find the root-to-node path for `id`, at any level. */
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

interface CategoryFilterDrilldownProps {
  /** A category id at any level — the backend resolves any level to its full
   *  set of leaf-descendant products. */
  value: string | null
  onChange: (categoryId: string | null) => void
}

/**
 * Site-wide category facet (search + collection pages). "All categories" is the
 * first row and clears the selection. With nothing selected, every Level-1
 * category is listed; picking one shows it plus its Level-2 children indented
 * beneath (and the Level-3 children of a selected Level-2).
 */
export function CategoryFilterDrilldown({ value, onChange }: CategoryFilterDrilldownProps) {
  const { data: tree = [] } = useCategoryTree()
  const path = findCategoryPath(tree, value)
  const selectedL1 = path[0] ?? null
  const selectedL2 = path[1] ?? null
  const selectedL3 = path[2] ?? null

  const [expandedL1, setExpandedL1] = useState(false)
  const [expandedL2, setExpandedL2] = useState(false)

  // Collapse the L2 list again whenever the selected L1 changes — adjusting
  // state during render (React's documented pattern) rather than in an effect.
  const [lastL1Id, setLastL1Id] = useState(selectedL1?.id ?? null)
  if ((selectedL1?.id ?? null) !== lastL1Id) {
    setLastL1Id(selectedL1?.id ?? null)
    setExpandedL2(false)
  }

  if (!selectedL1) {
    const visible = expandedL1 ? tree : tree.slice(0, VISIBLE_COLLAPSED)
    return (
      <div className="flex flex-col gap-1">
        <FilterOptionButton label="All categories" active={!value} onClick={() => onChange(null)} />
        {visible.map((l1) => (
          <FilterOptionButton key={l1.id} label={l1.name} active={false} onClick={() => onChange(l1.id)} />
        ))}
        {tree.length > VISIBLE_COLLAPSED && (
          <FilterTextButton onClick={() => setExpandedL1((v) => !v)}>
            {expandedL1 ? 'Show fewer categories' : `Show all ${tree.length} categories`}
          </FilterTextButton>
        )}
      </div>
    )
  }

  const l2Children = selectedL1.children ?? []
  const visibleL2 = expandedL2 || selectedL2 ? l2Children : l2Children.slice(0, VISIBLE_COLLAPSED)

  return (
    <div className="flex flex-col gap-1">
      <FilterOptionButton label="All categories" active={false} onClick={() => onChange(null)} />
      <FilterOptionButton
        label={selectedL1.name}
        active={!selectedL2}
        emphasis
        onClick={() => onChange(selectedL1.id)}
      />
      {visibleL2.map((l2) => {
        const onPath = selectedL2?.id === l2.id
        return (
          <div key={l2.id} className="flex flex-col gap-1">
            <FilterOptionButton
              label={l2.name}
              active={onPath && !selectedL3}
              emphasis={onPath}
              indent={1}
              onClick={() => onChange(l2.id)}
            />
            {onPath &&
              (l2.children ?? []).map((l3) => (
                <FilterOptionButton
                  key={l3.id}
                  label={l3.name}
                  active={selectedL3?.id === l3.id}
                  indent={2}
                  onClick={() => onChange(l3.id)}
                />
              ))}
          </div>
        )
      })}
      {!selectedL2 && l2Children.length > VISIBLE_COLLAPSED && (
        <FilterTextButton indent={1} onClick={() => setExpandedL2((v) => !v)}>
          {expandedL2 ? 'Show fewer' : `Show all ${l2Children.length}`}
        </FilterTextButton>
      )}
    </div>
  )
}
