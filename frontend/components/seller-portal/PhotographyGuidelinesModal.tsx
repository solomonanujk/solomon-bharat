'use client'

import { X } from 'lucide-react'

function buildGuidelines(minImages: number): string[] {
  return [
    'Use a plain white or light neutral background for every shot.',
    'Shoot in natural, even light — avoid harsh shadows or strong color casts.',
    `Upload at least ${minImages} images, including a straight-on shot, an angled shot, and a close-up of texture or detail.`,
    'Make your first image the cleanest, most complete view — it’s shown as the featured photo everywhere on the site.',
    'Images should be at least 1,050 × 1,050 pixels and in sharp focus.',
    'Show every color or variant you’re listing, not just one.',
    'Keep colors true to the real product — avoid heavy filters or retouching.',
    'Don’t add text, watermarks, or logos to the image itself.',
  ]
}

interface PhotographyGuidelinesModalProps {
  minImages: number
  onClose: () => void
}

/** Static reference content for the "Review photography guidelines" link in the
 *  Images & Videos section — same hand-rolled overlay pattern as the other
 *  seller-portal modals in this file (ColorSwatchPromptModal, the publish modal). */
export function PhotographyGuidelinesModal({ minImages, onClose }: PhotographyGuidelinesModalProps) {
  const guidelines = buildGuidelines(minImages)
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6 bg-black/45" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="bg-surface rounded-xl p-8 max-w-lg w-full relative" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={onClose} aria-label="Close"
          className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-muted-text hover:text-primary hover:bg-muted-bg transition-colors">
          <X size={16} />
        </button>

        <h2 className="text-[20px] font-[600] font-display text-primary mb-2 pr-8">
          Photography guidelines
        </h2>
        <p className="text-[13.5px] font-sans text-muted-text leading-relaxed mb-5">
          High-quality, consistent photos are the single biggest driver of buyer trust and sales. Here&apos;s what to
          aim for:
        </p>

        <ul className="flex flex-col gap-3 mb-7">
          {guidelines.map((tip) => (
            <li key={tip} className="flex items-start gap-2.5 text-[13.5px] font-sans text-primary leading-snug">
              <span className="w-1.5 h-1.5 rounded-full bg-accent mt-1.5 flex-shrink-0" aria-hidden="true" />
              {tip}
            </li>
          ))}
        </ul>

        <button type="button" onClick={onClose}
          className="w-full h-11 rounded bg-primary text-white text-[14px] font-[600] font-sans hover:bg-primary/90 transition-colors">
          Got it
        </button>
      </div>
    </div>
  )
}
