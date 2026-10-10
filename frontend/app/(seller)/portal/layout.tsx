'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Bell, Search, LayoutDashboard, Package, ShoppingBag, Wallet, Settings, Store } from 'lucide-react'
import { PortalSidebar } from '@/components/seller-portal/PortalSidebar'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { useMySellerProfile } from '@/hooks/queries/useSellers'

const MOBILE_TABS = [
  { href: '/portal', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/portal/products', label: 'Products', icon: Package },
  { href: '/portal/orders', label: 'Orders', icon: ShoppingBag },
  { href: '/portal/payouts', label: 'Payouts', icon: Wallet },
  { href: '/portal/settings', label: 'Settings', icon: Settings },
]

const BRAND_MOBILE_TABS = [
  { href: '/portal', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/portal/brand', label: 'Brand', icon: Store },
  { href: '/portal/products', label: 'Products', icon: Package },
  { href: '/portal/orders', label: 'Sales', icon: ShoppingBag },
  { href: '/portal/payouts', label: 'Payouts', icon: Wallet },
]

export default function SellerPortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const user = useAuthStore((s) => s.user)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const hasHydrated = useAuthStore((s) => s._hasHydrated)

  useEffect(() => {
    if (!hasHydrated) return
    if (!isAuthenticated || user?.role !== 'SELLER') {
      router.replace('/')
    }
  }, [hasHydrated, isAuthenticated, user, router])

  const { data: profile } = useMySellerProfile()
  const sellerName = profile?.brand?.name ?? profile?.businessName ?? 'Seller'
  const mobileTabs = profile?.sellerType === 'MARKETPLACE' ? BRAND_MOBILE_TABS : MOBILE_TABS
  const sellerInitials = sellerName
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  if (!hasHydrated) return null
  if (!isAuthenticated || user?.role !== 'SELLER') return null

  return (
    <div className="flex min-h-screen bg-[#F5F0E5]">
      {/* Sidebar — hidden on mobile */}
      <div className="hidden lg:block">
        <PortalSidebar />
      </div>

      {/* Main area */}
      <div className="flex-1 min-w-0 lg:ml-[200px] flex flex-col min-h-screen">
        {/* Top bar */}
        <header className="h-16 border-b border-[#E5DCCB] bg-white flex items-center justify-between px-6 sticky top-0 z-20">
          {/* Search */}
          <div className="relative max-w-[280px] w-full hidden sm:block">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#C4BDB4]"
              aria-hidden="true"
            />
            <input
              type="search"
              placeholder="Search products, orders…"
              className="w-full h-9 pl-9 pr-4 rounded-lg border border-[#E5DCCB] bg-[#F5F0E5] text-[13px] font-sans text-[#20201E] placeholder:text-[#C4BDB4] focus:outline-none focus:border-[#183D33] transition-colors"
            />
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2.5 ml-auto">
            <button
              type="button"
              aria-label="Notifications"
              className="w-9 h-9 flex items-center justify-center rounded-lg border border-[#E5DCCB] text-[#C4BDB4] hover:text-[#20201E] hover:bg-[#F5F0E5] transition-colors"
            >
              <Bell size={15} aria-hidden="true" />
            </button>

            <div className="h-5 w-px bg-[#E5DCCB]" />

            <div
              className="w-8 h-8 rounded-full bg-gradient-to-br from-[#C4A882] to-[#8C6E4A] flex items-center justify-center shrink-0"
              aria-label="User menu"
            >
              <span className="text-[11px] font-[700] font-sans text-white">
                {sellerInitials}
              </span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 min-w-0 p-8 max-lg:p-4 pb-24 lg:pb-8">
          {children}
        </main>
      </div>

      {/* Mobile bottom tab bar */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-[#E5DCCB] flex">
        {mobileTabs.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || (href !== '/portal' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-[10px] font-[600] font-sans transition-colors ${
                isActive ? 'text-[#183D33]' : 'text-[#C4BDB4] hover:text-[#665F55]'
              }`}
            >
              <Icon size={18} aria-hidden="true" />
              {label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
