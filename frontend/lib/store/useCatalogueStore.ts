import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export interface CatalogueItem {
  productId: string
  name: string
  slug: string
  image: string
  /** The agent's own resale price/MOQ for this product — defaults to the
   *  product's own displayed price/MOQ when added, editable on the
   *  catalogue-building page before generating the PDF. */
  price: number
  moq: number
}

interface CatalogueState {
  /** True once the agent has explicitly started a catalogue-building session —
   *  drives whether the "Add to catalogue" controls show as active. */
  building: boolean
  items: CatalogueItem[]
  /** Drives the global floating tray — ephemeral, never persisted (see
   *  partialize below), so it auto-hides a few seconds after each add/remove
   *  rather than staying on screen for the whole building session. */
  trayVisible: boolean
}

interface CatalogueActions {
  startBuilding: () => void
  addProduct: (item: CatalogueItem) => void
  removeProduct: (productId: string) => void
  toggleProduct: (item: CatalogueItem) => void
  updateItem: (productId: string, patch: { price?: number; moq?: number }) => void
  hideTray: () => void
  clear: () => void
}

type CatalogueStore = CatalogueState & CatalogueActions

export const useCatalogueStore = create<CatalogueStore>()(
  persist(
    (set, get) => ({
      building: false,
      items: [],
      trayVisible: false,

      startBuilding: () => set({ building: true }),

      addProduct: (item) => {
        set((state) => {
          if (state.items.some((i) => i.productId === item.productId)) return state
          return { building: true, items: [...state.items, item], trayVisible: true }
        })
      },

      removeProduct: (productId) => {
        set((state) => ({
          items: state.items.filter((i) => i.productId !== productId),
          trayVisible: true,
        }))
      },

      toggleProduct: (item) => {
        const exists = get().items.some((i) => i.productId === item.productId)
        if (exists) get().removeProduct(item.productId)
        else get().addProduct(item)
      },

      updateItem: (productId, patch) => {
        set((state) => ({
          items: state.items.map((i) => (i.productId === productId ? { ...i, ...patch } : i)),
        }))
      },

      hideTray: () => set({ trayVisible: false }),

      clear: () => set({ building: false, items: [], trayVisible: false }),
    }),
    {
      name: 'sb_catalogue',
      storage: createJSONStorage(() =>
        typeof window !== 'undefined' ? localStorage : (null as never)
      ),
      partialize: (state) => ({ building: state.building, items: state.items }),
    }
  )
)
