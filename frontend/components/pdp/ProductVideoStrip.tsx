'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Play, X } from 'lucide-react'

interface ProductVideo {
  id: string
  url: string
}

function VideoLightbox({ url, onClose }: { url: string; onClose: () => void }) {
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
      className="fixed inset-0 z-[9999] flex items-center justify-center p-6 bg-black/75"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div className="relative bg-[#1a1a1a] rounded-xl shadow-2xl overflow-hidden w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 z-10 w-8 h-8 rounded inline-flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          aria-label="Close video"
        >
          <X size={16} aria-hidden="true" />
        </button>
        <video src={url} controls autoPlay className="w-full max-h-[75vh]" />
      </div>
    </div>,
    document.body
  )
}

/** Small strip of clickable video thumbnails below the main photo gallery — each
 *  opens a simple full-screen video player. Kept separate from PhotoGallery's image
 *  grid (which has three different layouts depending on image count) rather than
 *  interleaved into it. */
export function ProductVideoStrip({ videos, productName }: { videos: ProductVideo[]; productName: string }) {
  const [openUrl, setOpenUrl] = useState<string | null>(null)

  if (!videos || videos.length === 0) return null

  return (
    <div className="flex gap-2 mt-2">
      {videos.map((v, i) => (
        <button
          key={v.id}
          type="button"
          onClick={() => setOpenUrl(v.url)}
          aria-label={`Play ${productName} video ${i + 1}`}
          className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-md overflow-hidden bg-[#1a1a1a] flex-shrink-0 flex items-center justify-center hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <Play size={22} className="text-white" fill="currentColor" aria-hidden="true" />
        </button>
      ))}
      {openUrl && <VideoLightbox url={openUrl} onClose={() => setOpenUrl(null)} />}
    </div>
  )
}
