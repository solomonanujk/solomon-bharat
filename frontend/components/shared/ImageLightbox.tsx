'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

// ─── Modal ────────────────────────────────────────────────────────────────────

function ImageLightboxModal({ src, alt, onClose }: { src: string; alt?: string; onClose: () => void }) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-6 bg-black/70"
      role="dialog"
      aria-modal="true"
      aria-label={alt || 'Image preview'}
      onClick={onClose}
    >
      <div
        className="relative max-w-4xl max-h-[85vh] w-full flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute -top-10 right-0 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
        >
          <X size={16} aria-hidden="true" />
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt ?? ''} className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl" />
      </div>
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
    ? <ImageLightboxModal src={state.src} alt={state.alt} onClose={() => setState(null)} />
    : null

  return { openLightbox, lightboxNode }
}
