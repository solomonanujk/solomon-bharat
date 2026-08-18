'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useGenerateCatalogue } from '@/hooks/queries/useCatalogues'

interface CatalogueBuilderProps {
  selectedIds: Set<string>
  onClearSelection: () => void
}

/**
 * Sticky selection bar pinned at the bottom of the catalogue-builder page.
 * POSTs the selected product ids to the backend, which builds and hosts the
 * PDF — on success this just opens the returned `fileUrl`, no client-side
 * PDF generation happens here.
 */
export function CatalogueBuilder({ selectedIds, onClearSelection }: CatalogueBuilderProps) {
  const [title, setTitle] = useState('')
  const generateCatalogue = useGenerateCatalogue()

  const count = selectedIds.size

  function handleGenerate() {
    if (count === 0) return
    generateCatalogue.mutate(
      { productIds: Array.from(selectedIds), title: title.trim() || undefined },
      {
        onSuccess: (catalogue) => {
          window.open(catalogue.fileUrl, '_blank', 'noopener,noreferrer')
          onClearSelection()
          setTitle('')
        },
        onError: () => {
          toast.error('Something went wrong generating your catalogue.')
        },
      }
    )
  }

  return (
    <div className="sticky bottom-0 left-0 right-0 -mx-4 lg:-mx-8 mt-6 px-4 lg:px-8 py-4 bg-white border-t border-border-warm shadow-[0_-4px_16px_rgba(26,26,26,0.04)] flex flex-col sm:flex-row items-stretch sm:items-center gap-3 z-10">
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-[600] font-public-sans text-primary">
          {count} product{count === 1 ? '' : 's'} selected
        </p>
        <p className="text-[12px] font-public-sans text-muted-text mt-0.5">
          Pick the products to include, then generate a shareable PDF catalogue.
        </p>
      </div>

      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Catalogue title (optional)"
        className="w-full sm:w-56 h-10 px-3 rounded border border-border-warm bg-transparent text-[13.5px] font-public-sans text-primary placeholder:text-muted-text focus:outline-none focus:border-accent transition-colors"
      />

      <Button
        type="button"
        size="md"
        onClick={handleGenerate}
        disabled={count === 0 || generateCatalogue.isPending}
        className="shrink-0"
      >
        {generateCatalogue.isPending ? 'Generating…' : 'Generate Catalogue'}
      </Button>
    </div>
  )
}
