'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Check, ChevronLeft, ChevronRight, ImageIcon, Move, Upload, X } from 'lucide-react'
import { cloudinaryFill, cloudinaryFit } from '@/lib/cloudinaryImage'

// The draggable circle in the large preview is a fixed 96px handle — the zoom
// factor a small swatch preview needs is however many times SMALLER that 96px
// circle is than the actual rendered image, not a guessed constant (a fixed
// guess was reading "larger" than the circle actually is — the circle covers a
// smaller proportion of a typically-wide preview panel than a flat guess assumes).
export const DRAG_CIRCLE_PX = 96
export const DEFAULT_SWATCH_ZOOM = 4

// Small empirical fine-tune applied only where a swatch crop is actually
// rendered (the nav dots, the variant table thumbnail) — NOT to the stored
// focus value itself, so the drag handle in the large preview keeps tracking
// the cursor exactly. Even with letterbox-aware geometry, combining object-fit:
// cover + object-position with a separate transform: scale + transform-origin
// for the extra zoom has slightly different percentage semantics than a literal
// "same point in the image," which reportedly still read a touch right of the
// actual drag position. Adjust up/down if it drifts either way; there's no
// further principled derivation behind this number.
const FOCUS_X_CORRECTION = 4

/** Where a swatch crop should actually be centered when rendered (nav dots,
 *  variant table) — apply this, not the raw stored focus, wherever the crop
 *  itself is drawn. */
export function correctedSwatchFocus(pos: { x: number; y: number; zoom?: number }): { x: number; y: number; zoom: number } {
  return { x: Math.min(100, Math.max(0, pos.x - FOCUS_X_CORRECTION)), y: pos.y, zoom: pos.zoom ?? DEFAULT_SWATCH_ZOOM }
}

export interface SwatchImageOption {
  id: string
  url: string
}

/** A photo the seller just picked in this same session but hasn't saved yet — no
 *  real URL exists for it until the whole form is submitted. */
export interface NewSwatchImageOption {
  index: number
  previewUrl: string
}

/** Swatch values are either a real, already-saved image URL, or a reference to one
 *  of this session's not-yet-uploaded photos — `new:<index>` into that array. Both
 *  ColorSwatchModal and ProductForm need to agree on this exact prefix. */
export const NEW_IMAGE_PREFIX = 'new:'
export function newImageRef(index: number): string {
  return `${NEW_IMAGE_PREFIX}${index}`
}
export function parseNewImageRef(value: string | undefined): number | null {
  if (!value || !value.startsWith(NEW_IMAGE_PREFIX)) return null
  const n = Number(value.slice(NEW_IMAGE_PREFIX.length))
  return Number.isFinite(n) ? n : null
}

interface ColorSwatchModalProps {
  colorValues: string[]
  images: SwatchImageOption[]
  newImages: NewSwatchImageOption[]
  swatches: Record<string, string>
  /** Where each color's swatch is cropped (0-100%, defaults to center) and how far
   *  zoomed in (defaults to DEFAULT_SWATCH_ZOOM) — lifted up to the parent so it
   *  survives closing/reopening this modal and can drive the same crop wherever
   *  else the swatch thumbnail is shown (e.g. the variant table). */
  focus: Record<string, { x: number; y: number; zoom: number }>
  onFocusChange: (color: string, pos: { x: number; y: number; zoom: number }) => void
  initialColor?: string
  onChange: (color: string, value: string | undefined) => void
  onClose: () => void
}

/** Color-swatch wizard: one color at a time, prev/next navigation and per-color
 *  preview dots built into the picker panel, a large focal-point preview on the
 *  left (drag the circle to choose what the round swatch thumbnail centers on),
 *  and a grid to assign from — both the product's already-uploaded images and any
 *  photos picked in this same session that haven't been saved yet. */
export function ColorSwatchModal({ colorValues, images, newImages, swatches, focus, onFocusChange, initialColor, onChange, onClose }: ColorSwatchModalProps) {
  const [index, setIndex] = useState(() => {
    const i = initialColor ? colorValues.indexOf(initialColor) : -1
    return i >= 0 ? i : 0
  })
  const previewRef = useRef<HTMLDivElement>(null)
  const draggingRef = useRef(false)
  // The preview uses object-contain (so the full photo is visible to drag over,
  // never a server-side crop hiding part of it), which letterboxes any image
  // whose aspect ratio doesn't match the panel's — a fixed bar top/bottom or
  // left/right. A focus percentage computed against the raw panel rect would
  // then be off by exactly that bar's share, which reads as "the position is
  // shifted." These two let the actual rendered image rect be computed instead.
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null)
  const [panelSize, setPanelSize] = useState<{ w: number; h: number } | null>(null)

  const activeColor = colorValues[index] ?? ''
  const activeValue = swatches[activeColor]
  const activeFocus = focus[activeColor] ?? { x: 50, y: 50, zoom: DEFAULT_SWATCH_ZOOM }

  useEffect(() => {
    const el = previewRef.current
    if (!el) return
    const update = () => setPanelSize({ w: el.clientWidth, h: el.clientHeight })
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  /** The image's actual on-screen box within the panel (panel-relative px),
   *  accounting for object-contain letterboxing. Null until both the panel has
   *  been measured and the current image has loaded. */
  function getImageRect(): { left: number; top: number; width: number; height: number } | null {
    if (!panelSize || !naturalSize) return null
    const panelAspect = panelSize.w / panelSize.h
    const imgAspect = naturalSize.w / naturalSize.h
    let width: number
    let height: number
    if (imgAspect > panelAspect) {
      width = panelSize.w
      height = width / imgAspect
    } else {
      height = panelSize.h
      width = height * imgAspect
    }
    return { left: (panelSize.w - width) / 2, top: (panelSize.h - height) / 2, width, height }
  }

  /** Resolves a stored swatch value (a real URL, or a new:<index> reference) to an
   *  actual displayable image source. */
  function resolveDisplaySrc(value: string | undefined): string | undefined {
    const newIndex = parseNewImageRef(value)
    if (newIndex !== null) return newImages.find((n) => n.index === newIndex)?.previewUrl
    return value
  }
  const activeSrc = resolveDisplaySrc(activeValue)

  function goPrev() { setIndex((i) => Math.max(0, i - 1)) }
  function goNext() {
    if (index < colorValues.length - 1) setIndex((i) => i + 1)
    else onClose()
  }
  function handleUploadClick() {
    if (images.length === 0 && newImages.length === 0) {
      toast.error('Add a product image first, then come back here to assign swatches.')
      return
    }
    toast.error('Pick from an image below, or add more photos from the Images & videos section first.')
  }

  function updateFocusFromEvent(e: React.PointerEvent) {
    const el = previewRef.current
    const imgRect = getImageRect()
    if (!el || !imgRect) return
    const panelRect = el.getBoundingClientRect()
    const px = e.clientX - panelRect.left - imgRect.left
    const py = e.clientY - panelRect.top - imgRect.top
    const x = Math.min(100, Math.max(0, (px / imgRect.width) * 100))
    const y = Math.min(100, Math.max(0, (py / imgRect.height) * 100))
    // The real proportion the 96px circle covers of the actual image, not a guess.
    const zoom = Math.max(1, imgRect.width / DRAG_CIRCLE_PX)
    onFocusChange(activeColor, { x, y, zoom })
  }
  function handlePointerDown(e: React.PointerEvent) {
    draggingRef.current = true
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
    updateFocusFromEvent(e)
  }
  function handlePointerMove(e: React.PointerEvent) {
    if (draggingRef.current) updateFocusFromEvent(e)
  }
  function handlePointerUp() { draggingRef.current = false }

  const gridOptions = [
    ...images.map((img) => ({ key: img.id, thumbSrc: cloudinaryFill(img.url, 200, 200), value: img.url })),
    ...newImages.map((n) => ({ key: `new-${n.index}`, thumbSrc: n.previewUrl, value: newImageRef(n.index) })),
  ]

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6 bg-black/45" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="bg-surface rounded-xl w-full max-w-[1180px] max-h-[90vh] overflow-hidden relative flex" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={onClose} aria-label="Close"
          className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-surface flex items-center justify-center text-muted-text hover:text-primary hover:bg-muted-bg transition-colors shadow">
          <X size={16} />
        </button>

        {/* Focal-point preview */}
        <div ref={previewRef} className="relative flex-1 min-h-[560px] bg-muted-bg/40 overflow-hidden touch-none select-none"
          onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerLeave={handlePointerUp}>
          {activeSrc ? (
            <>
              {/* Full, uncropped image (object-contain, not cover) — forcing a
                 server-side crop here (Cloudinary's own auto-gravity) could hide
                 the very part of the photo the seller wants to drag the circle
                 onto. The circle overlay is the only thing that should crop. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={cloudinaryFit(activeSrc, 1200)} alt={`${activeColor} swatch`} className="w-full h-full object-contain" draggable={false}
                onLoad={(e) => setNaturalSize({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })} />
              {(() => {
                const imgRect = getImageRect()
                // Falls back to the raw focus % of the panel until the image has
                // actually loaded and been measured — close enough for an instant,
                // then corrected once getImageRect() has real numbers to work with.
                const left = imgRect ? imgRect.left + (activeFocus.x / 100) * imgRect.width : `${activeFocus.x}%`
                const top = imgRect ? imgRect.top + (activeFocus.y / 100) * imgRect.height : `${activeFocus.y}%`
                return (
                  <div
                    onPointerDown={handlePointerDown}
                    // The huge-spread box-shadow is the trick: it paints outside the
                    // circle's own rounded shape, dimming everything except the round
                    // patch under it — a live preview of exactly what the swatch crop
                    // will look like, not just a handle floating over the full image.
                    className="absolute w-24 h-24 rounded-full border-[3px] border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.55)] cursor-grab active:cursor-grabbing flex items-center justify-center"
                    style={{
                      left: typeof left === 'number' ? `${left}px` : left,
                      top: typeof top === 'number' ? `${top}px` : top,
                      transform: 'translate(-50%, -50%)',
                    }}
                  >
                    <span className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center text-primary">
                      <Move size={16} />
                    </span>
                  </div>
                )
              })()}
            </>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-4 text-center p-8">
              <ImageIcon size={36} className="text-muted-text/60" />
              <p className="text-[14px] font-sans text-muted-text">Upload a product image for your color swatch</p>
            </div>
          )}
        </div>

        {/* Picker */}
        <div className="w-[420px] flex-shrink-0 p-9 overflow-y-auto">
          <div className="flex items-center gap-3 mb-2">
            <button type="button" onClick={goPrev} disabled={index === 0} aria-label="Previous color"
              className="text-muted-text hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
              <ChevronLeft size={20} />
            </button>
            <div className="flex items-center gap-2">
              {colorValues.map((c, i) => {
                const src = resolveDisplaySrc(swatches[c])
                const dotFocus = correctedSwatchFocus(focus[c] ?? { x: 50, y: 50, zoom: DEFAULT_SWATCH_ZOOM })
                return (
                  <button key={c} type="button" onClick={() => setIndex(i)} aria-label={`Go to ${c}`}
                    className={`w-[34px] h-[34px] rounded-full overflow-hidden flex-shrink-0 border-2 transition-colors ${
                      i === index ? 'border-primary' : 'border-transparent'
                    }`}>
                    {src ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={cloudinaryFit(src, 160)} alt="" className="w-full h-full object-cover"
                        style={{
                          objectPosition: `${dotFocus.x}% ${dotFocus.y}%`,
                          transform: `scale(${dotFocus.zoom})`,
                          transformOrigin: `${dotFocus.x}% ${dotFocus.y}%`,
                        }} />
                    ) : (
                      <span className="w-full h-full block bg-muted-bg" />
                    )}
                  </button>
                )
              })}
            </div>
            <button type="button" onClick={goNext} disabled={index === colorValues.length - 1} aria-label="Next color"
              className="text-muted-text hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
              <ChevronRight size={20} />
            </button>
          </div>

          <h2 className="text-[22px] font-[600] font-display text-primary mt-2">{activeColor}</h2>
          <p className="text-[14px] font-sans text-muted-text mt-3 mb-5">
            Choose an image for the color <span className="font-[600]">{activeColor}</span> or add your own.
          </p>

          <div className="grid grid-cols-3 gap-2.5 mb-6">
            <button type="button" onClick={handleUploadClick}
              className="aspect-square rounded-lg border-2 border-dashed border-border-warm flex items-center justify-center text-muted-text hover:border-accent hover:text-primary transition-colors">
              <Upload size={16} />
            </button>
            {gridOptions.map((opt) => {
              const selected = activeValue === opt.value
              return (
                <button key={opt.key} type="button" onClick={() => onChange(activeColor, opt.value)}
                  className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-colors ${
                    selected ? 'border-primary' : 'border-transparent hover:border-border-warm'
                  }`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={opt.thumbSrc} alt="" className="w-full h-full object-cover" />
                  {selected && (
                    <span className="absolute top-1.5 left-1.5 w-5 h-5 rounded-full bg-white flex items-center justify-center shadow">
                      <Check size={12} className="text-primary" strokeWidth={3} />
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          <button type="button" onClick={goNext}
            className="w-full h-11 rounded bg-primary text-white text-[14px] font-[600] font-sans hover:bg-primary/90 transition-colors mb-3.5">
            {index < colorValues.length - 1 ? 'Next color' : 'Finish'}
          </button>
          <div className="text-center">
            <button type="button" onClick={onClose}
              className="text-[13px] font-[500] font-sans text-primary underline hover:text-accent transition-colors">
              Save and exit
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
