'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import Image from 'next/image'
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { cloudinaryFit } from '@/lib/cloudinaryImage'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PhotoGalleryProps {
  images: string[]
  productName: string
}

// ─── Lightbox ─────────────────────────────────────────────────────────────────

const MIN_ZOOM = 1
const MAX_ZOOM = 4
const ZOOM_STEP = 0.5

function Lightbox({
  images,
  initialIndex,
  productName,
  onClose,
}: {
  images: string[]
  initialIndex: number
  productName: string
  onClose: () => void
}) {
  const [index, setIndex] = useState(initialIndex)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const dragStart = useRef<{ mx: number; my: number; px: number; py: number } | null>(null)

  const resetView = useCallback(() => { setZoom(1); setPan({ x: 0, y: 0 }) }, [])

  const zoomIn  = useCallback(() => setZoom((z) => Math.min(+(z + ZOOM_STEP).toFixed(1), MAX_ZOOM)), [])
  const zoomOut = useCallback(() => setZoom((z) => {
    const next = Math.max(+(z - ZOOM_STEP).toFixed(1), MIN_ZOOM)
    if (next === 1) setPan({ x: 0, y: 0 })
    return next
  }), [])

  const prev = useCallback(() => { resetView(); setIndex((i) => (i === 0 ? images.length - 1 : i - 1)) }, [images.length, resetView])
  const next = useCallback(() => { resetView(); setIndex((i) => (i === images.length - 1 ? 0 : i + 1)) }, [images.length, resetView])

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft'  && zoom === 1) prev()
      else if (e.key === 'ArrowRight' && zoom === 1) next()
      else if (e.key === '+' || e.key === '=') zoomIn()
      else if (e.key === '-') zoomOut()
      else if (e.key === '0') resetView()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose, prev, next, zoom, zoomIn, zoomOut, resetView])

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  // ── Drag-to-pan ────────────────────────────────────────────────────────────
  function handleMouseDown(e: React.MouseEvent) {
    if (zoom <= 1) return
    e.preventDefault()
    setDragging(true)
    dragStart.current = { mx: e.clientX, my: e.clientY, px: pan.x, py: pan.y }
  }
  function handleMouseMove(e: React.MouseEvent) {
    if (!dragging || !dragStart.current) return
    setPan({
      x: dragStart.current.px + (e.clientX - dragStart.current.mx),
      y: dragStart.current.py + (e.clientY - dragStart.current.my),
    })
  }
  function handleMouseUp() { setDragging(false); dragStart.current = null }

  // ── Scroll-to-zoom ─────────────────────────────────────────────────────────
  function handleWheel(e: React.WheelEvent) {
    e.preventDefault()
    e.deltaY < 0 ? zoomIn() : zoomOut()
  }

  // ── Double-click to toggle zoom ────────────────────────────────────────────
  function handleDoubleClick() { zoom === 1 ? zoomIn() : resetView() }

  const isZoomed = zoom > 1

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-6 bg-black/70"
      role="dialog"
      aria-modal="true"
      aria-label={`${productName} — image ${index + 1} of ${images.length}`}
      onClick={onClose}
    >
      {/* Modal card */}
      <div
        className="relative bg-[#1a1a1a] rounded-xl shadow-2xl flex flex-col overflow-hidden w-full max-w-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header: title · zoom controls · close */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
          <p className="font-sans text-[12px] text-white/60 truncate flex-1 min-w-0">
            {productName}
            {images.length > 1 && (
              <span className="ml-2 text-white/40">{index + 1} / {images.length}</span>
            )}
          </p>

          {/* Zoom controls */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              type="button"
              onClick={zoomOut}
              disabled={zoom <= MIN_ZOOM}
              className="w-7 h-7 rounded inline-flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="Zoom out"
            >
              <ZoomOut size={15} aria-hidden="true" />
            </button>
            <span className="font-sans text-[11px] text-white/50 w-10 text-center select-none">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={zoomIn}
              disabled={zoom >= MAX_ZOOM}
              className="w-7 h-7 rounded inline-flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="Zoom in"
            >
              <ZoomIn size={15} aria-hidden="true" />
            </button>
            {isZoomed && (
              <button
                type="button"
                onClick={resetView}
                className="w-7 h-7 rounded inline-flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Reset zoom"
              >
                <Maximize2 size={13} aria-hidden="true" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded inline-flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0"
            aria-label="Close lightbox"
          >
            <X size={15} aria-hidden="true" />
          </button>
        </div>

        {/* Image area */}
        <div
          className="relative flex items-center justify-center bg-black/40 overflow-hidden"
          style={{ cursor: isZoomed ? (dragging ? 'grabbing' : 'grab') : 'default' }}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onDoubleClick={handleDoubleClick}
        >
          {images.length > 1 && !isZoomed && (
            <button
              type="button"
              onClick={prev}
              className="absolute left-3 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded border border-white/20 inline-flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Previous image"
            >
              <ChevronLeft size={18} aria-hidden="true" />
            </button>
          )}

          <Image
            src={images[index]}
            alt={`${productName} — view ${index + 1}`}
            width={800}
            height={600}
            className="max-h-[65vh] w-auto object-contain mx-auto select-none"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transition: dragging ? 'none' : 'transform 0.2s ease',
              transformOrigin: 'center',
              display: 'block',
            }}
            draggable={false}
            priority
          />

          {images.length > 1 && !isZoomed && (
            <button
              type="button"
              onClick={next}
              className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded border border-white/20 inline-flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Next image"
            >
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          )}

          {isZoomed && (
            <p className="absolute bottom-2 left-1/2 -translate-x-1/2 text-white/40 font-sans text-[10px] pointer-events-none select-none">
              Drag to pan · double-click or scroll to zoom
            </p>
          )}
        </div>

        {/* Thumbnail strip */}
        {images.length > 1 && (
          <div className="flex items-center gap-2 px-4 py-3 overflow-x-auto border-t border-white/10">
            {images.map((src, i) => (
              <button
                key={i}
                type="button"
                onClick={() => { resetView(); setIndex(i) }}
                className={`flex-shrink-0 w-12 h-12 rounded overflow-hidden border-2 transition-colors ${
                  i === index ? 'border-white/80' : 'border-transparent opacity-50 hover:opacity-80'
                }`}
                aria-label={`Go to image ${i + 1}`}
              >
                <Image src={src} alt="" width={48} height={48} className="w-full h-full object-contain" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}

// ─── Empty placeholder ────────────────────────────────────────────────────────

function EmptyPlaceholder() {
  return (
    <div className="w-full aspect-square rounded bg-muted-bg flex items-center justify-center">
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true" className="text-border-warm">
        <rect x="8" y="12" width="32" height="26" rx="1" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="18" cy="22" r="4" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 30 L16 24 L22 29 L32 21 L40 30" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
// Always a single-image carousel, regardless of image count: one large photo
// at a time, dot pagination below it, and a scrollable thumbnail strip with
// prev/next arrows beneath that — not the old mosaic/grid layouts.

export function PhotoGallery({ images, productName }: PhotoGalleryProps) {
  const [index, setIndex] = useState(0)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const thumbStripRef = useRef<HTMLDivElement>(null)

  if (!images || images.length === 0) return <EmptyPlaceholder />

  function goTo(i: number) {
    setIndex(i)
    thumbStripRef.current?.children[i]?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }
  function prev() { goTo(index === 0 ? images.length - 1 : index - 1) }
  function next() { goTo(index === images.length - 1 ? 0 : index + 1) }

  return (
    <div className="flex flex-col gap-3">
      {/* Main image — a sliding filmstrip rather than an instant swap, so
          jumping straight to e.g. the 5th thumbnail visibly glides there
          instead of cutting. All images sit side by side in one row; moving
          between them is just translating that row, so there's nothing to
          "load" mid-transition. */}
      <div className="relative w-full aspect-[4/5] sm:aspect-[4/3] rounded overflow-hidden bg-muted-bg">
        {images.map((src, i) => (
          <div
            key={i}
            className="absolute inset-0 transition-transform duration-500 ease-in-out"
            style={{ transform: `translateX(${(i - index) * 100}%)` }}
            aria-hidden={i !== index}
          >
            <Image
              src={cloudinaryFit(src, 1200)}
              alt={`${productName} — view ${i + 1}`}
              fill
              className="object-contain"
              // Every slide loads eagerly, not just the active one — the
              // slide-transform approach only *visually* hides the other
              // images (they're still laid out, just offscreen), but Next's
              // default lazy loading uses an intersection check that treats
              // an off-screen-via-transform slide as not yet visible, so its
              // fetch wouldn't start until the moment you jump to it — too
              // late for the 500ms slide transition to show anything.
              priority
              sizes="(max-width: 1024px) 100vw, 55vw"
            />
          </div>
        ))}

        <button
          type="button"
          onClick={() => setLightboxOpen(true)}
          className="absolute inset-0 z-10 cursor-zoom-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          aria-label={`Enlarge ${productName} image ${index + 1}`}
        />

        <span className="absolute bottom-3 right-3 z-20 w-8 h-8 rounded-full bg-white/90 shadow flex items-center justify-center text-primary pointer-events-none">
          <ZoomIn size={15} aria-hidden="true" />
        </span>
      </div>

      {/* Dot pagination */}
      {images.length > 1 && (
        <div className="flex items-center justify-center gap-1.5" role="tablist" aria-label="Select image">
          {images.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => goTo(i)}
              role="tab"
              aria-selected={i === index}
              aria-label={`Go to image ${i + 1}`}
              className={cn(
                'h-1.5 rounded-full transition-all',
                i === index ? 'w-5 bg-primary' : 'w-1.5 bg-border-warm hover:bg-muted-text/40'
              )}
            />
          ))}
        </div>
      )}

      {/* Thumbnail strip */}
      {images.length > 1 && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={prev}
            className="flex-shrink-0 w-7 h-7 rounded-full border border-border-warm flex items-center justify-center text-muted-text hover:text-primary hover:border-primary transition-colors"
            aria-label="Scroll thumbnails back"
          >
            <ChevronLeft size={14} aria-hidden="true" />
          </button>
          <div ref={thumbStripRef} className="flex-1 flex gap-2 overflow-x-auto scrollbar-none scroll-smooth">
            {images.map((src, i) => (
              <button
                key={i}
                type="button"
                onClick={() => goTo(i)}
                className={cn(
                  'flex-shrink-0 w-16 h-16 rounded overflow-hidden border-2 relative bg-muted-bg transition-colors',
                  i === index ? 'border-primary' : 'border-transparent opacity-60 hover:opacity-100'
                )}
                aria-label={`Go to image ${i + 1}`}
              >
                <Image src={cloudinaryFit(src, 160)} alt="" fill sizes="64px" className="object-contain" />
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={next}
            className="flex-shrink-0 w-7 h-7 rounded-full border border-border-warm flex items-center justify-center text-muted-text hover:text-primary hover:border-primary transition-colors"
            aria-label="Scroll thumbnails forward"
          >
            <ChevronRight size={14} aria-hidden="true" />
          </button>
        </div>
      )}

      {lightboxOpen && (
        <Lightbox images={images} initialIndex={index} productName={productName} onClose={() => setLightboxOpen(false)} />
      )}
    </div>
  )
}
