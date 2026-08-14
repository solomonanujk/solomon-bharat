/**
 * Extracts the user-facing error message from an API error response.
 * When the backend returns field-level validation errors, surfaces the first
 * one as "Field: message" so users know exactly what to fix.
 */
export function getApiError(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const data = (err as { response?: { data?: { message?: string; errors?: { field: string; message: string }[] } } }).response?.data
    if (data?.errors?.length) {
      const first = data.errors[0]
      const label = first.field ? `${humanise(first.field)}: ${first.message}` : first.message
      return label
    }
    if (data?.message) return data.message
  }
  if (err instanceof Error && err.message) return err.message
  return fallback
}

function humanise(field: string): string {
  return field
    .replace(/([A-Z])/g, ' $1')
    .replace(/\./g, ' → ')
    .replace(/^./, (c) => c.toUpperCase())
    .trim()
}
