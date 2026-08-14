'use client'

import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import type { Order, WishlistEntry } from '@/types'

export interface BuyerDashboard {
  activeOrders: number
  pendingOrders: number
  completedOrders: number
  savedProducts: number
  recentOrders: Order[]
}

const ACTIVE_STATUSES = new Set(['CONFIRMED', 'PROCURING', 'COLLECTED', 'IN_TRANSIT'])
const PENDING_STATUSES = new Set(['PENDING_PAYMENT', 'PAYMENT_RECEIVED'])

/**
 * There's no single backend "buyer dashboard" endpoint — this composes the
 * KPI cards prd.md §7.3 asks for from the buyer's own orders + wishlist.
 */
export function useBuyerDashboard() {
  return useQuery<BuyerDashboard>({
    queryKey: ['buyer-dashboard'],
    queryFn: async () => {
      const [ordersRes, wishlistRes] = await Promise.all([
        api.get('/orders/me', { params: { limit: 100 } }),
        api.get('/buyers/me/wishlist'),
      ])

      const orders: Order[] = ordersRes.data.data ?? []
      const wishlist: WishlistEntry[] = wishlistRes.data.data ?? []

      return {
        activeOrders: orders.filter((o) => ACTIVE_STATUSES.has(o.status)).length,
        pendingOrders: orders.filter((o) => PENDING_STATUSES.has(o.status)).length,
        completedOrders: orders.filter((o) => o.status === 'DELIVERED').length,
        savedProducts: wishlist.length,
        recentOrders: orders.slice(0, 5),
      }
    },
    staleTime: 60 * 1000,
  })
}
