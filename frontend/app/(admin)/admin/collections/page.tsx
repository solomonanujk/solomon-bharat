'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, ImageOff, Star } from 'lucide-react'
import { useAdminCollections, useCreateCollection } from '@/hooks/queries/useCollections'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { EmptyState } from '@/components/shared/EmptyState'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import type { Collection, CollectionStatus } from '@/types'

const PAGE_LIMIT = 20

const STATUS_TABS: { value: CollectionStatus | ''; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SCHEDULED', label: 'Scheduled' },
  { value: 'PUBLISHED', label: 'Published' },
  { value: 'ARCHIVED', label: 'Archived' },
]

// ─── Create dialog ──────────────────────────────────────────────────────────────

function CreateCollectionDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (collection: Collection) => void
}) {
  const [name, setName] = useState('')
  const [heroImage, setHeroImage] = useState('')
  const [editorialIntro, setEditorialIntro] = useState('')
  const [isFeatured, setIsFeatured] = useState(false)
  const createCollection = useCreateCollection()

  function reset() {
    setName('')
    setHeroImage('')
    setEditorialIntro('')
    setIsFeatured(false)
  }

  function handleSubmit() {
    if (!name.trim()) return
    createCollection.mutate(
      {
        name: name.trim(),
        heroImage: heroImage.trim() || undefined,
        editorialIntro: editorialIntro.trim() || undefined,
        isFeatured,
      },
      {
        onSuccess: (created) => {
          reset()
          onOpenChange(false)
          onCreated(created)
        },
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset() }}>
      <DialogContent className="max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Create Collection</DialogTitle>
        </DialogHeader>
        <div className="px-6 pb-2 space-y-4">
          <div>
            <Label htmlFor="collection-name">Name</Label>
            <Input
              id="collection-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Monsoon Textiles"
              autoFocus
            />
          </div>
          <div>
            <Label htmlFor="collection-hero-image">Hero image URL</Label>
            <Input
              id="collection-hero-image"
              value={heroImage}
              onChange={(e) => setHeroImage(e.target.value)}
              placeholder="https://…"
            />
          </div>
          <div>
            <Label htmlFor="collection-intro">Editorial intro</Label>
            <textarea
              id="collection-intro"
              value={editorialIntro}
              onChange={(e) => setEditorialIntro(e.target.value)}
              rows={3}
              placeholder="A short editorial blurb shown on the homepage…"
              className="w-full px-3 py-2 rounded border border-border-warm bg-surface text-[14px] font-public-sans text-primary placeholder:text-muted-text/60 focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent transition-colors resize-none"
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isFeatured}
              onChange={(e) => setIsFeatured(e.target.checked)}
              className="w-4 h-4 rounded border-border-warm accent-accent cursor-pointer"
            />
            <span className="text-[13px] font-public-sans text-primary">Feature on homepage</span>
          </label>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!name.trim() || createCollection.isPending}
            onClick={handleSubmit}
          >
            {createCollection.isPending ? 'Creating…' : 'Create Collection'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminCollectionsPage() {
  const router = useRouter()
  const [status, setStatus] = useState<CollectionStatus | ''>('')
  const [page, setPage] = useState(1)
  const [createOpen, setCreateOpen] = useState(false)

  const { data, isLoading } = useAdminCollections({
    status: status || undefined,
    page,
    limit: PAGE_LIMIT,
  })

  const items = data?.items ?? []
  const total = data?.total ?? 0
  const limit = data?.limit ?? PAGE_LIMIT
  const totalPages = data?.totalPages ?? 1

  // The admin list endpoint may or may not populate `products` per collection.
  // Only render the product-count column when at least one row actually has it,
  // rather than triggering an N+1 fetch just to show a count.
  const hasProductCounts = useMemo(() => items.some((c) => c.products !== undefined), [items])

  function handleTabChange(value: CollectionStatus | '') {
    setStatus(value)
    setPage(1)
  }

  return (
    <div>
      <div className="mb-2 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[28px] leading-[1.3] font-[500] font-playfair text-primary">Collections</h1>
          <p className="text-[14px] font-public-sans text-muted-text mt-1">
            Curate homepage-featured product groupings — {total.toLocaleString()} total
          </p>
        </div>
        <Button variant="primary" size="md" className="gap-1.5 flex-shrink-0" onClick={() => setCreateOpen(true)}>
          <Plus size={14} aria-hidden="true" />
          Create Collection
        </Button>
      </div>

      <p className="text-[13px] font-public-sans text-muted-text mb-6 px-4 py-2.5 rounded border border-border-warm bg-muted-bg/40">
        Featured collections with images and an intro appear on the homepage — this is the homepage content control
        since there&apos;s no separate CMS module.
      </p>

      {/* Status tabs */}
      <div className="flex gap-1 mb-4 border-b border-border-warm overflow-x-auto">
        {STATUS_TABS.map(({ value, label }) => (
          <button
            key={label}
            type="button"
            onClick={() => handleTabChange(value)}
            className={cn(
              'px-4 py-2.5 text-[13px] font-[600] font-public-sans border-b-2 -mb-px transition-colors whitespace-nowrap',
              status === value ? 'border-primary text-primary' : 'border-transparent text-muted-text hover:text-primary'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="bg-surface border border-border-warm rounded overflow-hidden">
        {isLoading ? (
          <div className="divide-y divide-border-warm">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="p-4 flex gap-4 animate-pulse">
                <div className="w-9 h-9 bg-muted-bg rounded flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 bg-muted-bg rounded w-40" />
                  <div className="h-3 bg-muted-bg rounded w-24" />
                </div>
                <div className="h-5 bg-muted-bg rounded w-16" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            title="No collections yet"
            description="Create your first collection to start curating homepage content."
            action={{ label: 'Create Collection', onClick: () => setCreateOpen(true) }}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border-warm bg-muted-bg/40">
                    {[
                      { label: '', align: 'left' },
                      { label: 'Name', align: 'left' },
                      { label: 'Featured', align: 'center' },
                      { label: 'Status', align: 'left' },
                      ...(hasProductCounts ? [{ label: 'Products', align: 'center' as const }] : []),
                      { label: 'Created', align: 'left' },
                    ].map(({ label, align }, i) => (
                      <th
                        key={label || `col-${i}`}
                        className={cn(
                          'py-3 px-4 text-[12px] font-[600] font-public-sans text-muted-text uppercase tracking-[0.06em]',
                          align === 'center' ? 'text-center' : 'text-left'
                        )}
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((c) => (
                    <tr
                      key={c.id}
                      onClick={() => router.push(`/admin/collections/${c.id}`)}
                      className="border-b border-border-warm last:border-0 hover:bg-muted-bg/30 transition-colors cursor-pointer"
                    >
                      <td className="py-3 pl-4 pr-0 w-[52px]">
                        {c.heroImage ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={c.heroImage} alt="" className="w-9 h-9 rounded object-cover border border-border-warm" />
                        ) : (
                          <div className="w-9 h-9 rounded bg-muted-bg border border-border-warm flex items-center justify-center">
                            <ImageOff size={14} className="text-muted-text" aria-hidden="true" />
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <p className="text-[13px] font-[600] font-public-sans text-primary">{c.name}</p>
                        <p className="text-[11px] font-public-sans text-muted-text">/{c.slug}</p>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {c.isFeatured ? (
                          <Star size={14} className="text-accent fill-accent inline-block" aria-label="Featured" />
                        ) : (
                          <span className="text-muted-text">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4"><StatusBadge status={c.status} /></td>
                      {hasProductCounts && (
                        <td className="py-3 px-4 text-center text-[13px] font-public-sans text-muted-text">
                          {c.products?.length ?? 0}
                        </td>
                      )}
                      <td className="py-3 px-4 text-[12px] font-public-sans text-muted-text whitespace-nowrap">
                        {new Date(c.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border-warm">
                <p className="text-[12px] font-public-sans text-muted-text">
                  {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total.toLocaleString()}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="h-8 px-3 rounded border border-border-warm text-[12px] font-[500] font-public-sans text-muted-text hover:text-primary hover:bg-muted-bg disabled:opacity-40 transition-colors"
                  >
                    Prev
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="h-8 px-3 rounded border border-border-warm text-[12px] font-[500] font-public-sans text-muted-text hover:text-primary hover:bg-muted-bg disabled:opacity-40 transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <CreateCollectionDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(created) => router.push(`/admin/collections/${created.id}`)}
      />
    </div>
  )
}
