'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import { CheckCircle2, ExternalLink, Package, RefreshCw, ShoppingBag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/shared/EmptyState'
import { CategoryTypeahead, categoryPathLabel } from '@/components/seller-portal/CategoryTypeahead'
import { useCategoryTree } from '@/hooks/queries/useCategories'
import {
  useConnectShopify,
  useDisconnectShopify,
  useImportShopifyProducts,
  useShopifyConnectionStatus,
  useShopifyProducts,
  useSyncShopifyNow,
  useToggleShopifySync,
} from '@/hooks/queries/useShopifyImport'

const INPUT_CLS =
  'w-full h-10 px-3 rounded border border-[#E5E1D8] bg-white text-[14px] font-sans text-[#1A1A1A] placeholder:text-[#9CA3AF] focus:outline-none focus:border-[#A68B67] transition-colors'

function timeAgo(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.floor(hours / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

// ─── Connect form ───────────────────────────────────────────────────────────

function ConnectForm({ sellerId }: { sellerId?: string }) {
  const [shopDomain, setShopDomain] = useState('')
  const [accessToken, setAccessToken] = useState('')
  const connect = useConnectShopify(sellerId)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    connect.mutate({ shopDomain: shopDomain.trim(), accessToken: accessToken.trim() })
  }

  return (
    <div className="bg-white border border-[#E5E1D8] rounded-xl p-6">
      <div className="flex items-center gap-2 mb-1">
        <ShoppingBag size={16} className="text-[#A68B67]" aria-hidden="true" />
        <h2 className="text-[16px] font-[700] font-sans text-[#1A1A1A]">Connect your Shopify store</h2>
      </div>
      <p className="text-[13px] font-sans text-[#6B6460] mb-5 max-w-lg">
        In your Shopify admin, go to <strong>Settings → Apps and sales channels → Develop apps</strong>, create an
        app, grant it the <code className="text-[12px] bg-[#F5F0E8] px-1 py-0.5 rounded">read_products</code> Admin
        API scope, install it, and reveal the Admin API access token.
      </p>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
        <div>
          <label className="block text-[12px] font-[600] font-sans text-[#6B6460] mb-1.5">Shop domain</label>
          <input
            type="text"
            value={shopDomain}
            onChange={(e) => setShopDomain(e.target.value)}
            placeholder="my-shop.myshopify.com"
            className={INPUT_CLS}
            required
          />
        </div>
        <div>
          <label className="block text-[12px] font-[600] font-sans text-[#6B6460] mb-1.5">Admin API access token</label>
          <input
            type="password"
            value={accessToken}
            onChange={(e) => setAccessToken(e.target.value)}
            placeholder="shpat_…"
            className={INPUT_CLS}
            required
          />
        </div>
        <div className="sm:col-span-2">
          <Button type="submit" variant="primary" size="md" disabled={connect.isPending}>
            {connect.isPending ? 'Connecting…' : 'Connect'}
          </Button>
        </div>
      </form>
    </div>
  )
}

// ─── Connection status bar ──────────────────────────────────────────────────

function ConnectionStatusBar({
  sellerId,
  shopDomain,
  syncEnabled,
  lastSyncedAt,
  lastSyncError,
}: {
  sellerId?: string
  shopDomain: string
  syncEnabled: boolean
  lastSyncedAt: string | null | undefined
  lastSyncError: string | null | undefined
}) {
  const toggleSync = useToggleShopifySync(sellerId)
  const syncNow = useSyncShopifyNow(sellerId)
  const disconnect = useDisconnectShopify(sellerId)

  return (
    <div className="bg-white border border-[#E5E1D8] rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
      <div>
        <div className="flex items-center gap-2">
          <CheckCircle2 size={15} className="text-[#6B7E6B]" aria-hidden="true" />
          <p className="text-[14px] font-[600] font-sans text-[#1A1A1A]">{shopDomain}</p>
        </div>
        <p className="text-[12px] font-sans text-[#6B6460] mt-1">
          {lastSyncError ? (
            <span className="text-[#BA1A1A]">Last sync failed: {lastSyncError}</span>
          ) : lastSyncedAt ? (
            `Last synced ${timeAgo(lastSyncedAt)}`
          ) : (
            'Not synced yet'
          )}
        </p>
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={syncEnabled}
            onChange={(e) => toggleSync.mutate(e.target.checked)}
            className="w-4 h-4 rounded border-[#E5E1D8] accent-[#1A1A1A]"
          />
          <span className="text-[12.5px] font-sans text-[#1A1A1A]">Keep in sync</span>
        </label>
        <Button variant="ghost" size="sm" onClick={() => syncNow.mutate()} disabled={syncNow.isPending} className="gap-1.5">
          <RefreshCw size={13} aria-hidden="true" />
          {syncNow.isPending ? 'Starting…' : 'Sync now'}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (window.confirm('Disconnect this Shopify store? Already-imported products stay as they are.')) {
              disconnect.mutate()
            }
          }}
        >
          Disconnect
        </Button>
      </div>
    </div>
  )
}

// ─── Product grid + import ──────────────────────────────────────────────────

function ProductGrid({ sellerId }: { sellerId?: string }) {
  const { data: tree = [] } = useCategoryTree()
  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useShopifyProducts(sellerId)
  const importProducts = useImportShopifyProducts(sellerId)

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [categoryId, setCategoryId] = useState('')

  const products = useMemo(() => data?.pages.flatMap((p) => p.items) ?? [], [data])

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleImport() {
    importProducts.mutate(
      { shopifyProductIds: Array.from(selected), categoryId },
      { onSuccess: () => setSelected(new Set()) },
    )
  }

  if (isLoading) {
    return <div className="h-48 bg-[#F5F0E8] rounded-xl animate-pulse" />
  }

  if (products.length === 0) {
    return <EmptyState title="No products found" description="This Shopify store has no products to import yet." />
  }

  return (
    <div className="bg-white border border-[#E5E1D8] rounded-xl p-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
        {products.map((p) => {
          const isSelected = selected.has(p.shopifyProductId)
          return (
            <button
              key={p.shopifyProductId}
              type="button"
              onClick={() => toggle(p.shopifyProductId)}
              className={`text-left rounded-lg border-2 overflow-hidden transition-colors ${
                isSelected ? 'border-[#A68B67]' : 'border-[#E5E1D8] hover:border-[#C4BDB4]'
              }`}
            >
              <div className="relative aspect-square bg-[#F5F0E8]">
                {p.thumbnail ? (
                  <Image src={p.thumbnail} alt={p.title} fill sizes="200px" className="object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package size={24} className="text-[#C4BDB4]" aria-hidden="true" />
                  </div>
                )}
                <div className="absolute top-2 left-2 w-5 h-5 rounded border-2 border-white bg-black/20 flex items-center justify-center">
                  {isSelected && <CheckCircle2 size={14} className="text-white" fill="currentColor" aria-hidden="true" />}
                </div>
              </div>
              <div className="p-2.5">
                <p className="text-[12.5px] font-[600] font-sans text-[#1A1A1A] truncate">{p.title}</p>
                <p className="text-[11px] font-sans text-[#6B6460] mt-0.5">
                  {p.variantCount > 1 ? `${p.variantCount} variants` : '1 variant'} ·{' '}
                  {p.minPrice === p.maxPrice ? p.minPrice : `${p.minPrice}–${p.maxPrice}`}
                </p>
              </div>
            </button>
          )
        })}
      </div>

      {hasNextPage && (
        <div className="text-center mb-6">
          <Button variant="ghost" size="sm" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
            {isFetchingNextPage ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      )}

      <div className="border-t border-[#E5E1D8] pt-5 flex flex-wrap items-end justify-between gap-4">
        <div className="w-full sm:w-80">
          <label className="block text-[12px] font-[600] font-sans text-[#6B6460] mb-1.5">
            Import into category
          </label>
          <CategoryTypeahead tree={tree} value={categoryId} onChange={setCategoryId} className={INPUT_CLS} />
          {categoryId && (
            <p className="text-[11.5px] font-sans text-[#6B6460] mt-1.5">{categoryPathLabel(tree, categoryId)}</p>
          )}
        </div>
        <Button
          variant="primary"
          size="md"
          disabled={selected.size === 0 || !categoryId || importProducts.isPending}
          onClick={handleImport}
        >
          {importProducts.isPending ? 'Importing…' : `Import ${selected.size} product${selected.size === 1 ? '' : 's'}`}
        </Button>
      </div>

      {importProducts.data && importProducts.data.failed.length > 0 && (
        <div className="mt-4 bg-[#FDECEC] border border-[#F3C9C9] rounded-lg p-3.5">
          <p className="text-[12.5px] font-[600] font-sans text-[#BA1A1A] mb-1.5">
            {importProducts.data.failed.length} product{importProducts.data.failed.length === 1 ? '' : 's'} could not be imported
          </p>
          <ul className="text-[12px] font-sans text-[#6B6460] space-y-0.5">
            {importProducts.data.failed.map((f) => (
              <li key={f.shopifyProductId}>{f.shopifyProductId}: {f.reason}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

// ─── Root component ─────────────────────────────────────────────────────────

/** Drives both the seller self-service import page and the admin
 *  on-behalf-of page — pass `sellerIdOverride` for the admin case. */
export function ShopifyProductPicker({ sellerIdOverride }: { sellerIdOverride?: string }) {
  const { data: status, isLoading } = useShopifyConnectionStatus(sellerIdOverride)

  if (isLoading) {
    return <div className="h-40 bg-[#F5F0E8] rounded-xl animate-pulse" />
  }

  if (!status?.connected) {
    return <ConnectForm sellerId={sellerIdOverride} />
  }

  return (
    <div className="flex flex-col gap-5">
      <ConnectionStatusBar
        sellerId={sellerIdOverride}
        shopDomain={status.shopDomain ?? ''}
        syncEnabled={status.syncEnabled ?? true}
        lastSyncedAt={status.lastSyncedAt}
        lastSyncError={status.lastSyncError}
      />
      <ProductGrid sellerId={sellerIdOverride} />
      <p className="text-[11.5px] font-sans text-[#9CA3AF] flex items-center gap-1.5">
        <ExternalLink size={11} aria-hidden="true" />
        Imported products land as drafts — confirm MOQ and your wholesale price on each before publishing.
      </p>
    </div>
  )
}
