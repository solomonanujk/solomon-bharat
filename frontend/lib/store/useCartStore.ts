import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { CartLine as CartItem } from '@/types/order-extras'
import type { QuotedSync } from '@/lib/cartQuote'

interface CartState {
  items: CartItem[]
  /** Drives the global "Added to cart" popup — ephemeral, never persisted (see
   *  partialize below), so it doesn't survive a reload. */
  lastAddedItem: CartItem | null
  addedPopupVisible: boolean
}

interface CartActions {
  addItem: (item: CartItem) => void
  removeItem: (productId: string, variantId?: string, isSample?: boolean) => void
  removeItems: (productIds: string[]) => void
  updateQuantity: (productId: string, qty: number, variantId?: string, isSample?: boolean) => void
  /** Stores server-quoted unit price / MOQ on matching lines (no-op when nothing changed). */
  applyQuotedPrices: (updates: QuotedSync[]) => void
  clearCart: () => void
  hideAddedPopup: () => void
  getTotalItems: () => number
  getTotalValueInr: () => number
}

type CartStore = CartState & CartActions

/** A line is unique by product + variant + sample/wholesale. */
function sameLine(i: CartItem, productId: string, variantId?: string, isSample?: boolean): boolean {
  return i.productId === productId && i.variantId === variantId && !!i.isSample === !!isSample
}

/** Wholesale lines respect the MOQ; sample lines stay within 1..sampleMaxQty. */
function clampQty(item: CartItem, qty: number): number {
  if (item.isSample) return Math.min(Math.max(1, qty), Math.max(1, item.sampleMaxQty ?? 1))
  return Math.max(qty, item.moq)
}

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
          const existing = state.items.find((i) => sameLine(i, item.productId, item.variantId, item.isSample))

          if (existing) {
            const newQty = clampQty(existing, existing.quantity + item.quantity)
            const updated = { ...existing, quantity: newQty }
            return {
              items: state.items.map((i) => (i === existing ? updated : i)),
              lastAddedItem: updated,
              addedPopupVisible: true,
            }
          }

          const safeQty = clampQty(item, item.quantity)
          const created = { ...item, quantity: safeQty }
          return { items: [...state.items, created], lastAddedItem: created, addedPopupVisible: true }
        })
      },

      removeItem: (productId: string, variantId?: string, isSample?: boolean) => {
        set((state) => ({
          items: state.items.filter((i) => !sameLine(i, productId, variantId, isSample)),
        }))
      },

      removeItems: (productIds: string[]) => {
        const ids = new Set(productIds)
        set((state) => ({
          items: state.items.filter((i) => !ids.has(i.productId)),
        }))
      },

      updateQuantity: (productId: string, qty: number, variantId?: string, isSample?: boolean) => {
        set((state) => {
          const item = state.items.find((i) => sameLine(i, productId, variantId, isSample))
          if (!item) return state

          // Quantity must be at least the MOQ; if set to 0 or below, remove item
          if (qty <= 0) {
            return { items: state.items.filter((i) => i !== item) }
          }

          const safeQty = clampQty(item, qty)
          return {
            items: state.items.map((i) => (i === item ? { ...i, quantity: safeQty } : i)),
          }
        })
      },

      applyQuotedPrices: (updates: QuotedSync[]) => {
        set((state) => {
          let changed = false
          const items = state.items.map((i) => {
            const u = updates.find((x) => sameLine(i, x.productId, x.variantId, x.isSample))
            if (!u) return i
            const unit = u.unitPriceInr ?? i.unitAdminPriceInr
            if (unit === i.unitAdminPriceInr && u.moq === i.moq) return i
            changed = true
            return { ...i, unitAdminPriceInr: unit, moq: u.moq }
          })
          return changed ? { items } : state
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
