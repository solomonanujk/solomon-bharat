'use client'

import { useCurrencyStore } from '@/lib/store/useCurrencyStore'
import { cn } from '@/lib/utils'

interface PriceProps {
  /** Wholesale price in INR (stored unit) */
  amountInr: number
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

const sizeClass = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg font-semibold',
}

/** Returns a formatter function that converts INR → selected currency string. */
export function useFormatPrice() {
  const { currency, convertFromINR } = useCurrencyStore()
  return (amountInr: number) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(convertFromINR(amountInr))
}

/**
 * Always renders the converted price for everyone, guest or signed in.
 * Pricing is not gated behind authentication in this product.
 */
export function Price({ amountInr, className, size = 'md' }: PriceProps) {
  const { currency, convertFromINR } = useCurrencyStore()

  const converted = convertFromINR(amountInr)
  const formatted = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(converted)

  return <span className={cn(sizeClass[size], className)}>{formatted}</span>
}
