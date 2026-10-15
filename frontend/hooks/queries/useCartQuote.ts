'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { useCartStore } from '@/lib/store/useCartStore'
import { findQuoteLine, quoteKey, quoteSyncUpdates, type QuotableItem } from '@/lib/cartQuote'
import type { CartQuote, QuoteLine } from '@/types'

const DEBOUNCE_MS = 300
const MAX_QUOTE_ITEMS = 100

interface Snapshot {
  key: string
  items: QuotableItem[]
}

/**
 * Server-priced cart: POST /orders/quote returns exactly what checkout will charge.
 * Quantity changes are debounced; the previous quote stays on screen while a new one
 * loads so the UI never flashes. Also syncs quoted unit price / MOQ back into the
 * cart store (from an effect, never during render) so other surfaces stay consistent.
 */
export function useCartQuote(items: QuotableItem[]) {
  const { user, isAuthenticated } = useAuth()
  const role = user?.role
  const canQuote = isAuthenticated && (role === 'BUYER' || role === 'AGENT')

  const key = useMemo(() => quoteKey(items), [items])
  const [snapshot, setSnapshot] = useState<Snapshot>({ key, items })

  useEffect(() => {
    if (key === snapshot.key) return
    const t = setTimeout(() => setSnapshot({ key, items }), DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [key, items, snapshot.key])

  const request = snapshot.items.slice(0, MAX_QUOTE_ITEMS)
  const query = useQuery<CartQuote>({
    queryKey: ['cart-quote', role, snapshot.key],
    queryFn: async () => {
      const res = await api.post<{ data: CartQuote }>('/orders/quote', {
        items: request.map((i) => ({
          productId: i.productId,
          ...(i.variantId ? { variantId: i.variantId } : {}),
          ...(i.isSample ? { isSample: true } : {}),
          quantity: i.quantity,
        })),
      })
      return res.data.data
    },
    enabled: canQuote && request.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 30 * 1000,
  })

  const quote = canQuote && items.length > 0 ? query.data : undefined

  // Push quoted price/MOQ back into the persisted cart (only lines whose quote matches the current quantity).
  useEffect(() => {
    if (!quote) return
    const updates = quoteSyncUpdates(items, quote)
    if (updates.length > 0) useCartStore.getState().applyQuotedPrices(updates)
  }, [quote, items])

  const quoteFor = useCallback(
    (productId: string, variantId?: string | null): QuoteLine | undefined => findQuoteLine(quote, productId, variantId),
    [quote]
  )

  const hasProblems = !!quote?.lines.some((l) => l.status !== 'OK')
  const inFlight = canQuote && items.length > 0 && (query.isFetching || key !== snapshot.key)

  return {
    /** Quotes are only requested for a signed-in buyer/agent with at least one line. */
    isActive: canQuote && items.length > 0,
    quote,
    quoteFor,
    /** A quote request is running or a quantity change is waiting to be sent. */
    isFetching: inFlight,
    /** First quote has not arrived yet. */
    isInitialLoading: canQuote && items.length > 0 && !quote && !query.isError,
    isError: query.isError,
    subtotalInr: quote?.subtotalInr ?? null,
    hasProblems,
  }
}
