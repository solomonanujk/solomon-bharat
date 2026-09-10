'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { Trash2, MessageCircleMore, Link2 } from 'lucide-react'
import { toast } from 'sonner'
import { AccountPageWrapper } from '@/components/shared/AccountPageWrapper'
import { EmptyState } from '@/components/shared/EmptyState'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { useCatalogueStore } from '@/lib/store/useCatalogueStore'
import { cloudinaryFill } from '@/lib/cloudinaryImage'
import { useGenerateCatalogue, useMyCatalogues } from '@/hooks/queries/useCatalogues'

// Agents build a catalogue by tapping "Add to catalogue" on any product card or
// PDP anywhere in the marketplace (the floating CatalogueTray tracks progress);
// this page is where they review the current selection, generate the PDF, and
// find/share catalogues they've already generated.

function BuildingSection() {
  const items = useCatalogueStore((s) => s.items)
  const removeProduct = useCatalogueStore((s) => s.removeProduct)
  const updateItem = useCatalogueStore((s) => s.updateItem)
  const clear = useCatalogueStore((s) => s.clear)
  const [title, setTitle] = useState('')
  const generateCatalogue = useGenerateCatalogue()

  const hasInvalidPricing = items.some((i) => !(i.price > 0) || !(i.moq > 0))

  function handleGenerate() {
    if (hasInvalidPricing) {
      toast.error('Set a price and MOQ greater than 0 for every product before generating.')
      return
    }
    generateCatalogue.mutate(
      {
        items: items.map((i) => ({ productId: i.productId, price: i.price, moq: i.moq })),
        title: title.trim() || undefined,
      },
      { onSuccess: () => { clear(); setTitle('') } }
    )
  }

  return (
    <section className="border border-border-warm rounded bg-surface p-6 space-y-5">
      <div className="pb-4 border-b border-border-warm">
        <h2 className="text-[18px] font-[600] font-public-sans text-primary">Building a catalogue</h2>
        <p className="text-[14px] font-public-sans text-muted-text mt-0.5">
          Add products from anywhere in the marketplace, set your own price and MOQ for each, then generate a PDF to share.
        </p>
      </div>

      {items.length === 0 ? (
        <EmptyState
          title="No products selected yet"
          description="Tap the bookmark icon on any product card or product page to add it here."
        />
      ) : (
        <>
          <div className="flex flex-col gap-3">
            {items.map((item) => (
              <div key={item.productId} className="flex items-center gap-3 border border-border-warm rounded p-3">
                <div className="relative w-12 h-12 rounded overflow-hidden bg-muted-bg flex-shrink-0">
                  {item.image && <Image src={cloudinaryFill(item.image, 160, 160)} alt={item.name} fill sizes="48px" className="object-contain" />}
                </div>
                <Link href={`/products/${item.slug}`} className="flex-1 min-w-0 text-[14px] font-[500] font-public-sans text-product-text hover:underline truncate">
                  {item.name}
                </Link>

                <label className="flex flex-col gap-0.5">
                  <span className="text-[11px] font-[600] font-public-sans text-muted-text uppercase tracking-[0.04em]">Price (₹)</span>
                  <input
                    type="number"
                    min={1}
                    value={item.price}
                    onChange={(e) => updateItem(item.productId, { price: Number(e.target.value) })}
                    className="w-24 h-9 px-2 rounded border border-border-warm bg-muted-bg/30 text-[13px] font-public-sans text-primary focus:outline-none focus:border-primary/40 focus:bg-surface transition-colors"
                  />
                </label>

                <label className="flex flex-col gap-0.5">
                  <span className="text-[11px] font-[600] font-public-sans text-muted-text uppercase tracking-[0.04em]">MOQ</span>
                  <input
                    type="number"
                    min={1}
                    value={item.moq}
                    onChange={(e) => updateItem(item.productId, { moq: Number(e.target.value) })}
                    className="w-20 h-9 px-2 rounded border border-border-warm bg-muted-bg/30 text-[13px] font-public-sans text-primary focus:outline-none focus:border-primary/40 focus:bg-surface transition-colors"
                  />
                </label>

                <button
                  type="button"
                  aria-label={`Remove ${item.name} from catalogue`}
                  onClick={() => removeProduct(item.productId)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-muted-text hover:text-error hover:bg-muted-bg transition-colors flex-shrink-0"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Catalogue title (optional)"
              className="flex-1 h-10 px-3 rounded border border-border-warm bg-muted-bg/30 text-[14px] font-public-sans text-primary placeholder:text-muted-text focus:outline-none focus:border-primary/40 focus:bg-surface transition-colors"
            />
            <div className="flex gap-2">
              <Button variant="primary" size="md" onClick={handleGenerate} disabled={generateCatalogue.isPending}>
                {generateCatalogue.isPending ? 'Generating…' : 'Generate PDF'}
              </Button>
              <Button variant="ghost" size="md" onClick={clear}>
                Clear
              </Button>
            </div>
          </div>
        </>
      )}
    </section>
  )
}

function MyCataloguesSection() {
  const { data, isLoading } = useMyCatalogues()
  const catalogues = data?.items ?? []

  async function handleCopyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Link copied to clipboard')
    } catch {
      toast.error('Could not copy — try again.')
    }
  }

  return (
    <section className="border border-border-warm rounded bg-surface p-6 space-y-5">
      <div className="pb-4 border-b border-border-warm">
        <h2 className="text-[18px] font-[600] font-public-sans text-primary">My Catalogues</h2>
        <p className="text-[14px] font-public-sans text-muted-text mt-0.5">
          Catalogues you&apos;ve generated — open or share the PDF with your customers.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-16 bg-muted-bg rounded animate-pulse" />
          ))}
        </div>
      ) : catalogues.length === 0 ? (
        <EmptyState title="No catalogues yet" description="Generated catalogues will show up here." />
      ) : (
        <div className="flex flex-col gap-3">
          {catalogues.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-3 border border-border-warm rounded p-4">
              <div className="min-w-0">
                <a href={c.fileUrl} target="_blank" rel="noreferrer" className="text-[14px] font-[600] font-public-sans text-primary hover:underline truncate block">
                  {c.title}
                </a>
                <p className="text-[12px] font-public-sans text-muted-text mt-0.5">
                  {new Date(c.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}
                </p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(`${c.title}\n${c.fileUrl}`)}`}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Share via WhatsApp"
                  className="w-9 h-9 rounded-full flex items-center justify-center text-primary hover:bg-muted-bg transition-colors"
                >
                  <MessageCircleMore size={16} />
                </a>
                <button
                  type="button"
                  aria-label="Copy link"
                  onClick={() => handleCopyLink(c.fileUrl)}
                  className="w-9 h-9 rounded-full flex items-center justify-center text-primary hover:bg-muted-bg transition-colors"
                >
                  <Link2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

export default function CataloguePage() {
  const router = useRouter()
  const hasHydrated = useAuthStore((s) => s._hasHydrated)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const role = useAuthStore((s) => s.user?.role)

  useEffect(() => {
    if (!hasHydrated) return
    if (!isAuthenticated || role !== 'AGENT') router.replace('/')
  }, [hasHydrated, isAuthenticated, role, router])

  if (!hasHydrated || !isAuthenticated || role !== 'AGENT') return null

  return (
    <AccountPageWrapper title="Catalogue" description="Build and share product catalogues with your customers.">
      <div className="flex flex-col gap-6">
        <BuildingSection />
        <MyCataloguesSection />
      </div>
    </AccountPageWrapper>
  )
}
