'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Package, ShoppingBag, BookOpen, Settings, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { useMyAgentProfileForPortal } from '@/hooks/queries/useCatalogues'

// ─── Nav — Dashboard, Products, Orders, Catalogue, Settings. Clone of
// components/seller-portal/PortalSidebar.tsx, adapted to /agent routes. ─────────

type NavItem = { href: string; label: string; icon: React.ElementType; exact?: boolean }

const NAV_ITEMS: NavItem[] = [
  { href: '/agent', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/agent/products', label: 'Products', icon: Package },
  { href: '/agent/orders', label: 'Orders', icon: ShoppingBag },
  { href: '/agent/catalogue', label: 'Catalogue', icon: BookOpen },
  { href: '/agent/settings', label: 'Settings', icon: Settings },
]

export function AgentSidebar() {
  const pathname = usePathname()
  const logout = useAuthStore((s) => s.logout)
  const { data: profile } = useMyAgentProfileForPortal()

  const agentName = profile?.businessName ?? 'Agent'
  const agentInitials = agentName
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
    <aside className="h-screen w-[260px] bg-white border-r border-border-warm flex flex-col fixed left-0 top-0 z-30">

      {/* Logo */}
      <div className="px-6 h-16 flex items-center border-b border-border-warm shrink-0">
        <Link href="/" className="block">
          <img
            src="https://res.cloudinary.com/dxnqyvcdl/image/upload/v1781610714/solomon-logo1_inmwov.png"
            alt="Solomon Bharat"
            className="h-9 w-auto object-contain block"
          />
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        <ul className="space-y-0.5">
          {NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => {
            const active = isActive(href, exact)
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={cn(
                    'flex items-center gap-2.5 px-3 py-2 rounded-md w-full text-left',
                    'text-[13.5px] font-public-sans transition-colors',
                    active
                      ? 'bg-muted-bg text-primary font-[600]'
                      : 'text-muted-text font-[400] hover:bg-bg hover:text-primary'
                  )}
                >
                  <Icon size={15} aria-hidden="true" className={cn('shrink-0', active ? 'text-accent' : 'text-[#9CA3AF]')} />
                  {label}
                  {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-accent" aria-hidden="true" />}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Agent profile section */}
      <div className="px-4 py-4 border-t border-border-warm shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-muted-bg border border-border-warm flex items-center justify-center shrink-0">
            <span className="text-[11px] font-[700] font-public-sans text-accent">
              {agentInitials}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-[600] font-public-sans text-primary truncate leading-tight">
              {agentName}
            </p>
            <p className="text-[11px] font-public-sans text-[#9CA3AF] leading-tight">Agent Portal</p>
          </div>
          <button
            type="button"
            onClick={logout}
            aria-label="Sign out"
            className="text-[#C4BDB4] hover:text-muted-text transition-colors p-1"
          >
            <LogOut size={14} aria-hidden="true" />
          </button>
        </div>
      </div>
    </aside>
  )
}
