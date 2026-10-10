'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '@/lib/api'
import { getApiError } from '@/lib/getApiError'
import type { ImportCandidate, ProductImportPreview, ProductImportResult } from '@/types'

// ─── Spreadsheet product import — seller self-service and admin on-behalf-of ──
// An undefined sellerProfileId hits the seller's own endpoints
// (/product-import/preview|import); a given one hits the SUPER_ADMIN variants
// (/product-import/sellers/:sellerProfileId/preview|import).

/** Products per import request. The backend accepts up to 100, but it downloads
 *  and re-uploads every image one product at a time, so a full 100-product
 *  batch can run past Node's default 5-minute request timeout. Smaller chunks
 *  also make the progress bar move. */
export const IMPORT_CHUNK_SIZE = 20

/** Client-side mirror of the backend's upload limit. */
export const IMPORT_MAX_FILE_BYTES = 5 * 1024 * 1024

function basePath(sellerProfileId?: string): string {
  return sellerProfileId ? `/product-import/sellers/${sellerProfileId}` : '/product-import'
}

export function usePreviewProductImport(sellerProfileId?: string) {
  return useMutation<ProductImportPreview, Error, File>({
    mutationFn: async (file) => {
      const fd = new FormData()
      fd.append('file', file)
      const res = await api.post(`${basePath(sellerProfileId)}/preview`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return res.data.data as ProductImportPreview
    },
  })
}

export interface ImportProductsInput {
  /** Optional batch fallback; each product's own `categoryId` wins. */
  categoryId?: string
  products: ImportCandidate[]
  /** Called after each chunk with the number of products processed so far. */
  onProgress?: (processed: number, total: number) => void
}

export function useImportProducts(sellerProfileId?: string) {
  const qc = useQueryClient()
  return useMutation<ProductImportResult, Error, ImportProductsInput>({
    mutationFn: async ({ categoryId, products: rawProducts, onProgress }) => {
      // Each product carries its own chosen `categoryId` (omitted when unset).
      const products = rawProducts.map((p) => ({ ...p, categoryId: p.categoryId || undefined }))
      const merged: ProductImportResult = { created: [], failed: [] }
      let processed = 0
      onProgress?.(0, products.length)
      // Sequential on purpose — keeps load on the backend predictable and lets
      // progress advance in order.
      for (let i = 0; i < products.length; i += IMPORT_CHUNK_SIZE) {
        const chunk = products.slice(i, i + IMPORT_CHUNK_SIZE)
        try {
          const res = await api.post(`${basePath(sellerProfileId)}/import`, { ...(categoryId ? { categoryId } : {}), products: chunk })
          const data = res.data.data as ProductImportResult
          merged.created.push(...data.created)
          merged.failed.push(...data.failed)
        } catch (err) {
          // First chunk failing outright (bad category, auth…) is a request-level
          // error — surface it. A later chunk failing shouldn't discard the drafts
          // already created, so record its products as failed and keep going.
          if (i === 0 && products.length <= IMPORT_CHUNK_SIZE) throw err
          const reason = getApiError(err, 'Import request failed.')
          merged.failed.push(...chunk.map((p) => ({ key: p.key, name: p.name, error: reason })))
        }
        processed += chunk.length
        onProgress?.(processed, products.length)
      }
      return merged
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['my-products'] })
      qc.invalidateQueries({ queryKey: ['admin-products'] })
      const created = result.created.length
      if (result.failed.length === 0) {
        toast.success(`Imported ${created} product${created === 1 ? '' : 's'} as drafts.`)
      } else {
        toast.warning(`Imported ${created}, ${result.failed.length} failed — see details.`)
      }
    },
  })
}
