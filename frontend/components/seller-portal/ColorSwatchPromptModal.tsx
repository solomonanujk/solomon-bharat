'use client'

import { X } from 'lucide-react'

interface ColorSwatchPromptModalProps {
  onAddSwatches: () => void
  onMaybeLater: () => void
}

/** Interstitial shown right after saving product options when a Color option was
 *  used — offers to jump straight into swatch assignment, or skip for now. */
export function ColorSwatchPromptModal({ onAddSwatches, onMaybeLater }: ColorSwatchPromptModalProps) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6 bg-black/45" role="dialog" aria-modal="true" onClick={onMaybeLater}>
      <div className="bg-surface rounded-xl p-9 max-w-lg w-full text-center relative" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={onMaybeLater} aria-label="Close"
          className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-muted-text hover:text-primary hover:bg-muted-bg transition-colors">
          <X size={16} />
        </button>

        <h2 className="text-[20px] font-[600] font-display text-primary mt-3 mb-4">
          Bring your products to life with color swatches
        </h2>
        <p className="text-[14px] font-sans text-muted-text leading-relaxed mb-7">
          Help retailers quickly browse the different color options your product comes in.
          All you&apos;ll need is a product image for each color.
        </p>

        <button type="button" onClick={onAddSwatches}
          className="w-full h-11 rounded bg-primary text-white text-[14px] font-[600] font-sans hover:bg-primary/90 transition-colors mb-4">
          Add color swatches
        </button>
        <button type="button" onClick={onMaybeLater}
          className="text-[13px] font-[500] font-sans text-primary underline hover:text-accent transition-colors">
          Maybe later
        </button>
      </div>
    </div>
  )
}
