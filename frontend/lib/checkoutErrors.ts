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

/** 400 raised when a cart line's product is no longer purchasable. */
export function isUnavailableItemError(err: unknown): boolean {
  const res = envelope(err)
  return res?.status === 400 && /not available for purchase/i.test(res.data?.message ?? '')
}

/** The product id named in an "unavailable for purchase" 400, if present. */
export function getUnavailableProductId(err: unknown): string | null {
  const m = /Product (\S+) is not available for purchase/i.exec(envelope(err)?.data?.message ?? '')
  return m ? m[1] : null
}
