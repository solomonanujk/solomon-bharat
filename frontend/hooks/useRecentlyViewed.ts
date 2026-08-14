'use client'

import { useState, useEffect, useCallback } from 'react'

const KEY = 'sb_recently_viewed'
const MAX = 20

// No seller/brand fields — sellers are never shown to buyers.
export interface RecentProduct {
  id: string
  slug: string
  name: string
  imageUrl: string
  price: number
  moq: number
  avgRating: number | null
  reviewCount: number
  leadTime: string | null
}

function read(): RecentProduct[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]')
  } catch {
    return []
  }
}

function write(items: RecentProduct[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items))
  } catch {}
}

export function useRecentlyViewed() {
  const [products, setProducts] = useState<RecentProduct[]>([])

  useEffect(() => {
    setProducts(read())
  }, [])

  const track = useCallback((product: RecentProduct) => {
    setProducts((prev) => {
      const deduped = prev.filter((p) => p.id !== product.id)
      const next = [product, ...deduped].slice(0, MAX)
      write(next)
      return next
    })
  }, [])

  return { products, track }
}
