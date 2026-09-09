import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { CartItem } from '@/types'

interface CartState {
  items: CartItem[]
  /** Drives the global "Added to cart" popup — ephemeral, never persisted (see
   *  partialize below), so it doesn't survive a reload. */
  lastAddedItem: CartItem | null
  addedPopupVisible: boolean
}

interface CartActions {
  addItem: (item: CartItem) => void
  removeItem: (productId: string, variantId?: string) => void
  removeItems: (productIds: string[]) => void
  updateQuantity: (productId: string, qty: number, variantId?: string) => void
  clearCart: () => void
  hideAddedPopup: () => void
  getTotalItems: () => number
  getTotalValueInr: () => number
}

type CartStore = CartState & CartActions

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      // ─── State ──────────────────────────────────────────────────────────────
      items: [],
      lastAddedItem: null,
      addedPopupVisible: false,

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
            const updated = { ...existing, quantity: newQty }
            return {
              items: state.items.map((i) => (i === existing ? updated : i)),
              lastAddedItem: updated,
              addedPopupVisible: true,
            }
          }

          const safeQty = Math.max(item.quantity, item.moq)
          const created = { ...item, quantity: safeQty }
          return { items: [...state.items, created], lastAddedItem: created, addedPopupVisible: true }
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

      hideAddedPopup: () => set({ addedPopupVisible: false }),

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
