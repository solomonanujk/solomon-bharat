'use client'

import { useState } from 'react'
import { Download, Link2, MessageCircleMore } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface ShareFallbackModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  productName: string
  productDescription: string
  /** Absolute URL to the product's public page, when one exists. */
  shareUrl?: string
  imageUrl?: string | null
}

/**
 * Shown when the Web Share API isn't available (or the user's device can't
 * share the image file) — offers a WhatsApp text link, a "copy link" action,
 * and a manual image download. No Instagram fallback: there is no reliable
 * web share-intent scheme for it outside the native share sheet already
 * attempted before this modal opens.
 */
export function ShareFallbackModal({
  open,
  onOpenChange,
  productName,
  productDescription,
  shareUrl,
  imageUrl,
}: ShareFallbackModalProps) {
  const [copied, setCopied] = useState(false)

  const shareText = `${productName}\n${productDescription}`
  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(shareUrl ? `${shareText}\n${shareUrl}` : shareText)}`

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl || shareText)
      setCopied(true)
      toast.success('Copied to clipboard')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Could not copy — try selecting and copying manually.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Share {productName}</DialogTitle>
          <DialogDescription>
            Native sharing isn&apos;t available here — use one of these instead.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-6 flex flex-col gap-3">
          <a
            href={whatsappHref}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 border border-border-warm rounded px-4 py-3 hover:bg-muted-bg transition-colors"
          >
            <MessageCircleMore size={16} className="text-accent shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-[14px] font-[700] font-public-sans text-primary">Share via WhatsApp</p>
              <p className="text-[11.5px] font-public-sans text-muted-text mt-0.5">
                Opens WhatsApp with the product details — attach the image separately.
              </p>
            </div>
          </a>

          <button
            type="button"
            onClick={handleCopyLink}
            className="flex items-center gap-3 border border-border-warm rounded px-4 py-3 hover:bg-muted-bg transition-colors text-left"
          >
            <Link2 size={16} className="text-accent shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-[14px] font-[700] font-public-sans text-primary">
                {copied ? 'Copied!' : 'Copy link'}
              </p>
              <p className="text-[11.5px] font-public-sans text-muted-text mt-0.5">
                {shareUrl ? 'Copies the product page link.' : 'Copies the product name and description.'}
              </p>
            </div>
          </button>

          {imageUrl && (
            <a
              href={imageUrl}
              download
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 border border-border-warm rounded px-4 py-3 hover:bg-muted-bg transition-colors"
            >
              <Download size={16} className="text-accent shrink-0" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-[14px] font-[700] font-public-sans text-primary">Download image</p>
                <p className="text-[11.5px] font-public-sans text-muted-text mt-0.5">
                  Save the product photo to attach wherever you&apos;re sharing it.
                </p>
              </div>
            </a>
          )}

          <Button variant="ghost" size="md" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
