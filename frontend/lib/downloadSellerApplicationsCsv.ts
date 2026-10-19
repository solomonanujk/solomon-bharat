import api from '@/lib/api'
import { getApiError } from '@/lib/getApiError'
import type { SellerApplicationStatus } from '@/types'

export interface SellerApplicationExportFilters {
  status?: SellerApplicationStatus
  search?: string
  /** `true` exports only starred applications. */
  favourite?: boolean
}

/**
 * Downloads the Seller Applications CSV for the filters currently applied on screen.
 *
 * It goes through the api client (not a plain `<a href>`) because the endpoint needs
 * the Bearer token, and `Content-Disposition` is not readable cross-origin, so the
 * filename is rebuilt here to match what the server sends.
 */
export async function downloadSellerApplicationsCsv(filters: SellerApplicationExportFilters): Promise<void> {
  let res
  try {
    res = await api.get('/sellers/applications/export', {
      params: {
        status: filters.status,
        search: filters.search || undefined,
        // The query param is a string on the wire; only send it when narrowing.
        favourite: filters.favourite ? 'true' : undefined,
      },
      responseType: 'blob',
    })
  } catch (err) {
    // responseType 'blob' applies to error responses too, so the JSON error body
    // arrives as a Blob that getApiError cannot see into — unwrap it first.
    throw new Error(await readErrorMessage(err))
  }

  const blob = new Blob([res.data as Blob], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `seller-applications-${new Date().toISOString().slice(0, 10)}.csv`
  // Safari (and iOS in particular) only honours a download on an element that is in
  // the document, so the link is attached for the click and removed straight after.
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // Revoking immediately can cancel the download on some mobile browsers.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

const FALLBACK_ERROR = 'Could not prepare the CSV. Try again.'

async function readErrorMessage(err: unknown): Promise<string> {
  const data = (err as { response?: { data?: unknown } })?.response?.data
  if (data instanceof Blob) {
    try {
      const parsed = JSON.parse(await data.text()) as { message?: string }
      if (parsed.message) return parsed.message
    } catch {
      // Not JSON (a proxy error page, say) — fall through to the generic message.
    }
  }
  return getApiError(err, FALLBACK_ERROR)
}
