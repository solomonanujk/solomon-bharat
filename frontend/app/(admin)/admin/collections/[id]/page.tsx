'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft,
  ImageOff,
  Package,
  Search,
  Star,
  ArrowUp,
  ArrowDown,
  X,
  Plus,
} from 'lucide-react'
import {
  useAdminCollection,
  useUpdateCollection,
  usePublishCollection,
  useUnpublishCollection,
  useArchiveCollection,
  useFeatureCollection,
  useUnfeatureCollection,
  useAddProductToCollection,
  useReorderCollectionProducts,
  useRemoveProductFromCollection,
} from '@/hooks/queries/useCollections'
import { useAdminProducts } from '@/hooks/queries/useProducts'
import { useImageLightbox } from '@/components/shared/ImageLightbox'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { HeroImageUpload } from '@/components/shared/HeroImageUpload'
import { StatusBadge } from '@/components/shared/StatusBadge'
import type { Product } from '@/types'

// ─── Product row (current membership) ─────────────────────────────────────────

function MemberProductRow({
  product,
  index,
  total,
  onMoveUp,
  onMoveDown,
  onRemove,
  onImageClick,
  disabled,
}: {
  product: Product
  index: number
  total: number
  onMoveUp: () => void
  onMoveDown: () => void
  onRemove: () => void
  onImageClick: (url: string, alt: string) => void
  disabled: boolean
}) {
  const thumb = product.images?.[0]?.url

  return (
    <div className="flex items-center gap-3 py-2.5 px-4 border-b border-border-warm last:border-0">
      <div className="flex flex-col gap-0.5 shrink-0">
        <button
          type="button"
          onClick={onMoveUp}
          disabled={disabled || index === 0}
          aria-label="Move up"
          className="w-6 h-5 flex items-center justify-center rounded text-muted-text hover:text-primary hover:bg-muted-bg disabled:opacity-30 transition-colors"
        >
          <ArrowUp size={12} />
        </button>
        <button
          type="button"
          onClick={onMoveDown}
          disabled={disabled || index === total - 1}
          aria-label="Move down"
          className="w-6 h-5 flex items-center justify-center rounded text-muted-text hover:text-primary hover:bg-muted-bg disabled:opacity-30 transition-colors"
        >
          <ArrowDown size={12} />
        </button>
      </div>

      {thumb ? (
        <button type="button" onClick={() => onImageClick(thumb, product.name)} className="flex-shrink-0 cursor-zoom-in" aria-label={`View ${product.name} full size`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={thumb} alt="" className="w-9 h-9 rounded object-cover border border-border-warm" />
        </button>
      ) : (
        <div className="w-9 h-9 rounded bg-muted-bg border border-border-warm flex items-center justify-center flex-shrink-0">
          <Package size={14} className="text-muted-text" />
        </div>
      )}

      <p className="text-[13px] font-[600] font-public-sans text-primary flex-1 truncate">{product.name}</p>

      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        className="w-7 h-7 flex items-center justify-center rounded text-muted-text hover:text-error hover:bg-error/10 transition-colors disabled:opacity-40"
        aria-label={`Remove ${product.name}`}
      >
        <X size={14} />
      </button>
    </div>
  )
}

// ─── Add-product picker ─────────────────────────────────────────────────────────

function AddProductPicker({
  collectionId,
  existingIds,
  onImageClick,
}: {
  collectionId: string
  existingIds: Set<string>
  onImageClick: (url: string, alt: string) => void
}) {
  const [query, setQuery] = useState('')
  const { data, isLoading } = useAdminProducts({ approvalStatus: 'APPROVED', limit: 100 })
  const addProduct = useAddProductToCollection()

  const results = useMemo(() => {
    const items = data?.items ?? []
    const q = query.trim().toLowerCase()
    const filtered = q ? items.filter((p) => p.name.toLowerCase().includes(q)) : items
    return filtered.slice(0, 20)
  }, [data, query])

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-text" aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search approved products by name…"
          className="w-full h-9 pl-9 pr-3 rounded border border-border-warm bg-surface text-[13px] font-public-sans text-primary placeholder:text-muted-text focus:outline-none focus:border-accent transition-colors"
        />
      </div>

      <div className="border border-border-warm rounded max-h-72 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 text-[13px] font-public-sans text-muted-text">Loading products…</div>
        ) : results.length === 0 ? (
          <div className="p-4 text-[13px] font-public-sans text-muted-text">
            {query ? 'No approved products match your search.' : 'No approved products available.'}
          </div>
        ) : (
          results.map((p) => {
            const alreadyIn = existingIds.has(p.id)
            const thumb = p.images?.[0]?.url
            return (
              <div key={p.id} className="flex items-center gap-3 py-2 px-3 border-b border-border-warm last:border-0">
                {thumb ? (
                  <button type="button" onClick={() => onImageClick(thumb, p.name)} className="flex-shrink-0 cursor-zoom-in" aria-label={`View ${p.name} full size`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={thumb} alt="" className="w-8 h-8 rounded object-cover border border-border-warm" />
                  </button>
                ) : (
                  <div className="w-8 h-8 rounded bg-muted-bg border border-border-warm flex items-center justify-center flex-shrink-0">
                    <Package size={12} className="text-muted-text" />
                  </div>
                )}
                <p className="text-[13px] font-public-sans text-primary flex-1 truncate">{p.name}</p>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={alreadyIn || addProduct.isPending}
                  onClick={() => addProduct.mutate({ collectionId, productId: p.id })}
                  className="gap-1"
                >
                  {alreadyIn ? 'Added' : (<><Plus size={12} /> Add</>)}
                </Button>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminCollectionDetailPage() {
  const params = useParams<{ id: string }>()
  const id = params.id
  const router = useRouter()

  const { data: collection, isLoading, isError } = useAdminCollection(id)
  const updateCollection = useUpdateCollection()
  const publishCollection = usePublishCollection()
  const unpublishCollection = useUnpublishCollection()
  const archiveCollection = useArchiveCollection()
  const featureCollection = useFeatureCollection()
  const unfeatureCollection = useUnfeatureCollection()
  const reorderProducts = useReorderCollectionProducts()
  const removeProduct = useRemoveProductFromCollection()

  const [name, setName] = useState('')
  const [heroImageFile, setHeroImageFile] = useState<File | null>(null)
  const [heroImageRemoved, setHeroImageRemoved] = useState(false)
  const [editorialIntro, setEditorialIntro] = useState('')
  const [orderedProducts, setOrderedProducts] = useState<Product[]>([])
  const { openLightbox, lightboxNode } = useImageLightbox()

  useEffect(() => {
    if (!collection) return
    setName(collection.name)
    setHeroImageFile(null)
    setHeroImageRemoved(false)
    setEditorialIntro(collection.editorialIntro ?? '')
    setOrderedProducts(collection.products ?? [])
  }, [collection])

  const dirty =
    !!collection &&
    (name !== collection.name ||
      !!heroImageFile ||
      heroImageRemoved ||
      editorialIntro !== (collection.editorialIntro ?? ''))

  function handleSave() {
    if (!collection) return
    updateCollection.mutate(
      {
        id: collection.id,
        data: {
          name: name.trim(),
          heroImage: heroImageFile ?? undefined,
          removeHeroImage: heroImageRemoved || undefined,
          editorialIntro: editorialIntro.trim() || undefined,
        },
      },
      {
        onSuccess: () => {
          setHeroImageFile(null)
          setHeroImageRemoved(false)
        },
      }
    )
  }

  function persistOrder(next: Product[]) {
    setOrderedProducts(next)
    reorderProducts.mutate({
      collectionId: id,
      order: next.map((p, i) => ({ productId: p.id, sortOrder: i })),
    })
  }

  function moveUp(index: number) {
    if (index === 0) return
    const next = [...orderedProducts]
    ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
    persistOrder(next)
  }

  function moveDown(index: number) {
    if (index === orderedProducts.length - 1) return
    const next = [...orderedProducts]
    ;[next[index], next[index + 1]] = [next[index + 1], next[index]]
    persistOrder(next)
  }

  function handleRemove(productId: string) {
    removeProduct.mutate(
      { collectionId: id, productId },
      { onSuccess: () => setOrderedProducts((prev) => prev.filter((p) => p.id !== productId)) }
    )
  }

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto animate-pulse space-y-5">
        <div className="h-5 bg-muted-bg rounded w-24" />
        <div className="h-32 bg-surface border border-border-warm rounded" />
        <div className="h-48 bg-surface border border-border-warm rounded" />
      </div>
    )
  }

  if (!collection || isError) {
    return (
      <div className="max-w-3xl mx-auto">
        <button
          type="button"
          onClick={() => router.push('/admin/collections')}
          className="flex items-center gap-1.5 text-[13px] font-public-sans text-muted-text hover:text-primary mb-6 transition-colors"
        >
          <ArrowLeft size={14} /> Back
        </button>
        <div className="bg-surface border border-border-warm rounded py-20 flex flex-col items-center gap-3">
          <ImageOff size={28} className="text-border-warm" aria-hidden="true" />
          <p className="text-[15px] font-[600] font-public-sans text-primary">
            {isError ? 'Failed to load collection' : 'Collection not found'}
          </p>
        </div>
      </div>
    )
  }

  const existingIds = new Set(orderedProducts.map((p) => p.id))
  const actionPending =
    publishCollection.isPending || unpublishCollection.isPending || archiveCollection.isPending

  return (
    <div className="max-w-3xl mx-auto">
      {/* Back + status */}
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <button
          type="button"
          onClick={() => router.push('/admin/collections')}
          className="flex items-center gap-1.5 text-[13px] font-public-sans text-muted-text hover:text-primary transition-colors"
        >
          <ArrowLeft size={14} />
          Back to collections
        </button>
        <StatusBadge status={collection.status} />
      </div>

      {/* Hero */}
      <div className="bg-surface border border-border-warm rounded overflow-hidden mb-5 px-6 py-6">
        <div className="flex items-center gap-4">
          {collection.heroImage ? (
            <button
              type="button"
              onClick={() => openLightbox(collection.heroImage, collection.name)}
              className="w-14 h-14 rounded bg-muted-bg border border-border-warm flex items-center justify-center shrink-0 overflow-hidden cursor-zoom-in"
              aria-label={`View ${collection.name} hero image full size`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={collection.heroImage} alt="" className="w-full h-full object-cover" />
            </button>
          ) : (
            <div className="w-14 h-14 rounded bg-muted-bg border border-border-warm flex items-center justify-center shrink-0 overflow-hidden">
              <ImageOff size={20} className="text-muted-text" aria-hidden="true" />
            </div>
          )}
          <div>
            <h1 className="text-[24px] leading-[1.3] font-[500] font-playfair text-primary">{collection.name}</h1>
            <p className="text-[13px] font-public-sans text-muted-text mt-0.5">/{collection.slug}</p>
          </div>
        </div>
      </div>

      {/* Status + feature actions */}
      <div className="flex flex-wrap items-center gap-2.5 mb-5">
        {(collection.status === 'DRAFT' || collection.status === 'SCHEDULED') && (
          <Button
            variant="accent"
            size="sm"
            disabled={actionPending}
            onClick={() => publishCollection.mutate(collection.id)}
          >
            {publishCollection.isPending ? 'Publishing…' : 'Publish'}
          </Button>
        )}
        {(collection.status === 'SCHEDULED' || collection.status === 'PUBLISHED') && (
          <Button
            variant="ghost"
            size="sm"
            disabled={actionPending}
            onClick={() => unpublishCollection.mutate(collection.id)}
          >
            {unpublishCollection.isPending ? 'Unpublishing…' : 'Unpublish'}
          </Button>
        )}
        {collection.status !== 'ARCHIVED' && (
          <Button
            variant="destructive"
            size="sm"
            disabled={actionPending}
            onClick={() => archiveCollection.mutate(collection.id)}
          >
            {archiveCollection.isPending ? 'Archiving…' : 'Archive'}
          </Button>
        )}
        {collection.isFeatured ? (
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5"
            disabled={unfeatureCollection.isPending}
            onClick={() => unfeatureCollection.mutate(collection.id)}
          >
            <Star size={13} className="fill-accent text-accent" />
            {unfeatureCollection.isPending ? 'Unfeaturing…' : 'Unfeature'}
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5"
            disabled={featureCollection.isPending}
            onClick={() => featureCollection.mutate(collection.id)}
          >
            <Star size={13} />
            {featureCollection.isPending ? 'Featuring…' : 'Feature on homepage'}
          </Button>
        )}
      </div>

      {/* Edit form */}
      <div className="bg-surface border border-border-warm rounded p-6 space-y-4 mb-6">
        <h2 className="text-[16px] font-[600] font-public-sans text-primary pb-3 border-b border-border-warm">
          Details
        </h2>
        <div>
          <Label htmlFor="edit-name">Name</Label>
          <Input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <HeroImageUpload
          label="Hero image"
          existingUrl={heroImageRemoved ? null : collection.heroImage}
          file={heroImageFile}
          onFileChange={setHeroImageFile}
          onRemoveExisting={() => setHeroImageRemoved(true)}
        />
        <div>
          <Label htmlFor="edit-intro">Editorial intro</Label>
          <textarea
            id="edit-intro"
            value={editorialIntro}
            onChange={(e) => setEditorialIntro(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 rounded border border-border-warm bg-surface text-[14px] font-public-sans text-primary placeholder:text-muted-text/60 focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent transition-colors resize-none"
          />
        </div>
        <div className="flex justify-end">
          <Button
            variant="primary"
            size="sm"
            disabled={!dirty || !name.trim() || updateCollection.isPending}
            onClick={handleSave}
          >
            {updateCollection.isPending ? 'Saving…' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {/* Product membership */}
      <div className="bg-surface border border-border-warm rounded p-6 space-y-4 mb-6">
        <h2 className="text-[16px] font-[600] font-public-sans text-primary pb-3 border-b border-border-warm">
          Products in this collection ({orderedProducts.length})
        </h2>
        {orderedProducts.length === 0 ? (
          <p className="text-[13px] font-public-sans text-muted-text py-4 text-center">
            No products in this collection yet — add some below.
          </p>
        ) : (
          <div className="border border-border-warm rounded overflow-hidden">
            {orderedProducts.map((p, i) => (
              <MemberProductRow
                key={p.id}
                product={p}
                index={i}
                total={orderedProducts.length}
                onMoveUp={() => moveUp(i)}
                onMoveDown={() => moveDown(i)}
                onRemove={() => handleRemove(p.id)}
                onImageClick={openLightbox}
                disabled={reorderProducts.isPending || removeProduct.isPending}
              />
            ))}
          </div>
        )}
      </div>

      {/* Add product */}
      <div className="bg-surface border border-border-warm rounded p-6 space-y-4 mb-6">
        <h2 className="text-[16px] font-[600] font-public-sans text-primary pb-3 border-b border-border-warm">
          Add a product
        </h2>
        <AddProductPicker collectionId={id} existingIds={existingIds} onImageClick={openLightbox} />
      </div>
      {lightboxNode}
    </div>
  )
}
