'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Play, X } from 'lucide-react'

interface ProductVideo {
  id: string
  url: string
}

function VideoLightbox({ url, title, onClose }: { url: string; title: string; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = prevOverflow
      trigger?.focus()
    }
  }, [onClose])

  return createPortal(
    <div
      className="on-forest fixed inset-0 z-[9999] flex flex-col bg-forest-hover/95"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div className="flex justify-end px-3 sm:px-6 py-2 border-b border-white/15 flex-shrink-0">
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className="min-h-11 px-4 rounded-[4px] inline-flex items-center gap-2 border border-white text-white font-sans font-[600] text-[14px] leading-[20px] hover:bg-white/10 transition-colors duration-150"
        >
          <X size={16} aria-hidden="true" />
          Close
        </button>
      </div>
      <div className="flex-1 min-h-0 flex items-center justify-center p-4 sm:p-8">
        <video
          src={url}
          controls
          autoPlay
          playsInline
          className="max-w-full max-h-full rounded-[6px] bg-black"
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    </div>,
    document.body
  )
}

/** Row of clickable video tiles below the photo gallery — each opens a simple
 *  full-screen player. Kept separate from PhotoGallery's photo thumbnails rather
 *  than interleaved into them. */
export function ProductVideoStrip({ videos, productName }: { videos: ProductVideo[]; productName: string }) {
  const [open, setOpen] = useState<{ url: string; i: number } | null>(null)

  if (!videos || videos.length === 0) return null

  return (
    <div className="mt-3 flex flex-wrap gap-3">
      {videos.map((v, i) => (
        <button
          key={v.id}
          type="button"
          onClick={() => setOpen({ url: v.url, i })}
          aria-label={`Play ${productName} video ${i + 1}`}
          aria-haspopup="dialog"
          className="relative w-16 h-16 lg:w-[72px] lg:h-[72px] rounded-[4px] bg-forest flex-shrink-0 flex flex-col items-center justify-center gap-1 text-white hover:bg-forest-hover transition-colors duration-150"
        >
          <Play size={18} fill="currentColor" aria-hidden="true" />
          <span className="text-[11px] leading-[14px] font-[600]" aria-hidden="true">Video</span>
        </button>
      ))}
      {open && (
        <VideoLightbox
          url={open.url}
          title={`${productName}, video ${open.i + 1}`}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  )
}
