import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { CartItem } from '@/types'

interface CartState {
  items: CartItem[]
}

interface CartActions {
  addItem: (item: CartItem) => void
  removeItem: (productId: string, variantId?: string) => void
  removeItems: (productIds: string[]) => void
  updateQuantity: (productId: string, qty: number, variantId?: string) => void
  clearCart: () => void
  getTotalItems: () => number
  getTotalValueInr: () => number
}

type CartStore = CartState & CartActions

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      // ─── State ──────────────────────────────────────────────────────────────
      items: [],

      // ─── Actions ────────────────────────────────────────────────────────────

      addItem: (item: CartItem) => {
        set((state) => {
          // A line is unique by product + variant — two different variants of the
          // same product must not collapse into one row with one blended price.
          const existing = state.items.find(
            (i) => i.productId === item.productId && i.variantId === item.variantId
          )

          if (existing) {
            const newQty = Math.max(existing.quantity + item.quantity, existing.moq)
            return {
              items: state.items.map((i) => (i === existing ? { ...i, quantity: newQty } : i)),
            }
          }

          const safeQty = Math.max(item.quantity, item.moq)
          return { items: [...state.items, { ...item, quantity: safeQty }] }
        })
      },

      removeItem: (productId: string, variantId?: string) => {
        set((state) => ({
          items: state.items.filter((i) => !(i.productId === productId && i.variantId === variantId)),
        }))
      },

      removeItems: (productIds: string[]) => {
        const ids = new Set(productIds)
        set((state) => ({
          items: state.items.filter((i) => !ids.has(i.productId)),
        }))
      },

      updateQuantity: (productId: string, qty: number, variantId?: string) => {
        set((state) => {
          const item = state.items.find((i) => i.productId === productId && i.variantId === variantId)
          if (!item) return state

          // Quantity must be at least the MOQ; if set to 0 or below, remove item
          if (qty <= 0) {
            return { items: state.items.filter((i) => i !== item) }
          }

          const safeQty = Math.max(qty, item.moq)
          return {
            items: state.items.map((i) => (i === item ? { ...i, quantity: safeQty } : i)),
          }
        })
      },

      clearCart: () => set({ items: [] }),

      getTotalItems: (): number => {
        return get().items.reduce((sum, item) => sum + item.quantity, 0)
      },

      getTotalValueInr: (): number => {
        return get().items.reduce((sum, item) => sum + item.unitAdminPriceInr * item.quantity, 0)
      },
    }),
    {
      name: 'sb_cart',
      storage: createJSONStorage(() =>
        typeof window !== 'undefined' ? localStorage : (null as never)
      ),
      partialize: (state) => ({ items: state.items }),
    }
  )
)
