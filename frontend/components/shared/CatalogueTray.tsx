'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { Layers } from 'lucide-react'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { useCatalogueStore } from '@/lib/store/useCatalogueStore'

const AUTO_DISMISS_MS = 4000

/**
 * Global floating tray — agent-only. Pops up right after a product is added to
 * (or removed from) the in-progress catalogue, then auto-dismisses a few
 * seconds later, same pattern as AddedToCartPopup — it's a confirmation toast,
 * not a permanent progress bar. Links to /catalogue to set price/MOQ per
 * product and generate — never generates directly from here, since every
 * product needs the agent's own price/MOQ set first.
 */
export function CatalogueTray() {
  const user = useAuthStore((s) => s.user)
  const items = useCatalogueStore((s) => s.items)
  const trayVisible = useCatalogueStore((s) => s.trayVisible)
  const hideTray = useCatalogueStore((s) => s.hideTray)

  const visible = user?.role === 'AGENT' && trayVisible && items.length > 0

  useEffect(() => {
    if (!visible) return
    const timer = setTimeout(hideTray, AUTO_DISMISS_MS)
    return () => clearTimeout(timer)
  }, [visible, items, hideTray])

  if (!visible) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] w-[92vw] max-w-[440px] bg-primary text-white rounded-full shadow-xl px-5 py-3 flex items-center gap-4"
    >
      <Layers size={16} className="flex-shrink-0" aria-hidden="true" />
      <p className="text-[13px] font-[600] font-public-sans flex-1">
        {items.length} {items.length === 1 ? 'product' : 'products'} in catalogue
      </p>
      <Link
        href="/catalogue"
        onClick={hideTray}
        className="text-[13px] font-[600] font-public-sans bg-white text-primary rounded-full px-3 py-1.5 hover:bg-white/90 transition-colors"
      >
        Set price &amp; generate
      </Link>
    </div>
  )
}
