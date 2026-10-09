'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Package, PackagePlus, ShoppingBag, CreditCard, Settings, LogOut, Store } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { useMySellerProfile } from '@/hooks/queries/useSellers'

type NavItem = { href: string; label: string; icon: React.ElementType; exact?: boolean }

const NAV_ITEMS: NavItem[] = [
  { href: '/portal', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/portal/products', label: 'My Products', icon: Package, exact: true },
  { href: '/portal/products/new', label: 'Submit Product', icon: PackagePlus },
  { href: '/portal/orders', label: 'Orders', icon: ShoppingBag },
  { href: '/portal/payouts', label: 'Payouts', icon: CreditCard },
  { href: '/portal/settings', label: 'Settings', icon: Settings },
]

const BRAND_NAV_ITEMS: NavItem[] = [
  { href: '/portal', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/portal/brand', label: 'Brand profile', icon: Store },
  { href: '/portal/products', label: 'My Products', icon: Package, exact: true },
  { href: '/portal/products/new', label: 'Add Product', icon: PackagePlus },
  { href: '/portal/orders', label: 'Sales', icon: ShoppingBag },
  { href: '/portal/payouts', label: 'Payouts', icon: CreditCard },
  { href: '/portal/settings', label: 'Settings', icon: Settings },
]

export function PortalSidebar() {
  const pathname = usePathname()
  const logout = useAuthStore((s) => s.logout)
  const { data: profile } = useMySellerProfile()

  const isMarketplace = profile?.sellerType === 'MARKETPLACE'
  const navItems = isMarketplace ? BRAND_NAV_ITEMS : NAV_ITEMS
  const sellerName = profile?.brand?.name ?? profile?.businessName ?? 'Seller'
  const sellerInitials = sellerName
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href
    return pathname.startsWith(href)
  }

  return (
    <aside className="h-screen w-[200px] bg-white border-r border-[#E5DCCB] flex flex-col fixed left-0 top-0 z-30">

      {/* Logo */}
      <div className="px-5 h-16 flex items-center border-b border-[#E5DCCB] shrink-0">
        <Link href="/" className="block">
          <img
            src="/branding/solomon-bharat-logo.png"
            alt="Solomon Bharat"
            className="h-11 w-auto object-contain block"
          />
        </Link>
      </div>

      {/* Portal label */}
      <div className="px-5 pt-4 pb-2">
        <p className="text-[9.5px] font-[700] font-sans text-[#183D33] tracking-[0.12em] uppercase">
          {isMarketplace ? 'Brand Portal' : 'Seller Portal'}
        </p>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto pb-4 px-3">
        <ul className="space-y-0.5">
          {navItems.map(({ href, label, icon: Icon, exact }) => {
            const active = isActive(href, exact)
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={cn(
                    'flex items-center gap-2.5 px-3 py-[7px] rounded-md w-full text-left',
                    'text-[13px] font-sans transition-colors',
                    active
                      ? 'bg-[#F5F0E5] text-[#20201E] font-[600]'
                      : 'text-[#665F55] font-[400] hover:bg-[#F5F0E5] hover:text-[#20201E]'
                  )}
                >
                  <Icon
                    size={14}
                    aria-hidden="true"
                    className={cn('shrink-0', active ? 'text-[#183D33]' : 'text-[#C4BDB4]')}
                  />
                  <span className="flex-1">{label}</span>
                  {active && <span className="w-1.5 h-1.5 rounded-full bg-[#183D33] shrink-0" aria-hidden="true" />}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Seller profile section */}
      <div className="px-4 py-4 border-t border-[#E5DCCB] shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#183D33] to-[#7A6244] flex items-center justify-center shrink-0">
            <span className="text-[11px] font-[700] font-sans text-white">
              {sellerInitials}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12.5px] font-[600] font-sans text-[#20201E] truncate leading-tight">
              {sellerName}
            </p>
            <p className="text-[10.5px] font-sans text-[#183D33] leading-tight font-[500]">{isMarketplace ? 'Brand' : 'Seller'}</p>
          </div>
          <button
            type="button"
            onClick={logout}
            aria-label="Sign out"
            className="text-[#C4BDB4] hover:text-[#665F55] transition-colors p-1"
          >
            <LogOut size={13} aria-hidden="true" />
          </button>
        </div>
      </div>
    </aside>
  )
}
