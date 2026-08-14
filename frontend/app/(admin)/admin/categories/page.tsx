'use client'

import { useState } from 'react'
import { Plus, Pencil, Trash2, ChevronRight, ChevronDown, FolderTree, AlertTriangle, X, EyeOff, RotateCcw } from 'lucide-react'
import {
  useAdminCategoryTree,
  useCreateCategory,
  useUpdateCategory,
  useArchiveCategory,
  useRestoreCategory,
} from '@/hooks/queries/useCategories'
import type { CategoryNode } from '@/types'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const INPUT_CLS =
  'w-full h-10 px-3 rounded border border-border-warm bg-muted-bg/30 text-[14px] font-public-sans text-primary placeholder:text-muted-text/40 focus:outline-none focus:border-accent transition-colors'

// ─── Create / edit modal ───────────────────────────────────────────────────────

interface FormTarget {
  mode: 'create' | 'edit'
  parentId?: string
  parentName?: string
  level: 1 | 2 | 3
  category?: CategoryNode
}

function CategoryFormModal({
  target, onClose, onSubmit, submitting,
}: {
  target: FormTarget
  onClose: () => void
  onSubmit: (data: { name: string; description?: string; heroImage?: string; sortOrder?: number }) => void
  submitting: boolean
}) {
  const [name, setName] = useState(target.category?.name ?? '')
  const [description, setDescription] = useState(target.category?.description ?? '')
  const [heroImage, setHeroImage] = useState(target.category?.heroImage ?? '')
  const [sortOrder, setSortOrder] = useState(target.category?.sortOrder != null ? String(target.category.sortOrder) : '')

  const heading = target.mode === 'edit'
    ? `Edit "${target.category?.name}"`
    : target.parentName
      ? `Add L${target.level} subcategory under "${target.parentName}"`
      : 'Add top-level (L1) category'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md bg-surface border border-border-warm rounded-xl shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-warm">
          <h2 className="text-[16px] font-[600] font-public-sans text-primary">{heading}</h2>
          <button type="button" onClick={onClose} className="text-muted-text hover:text-primary transition-colors">
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-[12px] font-[600] font-public-sans text-muted-text uppercase tracking-[0.05em] mb-1.5">
              Name
            </label>
            <input
              type="text" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Home Décor & Living" className={INPUT_CLS} autoFocus
            />
          </div>
          <div>
            <label className="block text-[12px] font-[600] font-public-sans text-muted-text uppercase tracking-[0.05em] mb-1.5">
              Description <span className="normal-case font-[400] text-muted-text/70">(optional)</span>
            </label>
            <textarea
              value={description ?? ''} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={300}
              className="w-full px-3 py-2 rounded border border-border-warm bg-muted-bg/30 text-[14px] font-public-sans text-primary placeholder:text-muted-text/40 focus:outline-none focus:border-accent transition-colors resize-none"
            />
          </div>
          <div>
            <label className="block text-[12px] font-[600] font-public-sans text-muted-text uppercase tracking-[0.05em] mb-1.5">
              Hero Image URL <span className="normal-case font-[400] text-muted-text/70">(optional)</span>
            </label>
            <input
              type="text" value={heroImage ?? ''} onChange={(e) => setHeroImage(e.target.value)}
              placeholder="https://…" className={INPUT_CLS}
            />
          </div>
          <div>
            <label className="block text-[12px] font-[600] font-public-sans text-muted-text uppercase tracking-[0.05em] mb-1.5">
              Sort Order <span className="normal-case font-[400] text-muted-text/70">(optional — lower shows first)</span>
            </label>
            <input
              type="number" min={0} value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}
              placeholder="e.g. 1" className={INPUT_CLS}
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="ghost" size="sm" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button
              variant="primary" size="sm" className="flex-1"
              disabled={!name.trim() || submitting}
              onClick={() => onSubmit({
                name: name.trim(),
                description: description.trim() || undefined,
                heroImage: heroImage.trim() || undefined,
                sortOrder: sortOrder !== '' ? Number(sortOrder) : undefined,
              })}
            >
              {submitting ? 'Saving…' : target.mode === 'create' ? 'Create' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Archive / restore modal ────────────────────────────────────────────────────

function RemoveModal({
  category, onClose, onArchive, onRestore, pending,
}: {
  category: CategoryNode
  onClose: () => void
  onArchive: () => void
  onRestore: () => void
  pending: boolean
}) {
  const isActive = category.status === 'ACTIVE'
  const childCount = category.children?.length ?? 0
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md bg-surface border border-border-warm rounded-xl shadow-xl p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2.5">
          <AlertTriangle size={18} className="text-error shrink-0" />
          <h2 className="text-[16px] font-[600] font-public-sans text-primary">
            {isActive ? 'Archive' : 'Restore'} &quot;{category.name}&quot;
          </h2>
        </div>
        <div className="text-[13.5px] font-public-sans text-muted-text leading-relaxed space-y-2">
          {isActive ? (
            <p>
              Archiving hides this category (and its subcategories) from buyers and sellers. It is
              <strong className="text-error"> blocked if any active products are still assigned</strong> to it or its
              descendants — reassign those products first if archiving fails.
              {childCount > 0 && (
                <> This category has {childCount} subcategor{childCount === 1 ? 'y' : 'ies'} which will be archived along with it.</>
              )}
            </p>
          ) : (
            <p>Restoring makes this category (and its previously active descendants) visible again.</p>
          )}
        </div>
        <div className="flex flex-col gap-2 pt-2">
          {isActive ? (
            <button
              type="button" onClick={onArchive} disabled={pending}
              className="h-9 px-4 rounded bg-error text-white text-[13px] font-[600] font-public-sans hover:bg-error/90 transition-colors disabled:opacity-50"
            >
              {pending ? 'Archiving…' : 'Archive Category'}
            </button>
          ) : (
            <button
              type="button" onClick={onRestore} disabled={pending}
              className="h-9 px-4 rounded bg-success text-white text-[13px] font-[600] font-public-sans hover:opacity-90 transition-colors disabled:opacity-50"
            >
              {pending ? 'Restoring…' : 'Restore Category'}
            </button>
          )}
          <button type="button" onClick={onClose} className="text-[12px] font-public-sans text-muted-text hover:text-primary transition-colors pt-1 self-center">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Tree row (recursive) ──────────────────────────────────────────────────────

function CategoryRow({
  node, depth, onEdit, onAddChild, onRemove,
}: {
  node: CategoryNode
  depth: number
  onEdit: (n: CategoryNode) => void
  onAddChild: (n: CategoryNode) => void
  onRemove: (n: CategoryNode) => void
}) {
  const [expanded, setExpanded] = useState(depth === 0)
  const children = node.children ?? []
  const hasChildren = children.length > 0
  const isActive = node.status === 'ACTIVE'
  const canHaveChildren = node.level < 3 // L1 and L2 can have children; L3 is the leaf level

  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-2 py-2.5 px-3 rounded hover:bg-muted-bg/40 transition-colors group',
          !isActive && 'opacity-50',
        )}
        style={{ paddingLeft: `${12 + depth * 24}px` }}
      >
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className={cn('shrink-0 text-muted-text hover:text-primary transition-colors', !hasChildren && 'invisible')}
          aria-label={expanded ? 'Collapse' : 'Expand'}
        >
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>

        <span className="text-[14px] font-[500] font-public-sans text-primary flex-1 min-w-0 truncate">
          {node.name}
        </span>

        <span className="text-[10px] font-[700] font-public-sans text-muted-text bg-muted-bg px-1.5 py-0.5 rounded shrink-0">
          L{node.level}
        </span>

        {!isActive && (
          <span className="inline-flex items-center gap-1 text-[11px] font-[600] font-public-sans text-muted-text bg-muted-bg px-2 py-0.5 rounded shrink-0">
            <EyeOff size={10} />Archived
          </span>
        )}

        <span className="text-[11px] font-public-sans text-muted-text shrink-0">
          {node.productCount} product{node.productCount === 1 ? '' : 's'}
        </span>

        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          {canHaveChildren && (
            <button
              type="button" onClick={() => onAddChild(node)}
              title="Add subcategory"
              className="w-7 h-7 flex items-center justify-center rounded text-muted-text hover:text-accent hover:bg-accent/10 transition-colors"
            >
              <Plus size={13} />
            </button>
          )}
          <button
            type="button" onClick={() => onEdit(node)}
            title="Edit"
            className="w-7 h-7 flex items-center justify-center rounded text-muted-text hover:text-primary hover:bg-muted-bg transition-colors"
          >
            <Pencil size={13} />
          </button>
          <button
            type="button" onClick={() => onRemove(node)}
            title={isActive ? 'Archive' : 'Restore'}
            className="w-7 h-7 flex items-center justify-center rounded text-muted-text hover:text-error hover:bg-error/10 transition-colors"
          >
            {isActive ? <Trash2 size={13} /> : <RotateCcw size={13} />}
          </button>
        </div>
      </div>

      {expanded && hasChildren && (
        <div>
          {children.map((child) => (
            <CategoryRow key={child.id} node={child} depth={depth + 1} onEdit={onEdit} onAddChild={onAddChild} onRemove={onRemove} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminCategoriesPage() {
  const { data: tree = [], isLoading } = useAdminCategoryTree()
  const createCategory = useCreateCategory()
  const updateCategory = useUpdateCategory()
  const archiveCategory = useArchiveCategory()
  const restoreCategory = useRestoreCategory()

  const [formTarget, setFormTarget] = useState<FormTarget | null>(null)
  const [removeTarget, setRemoveTarget] = useState<CategoryNode | null>(null)

  function handleFormSubmit(data: { name: string; description?: string; heroImage?: string; sortOrder?: number }) {
    if (!formTarget) return
    if (formTarget.mode === 'create') {
      createCategory.mutate(
        { ...data, level: formTarget.level, parentId: formTarget.parentId },
        { onSuccess: () => setFormTarget(null) }
      )
    } else if (formTarget.category) {
      updateCategory.mutate(
        { id: formTarget.category.id, data },
        { onSuccess: () => setFormTarget(null) }
      )
    }
  }

  const totalCount = (() => {
    let n = 0
    const walk = (nodes: CategoryNode[]) => { for (const c of nodes) { n++; walk(c.children ?? []) } }
    walk(tree)
    return n
  })()

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] leading-[1.3] font-[500] font-playfair text-primary">Categories</h1>
          <p className="text-[14px] font-public-sans text-muted-text mt-1">
            {totalCount > 0 ? `${totalCount} categories across the L1 → L2 → L3 taxonomy` : 'Manage the product category taxonomy'}
          </p>
        </div>
        <Button
          variant="primary" size="md" className="gap-1.5 flex-shrink-0"
          onClick={() => setFormTarget({ mode: 'create', level: 1 })}
        >
          <Plus size={14} aria-hidden="true" />
          Add Category
        </Button>
      </div>

      <div className="bg-surface border border-border-warm rounded overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-9 bg-muted-bg rounded animate-pulse" />
            ))}
          </div>
        ) : tree.length === 0 ? (
          <div className="py-16 flex flex-col items-center gap-3 text-center">
            <div className="w-12 h-12 rounded-full bg-muted-bg flex items-center justify-center">
              <FolderTree size={22} className="text-muted-text" aria-hidden="true" />
            </div>
            <p className="text-[15px] font-[600] font-public-sans text-primary">No categories yet</p>
            <p className="text-[13px] font-public-sans text-muted-text">Add your first top-level category to get started.</p>
          </div>
        ) : (
          <div className="py-2">
            {tree.map((node) => (
              <CategoryRow
                key={node.id}
                node={node}
                depth={0}
                onEdit={(n) => setFormTarget({ mode: 'edit', category: n, level: n.level })}
                onAddChild={(n) => setFormTarget({ mode: 'create', parentId: n.id, parentName: n.name, level: (n.level + 1) as 1 | 2 | 3 })}
                onRemove={setRemoveTarget}
              />
            ))}
          </div>
        )}
      </div>

      {formTarget && (
        <CategoryFormModal
          target={formTarget}
          onClose={() => setFormTarget(null)}
          onSubmit={handleFormSubmit}
          submitting={createCategory.isPending || updateCategory.isPending}
        />
      )}

      {removeTarget && (
        <RemoveModal
          category={removeTarget}
          pending={archiveCategory.isPending || restoreCategory.isPending}
          onClose={() => setRemoveTarget(null)}
          onArchive={() =>
            archiveCategory.mutate(removeTarget.id, { onSuccess: () => setRemoveTarget(null) })
          }
          onRestore={() =>
            restoreCategory.mutate(removeTarget.id, { onSuccess: () => setRemoveTarget(null) })
          }
        />
      )}
    </div>
  )
}
