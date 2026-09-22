'use client'

import { useMemo, useRef, useState, useEffect } from 'react'
import type { CategoryNode } from '@/types'
import { categoryPathLabel } from '@/components/seller-portal/CategoryCascade'

interface Leaf {
  id: string
  name: string
  path: string
}

function flattenLeaves(tree: CategoryNode[]): Leaf[] {
  const leaves: Leaf[] = []
  function walk(nodes: CategoryNode[], trail: string[]) {
    for (const node of nodes) {
      const nextTrail = [...trail, node.name]
      if (node.children?.length) {
        walk(node.children, nextTrail)
      } else {
        leaves.push({ id: node.id, name: node.name, path: nextTrail.join(' > ') })
      }
    }
  }
  walk(tree, [])
  return leaves
}

interface CategoryTypeaheadProps {
  tree: CategoryNode[]
  value: string
  onChange: (id: string) => void
  disabled?: boolean
  className: string
}

/** Search-as-you-type product-type picker — matches results by name, shows each
 *  result's full category path, and only commits a value when a result is picked. */
export function CategoryTypeahead({ tree, value, onChange, disabled, className }: CategoryTypeaheadProps) {
  const leaves = useMemo(() => flattenLeaves(tree), [tree])
  const selected = leaves.find((l) => l.id === value)
  // `query` is the only source of truth for the search text — every place that
  // changes `value` (pick() below, and the clear-on-diverge in the input's
  // onChange) already sets `query` itself in the same call, so no effect is
  // needed to keep them in sync (and one would fight the input's own typing).
  const [query, setQuery] = useState(selected?.name ?? '')
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])

  const q = query.trim().toLowerCase()
  const results = q && query !== selected?.name ? leaves.filter((l) => l.name.toLowerCase().includes(q)).slice(0, 8) : []

  function pick(leaf: Leaf) {
    onChange(leaf.id)
    setQuery(leaf.name)
    setOpen(false)
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        disabled={disabled}
        value={query}
        onChange={(e) => {
          const next = e.target.value
          setQuery(next)
          setOpen(true)
          if (value && next !== selected?.name) onChange('')
        }}
        onFocus={() => setOpen(true)}
        placeholder="Example: Skirt, Baking Mix, Dog Collar, etc"
        className={className}
      />
      {open && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 z-30 bg-surface border border-border-warm rounded shadow-lg max-h-72 overflow-y-auto py-1">
          {results.map((leaf) => (
            <button key={leaf.id} type="button" onClick={() => pick(leaf)}
              className="w-full text-left px-4 py-3 hover:bg-muted-bg/60 transition-colors">
              <div className="text-[15px] font-[700] font-sans text-primary">{leaf.name}</div>
              <div className="text-[12px] font-sans text-muted-text mt-0.5">{leaf.path}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export { categoryPathLabel }
