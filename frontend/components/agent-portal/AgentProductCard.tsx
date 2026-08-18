'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Check } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { Product } from '@/types'
import { Price } from '@/components/ui/Price'
import { RatingSummary } from '@/components/shared/StarRating'
import { Button } from '@/components/ui/button'
import { useCartStore } from '@/lib/store/useCartStore'
import { ShareProductButton } from '@/components/agent-portal/ShareProductButton'

interface AgentProductCardProps {
  /** Must have `agentPrice` populated — i.e. fetched via the agent product endpoints. */
  product: Product
  selected?: boolean
  /** Only passed on the catalogue-builder page — renders the selection checkbox. */
  onToggleSelect?: (id: string) => void
  className?: string
}

/**
 * Agent-facing product card — mirrors the buyer `ProductCard`'s image/name/MOQ
 * layout, but shows `agentPrice`, has no wishlist toggle, always carries a
 * share button, and (only on the catalogue-builder page) a selection checkbox.
 */
export function AgentProductCard({ product, selected = false, onToggleSelect, className }: AgentProductCardProps) {
  const { id, name, slug, description, agentPrice, adminPrice, moq, images } = product
  const imageSrc = images?.[0]?.url ?? null
  const price = agentPrice ?? adminPrice

  const addItem = useCartStore((s) => s.addItem)

  function handleAddToCart(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    addItem({
      productId: id,
      productSlug: slug,
      productName: name,
      image: imageSrc ?? '',
      quantity: moq,
      unitAdminPriceInr: price,
      moq,
      leadTime: product.leadTime,
    })
    toast.success(`${name} added to cart`, { description: `Qty: ${moq}` })
  }

  function handleToggleSelect(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    onToggleSelect?.(id)
  }

  return (
    <div className={cn('group flex flex-col', className)}>
      {/* Image — the checkbox/share controls are siblings of this Link, not descendants:
          the share button opens a modal containing its own <a> (WhatsApp link), and a
          nested <a> inside this product-page Link would be invalid HTML with undefined
          click behavior in real browsers. */}
      <div className="relative aspect-square overflow-hidden rounded-sm bg-[#F0EBE3]">
        <Link href={`/products/${slug}`} className="absolute inset-0 block">
          {imageSrc ? (
            <Image
              src={imageSrc}
              alt={name}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="object-cover group-hover:scale-[1.03] transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full bg-[#F0EBE3] flex items-center justify-center">
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true" className="text-[#C8BEAE]">
                <rect x="6" y="10" width="28" height="22" rx="1" stroke="currentColor" strokeWidth="1.5" />
                <circle cx="15" cy="18" r="3" stroke="currentColor" strokeWidth="1.5" />
                <path d="M6 26L13 20L19 25L26 18L34 26" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          )}
        </Link>

        {/* Selection checkbox — only on the catalogue-builder page */}
        {onToggleSelect && (
          <button
            type="button"
            onClick={handleToggleSelect}
            aria-label={selected ? `Remove ${name} from catalogue selection` : `Add ${name} to catalogue selection`}
            aria-pressed={selected}
            className={cn(
              'absolute top-2 left-2 w-6 h-6 rounded flex items-center justify-center border transition-colors',
              selected
                ? 'bg-primary border-primary text-white'
                : 'bg-white/90 border-border-warm text-transparent hover:text-muted-text'
            )}
          >
            <Check size={13} aria-hidden="true" />
          </button>
        )}

        {/* Share — always rendered */}
        <ShareProductButton
          product={{ name, description, slug, images }}
          className="absolute top-2 right-2"
        />
      </div>

      {/* Info */}
      <div className="mt-2 flex flex-col gap-0.5">
        <div className="text-[16px] font-[700] font-public-sans text-primary leading-none">
          <Price amountInr={price} size="md" className="!text-[16px] !font-[700]" />
        </div>

        <Link
          href={`/products/${slug}`}
          className="text-[14px] font-[500] font-public-sans text-primary leading-snug line-clamp-2 hover:underline"
        >
          {name}
        </Link>

        <RatingSummary avgRating={product.avgRating} reviewCount={product.reviewCount} />

        <span className="text-[12px] font-public-sans text-muted-text">
          MOQ: {moq} units
        </span>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleAddToCart}
          className="mt-1.5 w-full"
        >
          Add to cart
        </Button>
      </div>
    </div>
  )
}
