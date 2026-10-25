import type { PaginatedResult } from '@/types'

/** Turns the API's `{ data, meta }` envelope into the shape the admin tables use. */
export function toPaginated<T>(res: {
  data: { data: unknown; meta?: { total?: number; page?: number; limit?: number; totalPages?: number } }
}): PaginatedResult<T> {
  const items = (res.data.data ?? []) as T[]
  const meta = res.data.meta ?? {}
  return {
    items,
    total: meta.total ?? items.length,
    page: meta.page ?? 1,
    limit: meta.limit ?? items.length,
    totalPages: meta.totalPages ?? 1,
  }
}
