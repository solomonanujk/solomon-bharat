'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, ChevronRight } from 'lucide-react'
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

// ─── Single flyout selector (Level 1 → hover → Level 2 → hover → Level 3) ──────
// `value` is always a Level-3 (leaf) category id or null/empty. One trigger opens
// a panel listing every Level-1 category; hovering (or focusing/tapping) a Level-1
// row reveals its Level-2 children in a second column, and hovering a Level-2 row
// reveals its Level-3 children in a third column. Only picking a Level-3 leaf
// commits a value via `onChange` — same contract as before, just a different UI.

const COLUMN_CLS = 'w-52 max-h-72 overflow-y-auto py-1'
const ROW_BASE_CLS =
  'w-full flex items-center justify-between gap-2 px-3 py-2 text-[13px] font-public-sans text-left transition-colors'

interface CategoryCascadeSelectProps {
  tree: CategoryNode[]
  value: string
  onChange: (level3Id: string) => void
  disabled?: boolean
}

export function CategoryCascadeSelect({ tree, value, onChange, disabled }: CategoryCascadeSelectProps) {
  const [open, setOpen] = useState(false)
  const initialPath = findCategoryPath(tree, value)
  const [activeL1, setActiveL1] = useState(initialPath[0]?.id ?? '')
  const [activeL2, setActiveL2] = useState(initialPath[1]?.id ?? '')
  const containerRef = useRef<HTMLDivElement>(null)

  // Re-sync active columns if the committed value or tree changes from outside
  // (e.g. tree finishes loading after `value` was already set).
  useEffect(() => {
    const path = findCategoryPath(tree, value)
    setActiveL1(path[0]?.id ?? '')
    setActiveL2(path[1]?.id ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, tree.length])

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  const l2Options = tree.find((c) => c.id === activeL1)?.children ?? []
  const l3Options = l2Options.find((c) => c.id === activeL2)?.children ?? []

  function selectLeaf(id: string) {
    onChange(id)
    setOpen(false)
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="w-full h-10 px-3 rounded border border-border-warm bg-muted-bg/30 text-[14px] font-public-sans focus:outline-none focus:border-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-between gap-2"
      >
        <span className={`truncate ${value ? 'text-primary' : 'text-muted-text/40'}`}>
          {value ? categoryPathLabel(tree, value) : 'Select category…'}
        </span>
        <ChevronRight size={14} className={`text-muted-text shrink-0 transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-30 flex bg-surface border border-border-warm rounded shadow-lg overflow-hidden">
          <div className={COLUMN_CLS + ' border-r border-border-warm'}>
            {tree.map((l1) => (
              <button
                key={l1.id}
                type="button"
                onMouseEnter={() => { setActiveL1(l1.id); setActiveL2('') }}
                onFocus={() => { setActiveL1(l1.id); setActiveL2('') }}
                className={`${ROW_BASE_CLS} ${activeL1 === l1.id ? 'bg-muted-bg text-primary' : 'text-primary hover:bg-muted-bg/60'}`}
              >
                <span className="truncate">{l1.name}</span>
                {(l1.children?.length ?? 0) > 0 && <ChevronRight size={12} className="text-muted-text shrink-0" />}
              </button>
            ))}
          </div>

          {activeL1 && l2Options.length > 0 && (
            <div className={COLUMN_CLS + ' border-r border-border-warm'}>
              {l2Options.map((l2) => (
                <button
                  key={l2.id}
                  type="button"
                  onMouseEnter={() => setActiveL2(l2.id)}
                  onFocus={() => setActiveL2(l2.id)}
                  className={`${ROW_BASE_CLS} ${activeL2 === l2.id ? 'bg-muted-bg text-primary' : 'text-primary hover:bg-muted-bg/60'}`}
                >
                  <span className="truncate">{l2.name}</span>
                  {(l2.children?.length ?? 0) > 0 && <ChevronRight size={12} className="text-muted-text shrink-0" />}
                </button>
              ))}
            </div>
          )}

          {activeL2 && l3Options.length > 0 && (
            <div className={COLUMN_CLS}>
              {l3Options.map((l3) => (
                <button
                  key={l3.id}
                  type="button"
                  onClick={() => selectLeaf(l3.id)}
                  className={`${ROW_BASE_CLS} ${value === l3.id ? 'bg-primary text-white' : 'text-primary hover:bg-muted-bg/60'}`}
                >
                  <span className="truncate">{l3.name}</span>
                  {value === l3.id && <Check size={12} className="shrink-0" />}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
