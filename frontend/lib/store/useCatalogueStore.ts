import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Guards against stale/malformed entries left in localStorage from an
 *  earlier build (e.g. a pre-rebuild id scheme, or a half-written item from a
 *  bug) — these never raise an error to the agent, they just quietly fail
 *  backend validation (`productId` isn't a real UUID) when generating a PDF.
 *  Runs once on load via the `migrate` option below, so the store self-heals
 *  instead of requiring the agent to know to clear localStorage by hand. */
function sanitizeItems(raw: unknown): CatalogueItem[] {
  if (!Array.isArray(raw)) return []
  const result: CatalogueItem[] = []
  for (const entry of raw) {
    if (typeof entry !== 'object' || entry === null) continue
    const v = entry as Record<string, unknown>
    if (typeof v.productId !== 'string' || !UUID_RE.test(v.productId)) continue
    if (typeof v.name !== 'string' || typeof v.slug !== 'string' || typeof v.image !== 'string') continue
    if (typeof v.price !== 'number' || typeof v.moq !== 'number') continue
    result.push({
      productId: v.productId,
      name: v.name,
      slug: v.slug,
      image: v.image,
      price: v.price,
      moq: v.moq,
      agentPrice: typeof v.agentPrice === 'number' ? v.agentPrice : v.price,
    })
  }
  return result
}

export interface CatalogueItem {
  productId: string
  name: string
  slug: string
  image: string
  /** The agent's own resale price/MOQ for this product — defaults to
   *  agentPrice below when added, editable on the catalogue-building page
   *  before generating the PDF. */
  price: number
  moq: number
  /** Read-only reference: the price Solomon Bharat (admin) gives this agent
   *  for this product, captured at the moment it was added — never changed
   *  by updateItem, so the agent can always see their margin while editing
   *  their own resale `price` above. */
  agentPrice: number
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
      // Bumped so every existing localStorage entry runs through migrate()
      // once, dropping any item that predates the current id/shape contract.
      version: 1,
      migrate: (persistedState) => {
        const state = persistedState as { building?: unknown; items?: unknown } | null
        return {
          building: typeof state?.building === 'boolean' ? state.building : false,
          items: sanitizeItems(state?.items),
        }
      },
    }
  )
)
