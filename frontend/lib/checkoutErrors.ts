import type { MinOrderViolation } from '@/types/brand-orders'

interface ErrorEnvelope {
  response?: {
    status?: number
    data?: { message?: string; meta?: { details?: unknown } }
  }
}

function envelope(err: unknown): ErrorEnvelope['response'] | undefined {
  if (err && typeof err === 'object' && 'response' in err) return (err as ErrorEnvelope).response
  return undefined
}

function isViolation(v: unknown): v is MinOrderViolation {
  if (!v || typeof v !== 'object') return false
  const o = v as Record<string, unknown>
  return typeof o.brandId === 'string' && typeof o.brandName === 'string'
}

/**
 * The backend sends 422 `{ meta: { details: { code: 'MIN_ORDER_VALUE_NOT_MET', details: [...] } } }`.
 * Returns the per-brand violations, or null for any other error.
 */
export function getMinOrderViolations(err: unknown): MinOrderViolation[] | null {
  const res = envelope(err)
  if (res?.status !== 422) return null
  const outer = res.data?.meta?.details
  if (!outer || typeof outer !== 'object') return null
  const o = outer as { code?: unknown; details?: unknown }
  if (o.code !== 'MIN_ORDER_VALUE_NOT_MET') return null
  const list = Array.isArray(o.details) ? o.details.filter(isViolation) : []
  return list.map((v) => ({ ...v, required: Number(v.required), current: Number(v.current) }))
}

/** 400 raised when a cart line's product or brand is no longer purchasable. */
export function isUnavailableItemError(err: unknown): boolean {
  const res = envelope(err)
  return res?.status === 400 && /not available for purchase/i.test(res.data?.message ?? '')
}

/** The product id named in an "unavailable for purchase" 400, if present. */
export function getUnavailableProductId(err: unknown): string | null {
  const m = /Product (\S+) is not available for purchase/i.exec(envelope(err)?.data?.message ?? '')
  return m ? m[1] : null
}
