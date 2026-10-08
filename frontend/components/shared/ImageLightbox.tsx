'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Image from 'next/image'
import { ChevronLeft, ChevronRight, Maximize2, X, ZoomIn, ZoomOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { cloudinaryFit } from '@/lib/cloudinaryImage'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LightboxImage {
  src: string
  /** Descriptive alt text for this specific view. */
  alt: string
}

interface ImageLightboxProps {
  images: LightboxImage[]
  initialIndex?: number
  /** Accessible name for the dialog, e.g. the product name. */
  title?: string
  onClose: () => void
}

const MIN_ZOOM = 1
const MAX_ZOOM = 4
const ZOOM_STEP = 0.5
const SWIPE_THRESHOLD = 50

/** Blob/data previews (seller upload forms) can't go through the image optimiser. */
function isOptimisable(src: string): boolean {
  return src.startsWith('https://') || src.startsWith('http://localhost:4000/')
}

// ─── Zoomable viewer ──────────────────────────────────────────────────────────
// One full-screen viewer for every "click to enlarge" in the app (PDP gallery,
// review photos, seller/admin image previews). Keyboard: ←/→ to move, Escape to
// close, +/−/0 to zoom. Touch: horizontal swipe to move (when not zoomed).
// Focus moves into the dialog on open, is trapped while open, and returns to
// whatever element opened it on close.

export function ImageLightbox({ images, initialIndex = 0, title, onClose }: ImageLightboxProps) {
  const [index, setIndex] = useState(() => Math.min(Math.max(initialIndex, 0), Math.max(images.length - 1, 0)))
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const dragStart = useRef<{ mx: number; my: number; px: number; py: number } | null>(null)
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)

  const count = images.length
  const hasMany = count > 1
  const current = images[index]

  const resetView = useCallback(() => { setZoom(1); setPan({ x: 0, y: 0 }) }, [])
  const zoomIn = useCallback(() => setZoom((z) => Math.min(+(z + ZOOM_STEP).toFixed(1), MAX_ZOOM)), [])
  const zoomOut = useCallback(() => setZoom((z) => {
    const next = Math.max(+(z - ZOOM_STEP).toFixed(1), MIN_ZOOM)
    if (next === 1) setPan({ x: 0, y: 0 })
    return next
  }), [])

  const prev = useCallback(() => { resetView(); setIndex((i) => (i === 0 ? count - 1 : i - 1)) }, [count, resetView])
  const next = useCallback(() => { resetView(); setIndex((i) => (i === count - 1 ? 0 : i + 1)) }, [count, resetView])

  // Focus in on open, back to the trigger on close; lock page scroll meanwhile.
  useEffect(() => {
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    return () => {
      document.body.style.overflow = prevOverflow
      trigger?.focus()
    }
  }, [])

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.preventDefault(); onClose() }
      else if (e.key === 'ArrowLeft' && zoom === 1 && hasMany) prev()
      else if (e.key === 'ArrowRight' && zoom === 1 && hasMany) next()
      else if (e.key === '+' || e.key === '=') zoomIn()
      else if (e.key === '-') zoomOut()
      else if (e.key === '0') resetView()
      else if (e.key === 'Tab' && dialogRef.current) {
        const focusables = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])')
        )
        if (focusables.length === 0) return
        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose, prev, next, zoom, zoomIn, zoomOut, resetView, hasMany])

  // Wheel-to-zoom needs a non-passive listener to stop the page scrolling.
  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    function handleWheel(e: WheelEvent) {
      e.preventDefault()
      if (e.deltaY < 0) zoomIn()
      else zoomOut()
    }
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [zoomIn, zoomOut])

  // ── Drag-to-pan (mouse, when zoomed) ───────────────────────────────────────
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

  // ── Swipe (touch, when not zoomed) ─────────────────────────────────────────
  function handleTouchStart(e: React.TouchEvent) {
    if (zoom > 1 || e.touches.length !== 1) { touchStart.current = null; return }
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }
  function handleTouchEnd(e: React.TouchEvent) {
    const start = touchStart.current
    touchStart.current = null
    if (!start || !hasMany) return
    const dx = e.changedTouches[0].clientX - start.x
    const dy = e.changedTouches[0].clientY - start.y
    if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) < Math.abs(dy)) return
    if (dx < 0) next()
    else prev()
  }

  function handleDoubleClick() {
    if (zoom === 1) zoomIn()
    else resetView()
  }

  if (!current) return null

  const isZoomed = zoom > 1
  const iconBtn =
    'w-11 h-11 rounded-[4px] inline-flex items-center justify-center text-white hover:bg-white/10 transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed'

  return createPortal(
    <div
      ref={dialogRef}
      className="on-forest fixed inset-0 z-[9999] flex flex-col bg-forest-hover/95 text-white"
      role="dialog"
      aria-modal="true"
      aria-label={title ? `${title}: image viewer` : 'Image viewer'}
    >
      {/* Toolbar: position · zoom · close */}
      <div className="flex items-center gap-2 px-3 sm:px-6 py-2 border-b border-white/15 flex-shrink-0">
        <p className="flex-1 min-w-0 font-sans text-[14px] leading-[20px] text-light-text truncate">
          {title && <span className="hidden sm:inline">{title}</span>}
          {hasMany && (
            <span className={cn('font-[600] text-white', title && 'sm:ml-3')} aria-live="polite">
              {index + 1} / {count}
            </span>
          )}
        </p>

        <div className="hidden sm:flex items-center gap-1 flex-shrink-0">
          <button type="button" onClick={zoomOut} disabled={zoom <= MIN_ZOOM} className={iconBtn} aria-label="Zoom out">
            <ZoomOut size={18} aria-hidden="true" />
          </button>
          <span className="font-sans text-[13px] leading-[20px] text-light-text w-12 text-center select-none" aria-live="polite">
            {Math.round(zoom * 100)}%
          </span>
          <button type="button" onClick={zoomIn} disabled={zoom >= MAX_ZOOM} className={iconBtn} aria-label="Zoom in">
            <ZoomIn size={18} aria-hidden="true" />
          </button>
          {isZoomed && (
            <button type="button" onClick={resetView} className={iconBtn} aria-label="Reset zoom">
              <Maximize2 size={16} aria-hidden="true" />
            </button>
          )}
        </div>

        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className="min-h-11 px-4 rounded-[4px] inline-flex items-center gap-2 border border-white text-white font-sans font-[600] text-[14px] leading-[20px] hover:bg-white/10 transition-colors duration-150 flex-shrink-0"
        >
          <X size={16} aria-hidden="true" />
          Close
        </button>
      </div>

      {/* Stage */}
      <div
        ref={stageRef}
        className="relative flex-1 min-h-0 flex items-center justify-center overflow-hidden touch-pan-y"
        style={{ cursor: isZoomed ? (dragging ? 'grabbing' : 'grab') : 'zoom-in' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDoubleClick={handleDoubleClick}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className="relative w-full h-full"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transition: dragging ? 'none' : 'transform 150ms ease',
            transformOrigin: 'center',
          }}
        >
          <Image
            key={current.src}
            src={isOptimisable(current.src) ? cloudinaryFit(current.src, 1600) : current.src}
            alt={current.alt}
            fill
            sizes="100vw"
            unoptimized={!isOptimisable(current.src)}
            className="object-contain select-none p-4 sm:p-8"
            draggable={false}
            priority
          />
        </div>

        {hasMany && !isZoomed && (
          <>
            <button
              type="button"
              onClick={prev}
              className="hidden sm:inline-flex absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white text-forest items-center justify-center hover:bg-ivory transition-colors duration-150"
              aria-label="Previous image"
            >
              <ChevronLeft size={22} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={next}
              className="hidden sm:inline-flex absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white text-forest items-center justify-center hover:bg-ivory transition-colors duration-150"
              aria-label="Next image"
            >
              <ChevronRight size={22} aria-hidden="true" />
            </button>
          </>
        )}
      </div>

      {/* Footer: swipe hint + position dots on mobile, thumbnails on larger screens */}
      {hasMany && (
        <div className="flex-shrink-0 border-t border-white/15 px-3 sm:px-6 py-3 pb-[calc(12px+env(safe-area-inset-bottom))]">
          <div className="sm:hidden flex items-center justify-between gap-3">
            <button type="button" onClick={prev} className={iconBtn} aria-label="Previous image">
              <ChevronLeft size={20} aria-hidden="true" />
            </button>
            <p className="font-sans text-[13px] leading-[20px] text-light-text text-center">
              Swipe to see more · {index + 1} / {count}
            </p>
            <button type="button" onClick={next} className={iconBtn} aria-label="Next image">
              <ChevronRight size={20} aria-hidden="true" />
            </button>
          </div>
          <div className="hidden sm:flex items-center justify-center gap-3 overflow-x-auto">
            {images.map((img, i) => (
              <button
                key={img.src + i}
                type="button"
                onClick={() => { resetView(); setIndex(i) }}
                className={cn(
                  'relative flex-shrink-0 w-14 h-14 rounded-[4px] overflow-hidden bg-white/10 transition-opacity duration-150',
                  i === index ? 'ring-2 ring-white ring-offset-2 ring-offset-forest-hover' : 'opacity-60 hover:opacity-100'
                )}
                aria-label={`Show image ${i + 1} of ${count}`}
                aria-current={i === index ? 'true' : undefined}
              >
                <Image
                  src={isOptimisable(img.src) ? cloudinaryFit(img.src, 160) : img.src}
                  alt=""
                  fill
                  sizes="56px"
                  unoptimized={!isOptimisable(img.src)}
                  className="object-cover"
                />
              </button>
            ))}
          </div>
        </div>
      )}

      {isZoomed && (
        <p className="sr-only" aria-live="polite">Zoomed to {Math.round(zoom * 100)} percent. Drag to pan.</p>
      )}
    </div>,
    document.body
  )
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
// Wire any image up to a full-size click-to-view lightbox in two lines:
//   const { openLightbox, lightboxNode } = useImageLightbox()
//   <img onClick={() => openLightbox(url, alt)} .../>
//   {lightboxNode}

export function useImageLightbox() {
  const [state, setState] = useState<{ src: string; alt?: string } | null>(null)

  function openLightbox(src: string | null | undefined, alt?: string) {
    if (!src) return
    setState({ src, alt })
  }

  const lightboxNode = state
    ? (
      <ImageLightbox
        images={[{ src: state.src, alt: state.alt || 'Image preview' }]}
        title={state.alt}
        onClose={() => setState(null)}
      />
    )
    : null

  return { openLightbox, lightboxNode }
}
