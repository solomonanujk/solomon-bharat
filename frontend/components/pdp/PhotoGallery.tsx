'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import { ImageIcon, ZoomIn } from 'lucide-react'
import { cn } from '@/lib/utils'
import { cloudinaryFit } from '@/lib/cloudinaryImage'
import { ImageLightbox } from '@/components/shared/ImageLightbox'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PhotoGalleryProps {
  images: string[]
  productName: string
}

const SWIPE_THRESHOLD = 50

function viewAlt(productName: string, i: number, count: number): string {
  return count > 1 ? `${productName}, photo ${i + 1} of ${count}` : `${productName}, product photo`
}

// ─── Empty placeholder ────────────────────────────────────────────────────────
// Shown only when the product has no photos at all — never a fake angle.

function EmptyPlaceholder({ productName }: { productName: string }) {
  return (
    <div
      className="w-full aspect-square rounded-[6px] border border-line bg-white flex flex-col items-center justify-center gap-2 text-muted"
      role="img"
      aria-label={`No photos available for ${productName}`}
    >
      <ImageIcon size={40} strokeWidth={1.25} aria-hidden="true" />
      <span className="type-caption">Photos coming soon</span>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
// Square main frame (a sliding filmstrip, so jumping to a far thumbnail glides
// rather than cuts) above a row of real-photo thumbnails. Clicking the frame
// opens the shared zoomable viewer; swiping the frame on touch moves between
// photos.

export function PhotoGallery({ images, productName }: PhotoGalleryProps) {
  const [index, setIndex] = useState(0)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const thumbStripRef = useRef<HTMLDivElement>(null)
  const touchStart = useRef<{ x: number; y: number } | null>(null)

  if (!images || images.length === 0) return <EmptyPlaceholder productName={productName} />

  const count = images.length

  function goTo(i: number) {
    setIndex(i)
    thumbStripRef.current?.children[i]?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }

  function handleTouchStart(e: React.TouchEvent) {
    if (e.touches.length !== 1) { touchStart.current = null; return }
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }
  function handleTouchEnd(e: React.TouchEvent) {
    const start = touchStart.current
    touchStart.current = null
    if (!start || count < 2) return
    const dx = e.changedTouches[0].clientX - start.x
    const dy = e.changedTouches[0].clientY - start.y
    if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) < Math.abs(dy)) return
    goTo(dx < 0 ? (index === count - 1 ? 0 : index + 1) : (index === 0 ? count - 1 : index - 1))
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        className="relative w-full aspect-square rounded-[6px] overflow-hidden border border-line bg-white touch-pan-y"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {images.map((src, i) => (
          <div
            key={i}
            className="absolute inset-0 transition-transform duration-500 ease-in-out"
            style={{ transform: `translateX(${(i - index) * 100}%)` }}
            aria-hidden={i !== index}
          >
            <Image
              src={cloudinaryFit(src, 1200)}
              alt={viewAlt(productName, i, count)}
              fill
              className="object-contain"
              // Every slide loads eagerly: the slides are hidden by transform,
              // which Next's lazy loader treats as not-yet-visible, so a lazy
              // slide wouldn't start fetching until the 500ms glide had begun.
              priority={i === 0}
              loading={i === 0 ? undefined : 'eager'}
              sizes="(max-width: 1023px) 100vw, 600px"
            />
          </div>
        ))}

        <button
          type="button"
          onClick={() => setLightboxOpen(true)}
          className="absolute inset-0 z-10 cursor-zoom-in rounded-[6px] focus-visible:outline-2 focus-visible:outline-forest focus-visible:-outline-offset-4"
          aria-label={`Open zoomable view of ${viewAlt(productName, index, count)}`}
          aria-haspopup="dialog"
        />

        <span
          className="absolute bottom-3 right-3 z-20 w-9 h-9 rounded-full bg-white border border-line flex items-center justify-center text-forest pointer-events-none"
          aria-hidden="true"
        >
          <ZoomIn size={16} />
        </span>

        {count > 1 && (
          <span
            className="lg:hidden absolute bottom-3 left-3 z-20 rounded-[4px] bg-white border border-line px-2 py-0.5 type-caption font-[600] text-ink pointer-events-none"
            aria-hidden="true"
          >
            {index + 1} / {count}
          </span>
        )}
      </div>

      {count > 1 && (
        <div
          ref={thumbStripRef}
          className="flex gap-3 overflow-x-auto scrollbar-none p-1 -m-1"
          aria-label="Product photos"
          role="group"
        >
          {images.map((src, i) => (
            <button
              key={i}
              type="button"
              onClick={() => goTo(i)}
              className={cn(
                'relative flex-shrink-0 w-16 h-16 lg:w-[72px] lg:h-[72px] rounded-[4px] overflow-hidden border border-line bg-white transition-opacity duration-150',
                i === index ? 'ring-2 ring-forest ring-offset-2 ring-offset-white' : 'opacity-70 hover:opacity-100'
              )}
              aria-label={`Show ${viewAlt(productName, i, count)}`}
              aria-current={i === index ? 'true' : undefined}
            >
              <Image src={cloudinaryFit(src, 160)} alt="" fill sizes="72px" className="object-contain" />
            </button>
          ))}
        </div>
      )}

      {lightboxOpen && (
        <ImageLightbox
          images={images.map((src, i) => ({ src, alt: viewAlt(productName, i, count) }))}
          initialIndex={index}
          title={productName}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </div>
  )
}
