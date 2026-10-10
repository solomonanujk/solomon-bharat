'use client'

import { useCallback, useMemo } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

// ─── Sort ─────────────────────────────────────────────────────────────────────
// Only what the backend's GET /products actually supports (publicProductListQuerySchema):
//   - `newest`   — the repository's default `createdAt desc` order.
//   - `featured` — narrows to admin-featured products (it's a filter on the API
//                  side, not a re-ordering), still in newest-first order.
//   - `trending` — order-volume driven, but the API IGNORES every other filter
//                  (category, collection, search, facets) for it, so it is only
//                  offered as the navbar's unscoped /search quick link.
// No name or price ordering exists on the API, so "Name A–Z" and price sorts are
// deliberately not offered.

export type CatalogueSort = 'newest' | 'featured'
export type UrlSort = CatalogueSort | 'trending'

export const DEFAULT_SORT: CatalogueSort = 'newest'

export const SORT_OPTIONS: { value: CatalogueSort; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'featured', label: 'Featured' },
]

// ─── Filters ──────────────────────────────────────────────────────────────────

export interface ProductFilterValues {
  /** Any level — the API resolves it to every leaf-descendant category. */
  categoryId: string | null
  /** Seller-entered place of origin ("Made in"), values from /products/facets/place-of-origin. */
  placeOfOrigin: string
  /** Contains-match on the seller's lead-time text. */
  leadTime: string
  /** Marketplace brand slug (single-select; the API takes one `brand`). Empty = any. */
  brand: string
  /** Solomon-curated products only (hides marketplace brands). Mutually exclusive with `brand`. */
  curated: boolean
  /** Products whose MOQ is at most this many units. */
  moqMax: number | undefined
  /** Buyer price range (signed-in buyers/agents only — stripped for guests; the API 400s it). */
  priceMin: string
  priceMax: string
}

export const EMPTY_FILTERS: ProductFilterValues = {
  categoryId: null,
  placeOfOrigin: '',
  leadTime: '',
  brand: '',
  curated: false,
  moqMax: undefined,
  priceMin: '',
  priceMax: '',
}

/** Filters actively narrowing results, ignoring the page's own fixed category. */
export function activeFilterCount(filters: ProductFilterValues, rootCategoryId?: string): number {
  let count = 0
  if (filters.categoryId && filters.categoryId !== rootCategoryId) count += 1
  if (filters.placeOfOrigin) count += 1
  if (filters.leadTime) count += 1
  if (filters.brand) count += 1
  if (filters.curated) count += 1
  if (filters.moqMax) count += 1
  if (filters.priceMin || filters.priceMax) count += 1
  return count
}

// ─── URL state ────────────────────────────────────────────────────────────────
// Every piece of catalogue state lives in the URL so results are shareable and
// survive reloads/back navigation:
//   q, category, origin, lead, brand, curated, moq, minPrice, maxPrice, sort, page

export interface CatalogueUrlState {
  q: string
  sort: UrlSort | null
  page: number
  filters: ProductFilterValues
}

const KEYS = {
  q: 'q',
  category: 'category',
  origin: 'origin',
  lead: 'lead',
  brand: 'brand',
  curated: 'curated',
  moq: 'moq',
  minPrice: 'minPrice',
  maxPrice: 'maxPrice',
  sort: 'sort',
  page: 'page',
} as const

function parseSort(value: string | null): UrlSort | null {
  return value === 'newest' || value === 'featured' || value === 'trending' ? value : null
}

function parsePositiveInt(value: string | null): number | undefined {
  if (!value) return undefined
  const n = Number(value)
  return Number.isInteger(n) && n > 0 ? n : undefined
}

function parseAmount(value: string | null): string {
  if (!value) return ''
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? value : ''
}

export function parseCatalogueParams(params: URLSearchParams): CatalogueUrlState {
  return {
    q: params.get(KEYS.q)?.trim() ?? '',
    sort: parseSort(params.get(KEYS.sort)),
    page: parsePositiveInt(params.get(KEYS.page)) ?? 1,
    filters: {
      categoryId: params.get(KEYS.category) || null,
      placeOfOrigin: params.get(KEYS.origin) ?? '',
      leadTime: params.get(KEYS.lead) ?? '',
      brand: params.get(KEYS.brand) ?? '',
      // Curated and Brand are mutually exclusive; a brand in the URL wins.
      curated: params.get(KEYS.curated) === '1' && !params.get(KEYS.brand),
      moqMax: parsePositiveInt(params.get(KEYS.moq)),
      priceMin: parseAmount(params.get(KEYS.minPrice)),
      priceMax: parseAmount(params.get(KEYS.maxPrice)),
    },
  }
}

function setOrDelete(params: URLSearchParams, key: string, value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') params.delete(key)
  else params.set(key, String(value))
}

export function serializeCatalogueParams(state: CatalogueUrlState, base?: URLSearchParams): string {
  // Start from the current params so unrelated keys (e.g. tracking params) survive.
  const params = new URLSearchParams(base?.toString() ?? '')
  setOrDelete(params, KEYS.q, state.q)
  setOrDelete(params, KEYS.sort, state.sort)
  setOrDelete(params, KEYS.page, state.page > 1 ? state.page : null)
  setOrDelete(params, KEYS.category, state.filters.categoryId)
  setOrDelete(params, KEYS.origin, state.filters.placeOfOrigin)
  setOrDelete(params, KEYS.lead, state.filters.leadTime)
  setOrDelete(params, KEYS.brand, state.filters.brand)
  setOrDelete(params, KEYS.curated, state.filters.curated && !state.filters.brand ? '1' : null)
  setOrDelete(params, KEYS.moq, state.filters.moqMax)
  setOrDelete(params, KEYS.minPrice, state.filters.priceMin)
  setOrDelete(params, KEYS.maxPrice, state.filters.priceMax)
  return params.toString()
}

export interface CatalogueUrlPatch {
  q?: string
  sort?: UrlSort | null
  page?: number
  filters?: ProductFilterValues
}

/**
 * Reads/writes catalogue state from the URL. Any change other than an explicit
 * `page` resets to page 1. Must be rendered inside a <Suspense> boundary
 * (useSearchParams).
 */
export function useCatalogueUrlState() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const searchKey = searchParams.toString()

  const state = useMemo(() => parseCatalogueParams(new URLSearchParams(searchKey)), [searchKey])

  const update = useCallback(
    (patch: CatalogueUrlPatch) => {
      const next: CatalogueUrlState = {
        q: patch.q ?? state.q,
        sort: patch.sort !== undefined ? patch.sort : state.sort,
        filters: patch.filters ?? state.filters,
        page: patch.page ?? 1,
      }
      const qs = serializeCatalogueParams(next, new URLSearchParams(searchKey))
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [router, pathname, searchKey, state]
  )

  return { state, update }
}
