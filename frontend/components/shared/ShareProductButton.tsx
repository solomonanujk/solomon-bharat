'use client'

import { useState } from 'react'
import { Share2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ShareFallbackModal } from '@/components/shared/ShareFallbackModal'
import type { Product } from '@/types'

interface ShareProductButtonProps {
  product: Pick<Product, 'name' | 'slug'> & { description?: string; images: { url: string }[] }
  className?: string
}

/**
 * Icon button that shares a product via the native Web Share API (with the
 * product image attached where supported), falling back to a small modal
 * (WhatsApp text link / copy link / download image) when the API is
 * unavailable, the user's browser can't share files, or the user cancels.
 */
export function ShareProductButton({ product, className }: ShareProductButtonProps) {
  const [fallbackOpen, setFallbackOpen] = useState(false)

  async function handleShare(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()

    const imageUrl = product.images?.[0]?.url
    const shareData: ShareData = { title: product.name, text: `${product.name}\n${product.description ?? ''}` }

    if (imageUrl) {
      try {
        const res = await fetch(imageUrl)
        const blob = await res.blob()
        const file = new File([blob], `${product.slug}.jpg`, { type: blob.type || 'image/jpeg' })
        if (navigator.canShare?.({ files: [file] })) shareData.files = [file]
      } catch {
        // fall through without files
      }
    }

    if (navigator.share && (!shareData.files || navigator.canShare?.(shareData))) {
      try {
        await navigator.share(shareData)
        return
      } catch {
        // user cancelled — fall through to the manual fallback
      }
    }

    setFallbackOpen(true)
  }

  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/products/${product.slug}` : undefined

  return (
    <>
      <button
        type="button"
        onClick={handleShare}
        aria-label={`Share ${product.name}`}
        className={cn(
          'w-8 h-8 rounded-full bg-white/90 flex items-center justify-center shadow-sm text-muted-text hover:text-primary transition-colors',
          className
        )}
      >
        <Share2 size={13} aria-hidden="true" />
      </button>

      <ShareFallbackModal
        open={fallbackOpen}
        onOpenChange={setFallbackOpen}
        productName={product.name}
        productDescription={product.description ?? ''}
        shareUrl={shareUrl}
        imageUrl={product.images?.[0]?.url}
      />
    </>
  )
}
