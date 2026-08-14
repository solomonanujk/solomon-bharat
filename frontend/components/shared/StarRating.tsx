'use client'

import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StarRatingProps {
  rating: number
  size?: number
  className?: string
}

/** Read-only star display — rounds to the nearest half star for the fill. */
export function StarRating({ rating, size = 13, className }: StarRatingProps) {
  return (
    <span className={cn('inline-flex items-center gap-0.5', className)} aria-hidden="true">
      {Array.from({ length: 5 }).map((_, i) => {
        const filled = rating >= i + 1
        const half = !filled && rating > i && rating < i + 1
        return (
          <span key={i} className="relative inline-block" style={{ width: size, height: size }}>
            <Star size={size} className="absolute inset-0 text-border-warm" />
            {(filled || half) && (
              <span
                className="absolute inset-0 overflow-hidden"
                style={{ width: half ? '50%' : '100%' }}
              >
                <Star size={size} className="text-accent" fill="currentColor" />
              </span>
            )}
          </span>
        )
      })}
    </span>
  )
}

interface RatingSummaryProps {
  avgRating: number | null
  reviewCount: number
  size?: number
  className?: string
}

/** Single star + "4.5 (12)" text — renders nothing when there are no reviews yet. */
export function RatingSummary({ avgRating, reviewCount, size = 13, className }: RatingSummaryProps) {
  if (!avgRating || reviewCount === 0) return null
  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      <Star size={size} className="text-accent" fill="currentColor" aria-hidden="true" />
      <span className="font-public-sans text-[12px] text-muted-text">
        {avgRating.toFixed(1)} ({reviewCount})
      </span>
    </span>
  )
}
