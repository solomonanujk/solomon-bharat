import { toast } from 'sonner'
import api from '@/lib/api'

export type OrderDocumentType = 'commercial-invoice' | 'packing-list'

/** Downloads an export document PDF. `scope` is 'admin' or 'brand' (the API path segment). */
export async function downloadOrderDocument(scope: 'admin' | 'brand', orderId: string, type: OrderDocumentType) {
  try {
    const res = await api.get(`/orders/${scope}/${orderId}/documents/${type}`, { responseType: 'blob' })
    const url = URL.createObjectURL(res.data as Blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${type}-${orderId.slice(0, 8).toUpperCase()}.pdf`
    a.click()
    URL.revokeObjectURL(url)
  } catch {
    toast.error('Could not generate the document. Try again.')
  }
}
