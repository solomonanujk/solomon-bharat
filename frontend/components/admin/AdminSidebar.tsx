'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Building2,
  Clock,
  Users,
  CreditCard,
  Package,
  ShoppingCart,
  LogOut,
  FolderTree,
  Layers,
  BarChart3,
  Settings,
  Briefcase,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { useAdminDashboard } from '@/hooks/queries/useAdmin'

type NavItem = { href: string; label: string; icon: React.ElementType; exact?: boolean; badge?: number | null }
type NavGroup = { label: string; items: NavItem[] }

function useNavGroups(): NavGroup[] {
  const { data: stats } = useAdminDashboard()

  return [
    {
      label: 'Overview',
      items: [
        { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
      ],
    },
    {
      label: 'People',
      items: [
        { href: '/admin/seller-applications', label: 'Seller Applications', icon: Clock, badge: stats?.pendingSellerApplications ?? null },
        { href: '/admin/sellers', label: 'Sellers', icon: Building2 },
        { href: '/admin/agent-applications', label: 'Agent Applications', icon: Briefcase },
        { href: '/admin/buyers', label: 'Buyers', icon: Users },
      ],
    },
    {
      label: 'Catalogue',
      items: [
        { href: '/admin/products', label: 'Products', icon: Package, badge: stats?.pendingProductReviews ?? null },
        { href: '/admin/pricing-changes', label: 'Pricing Changes', icon: Clock },
        { href: '/admin/categories', label: 'Categories', icon: FolderTree },
        { href: '/admin/collections', label: 'Collections', icon: Layers },
      ],
    },
    {
      label: 'Operations',
      items: [
        { href: '/admin/orders', label: 'Orders', icon: ShoppingCart },
        { href: '/admin/payouts', label: 'Payouts', icon: CreditCard },
      ],
    },
    {
      label: 'Platform',
      items: [
        { href: '/admin/reports', label: 'Reports', icon: BarChart3 },
        { href: '/admin/settings', label: 'Settings', icon: Settings },
      ],
    },
  ]
}

export function AdminSidebar() {
  const pathname = usePathname()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const navGroups = useNavGroups()

  const adminName = user?.email?.split('@')[0] ?? 'Admin'
  const adminInitials = adminName
    .split(/[._-]/)
    .filter(Boolean)
    .map((w: string) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'AD'

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href
    return pathname.startsWith(href)
  }

  return (
    <aside className="h-screen w-[260px] bg-[#1C1A18] flex flex-col fixed left-0 top-0 z-30">

      {/* Logo */}
      <div className="px-6 h-16 flex items-center border-b border-white/[0.07] shrink-0">
        <Link href="/" className="block">
          <img
            src="https://res.cloudinary.com/dxnqyvcdl/image/upload/v1788850557/branding/1788850490541-solomon-bharat-logo.png"
            alt="Solomon Bharat"
            className="h-11 w-auto object-contain block brightness-0 invert"
          />
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-3">
        {navGroups.map((group) => (
          <div key={group.label} className="mb-5">
            <p className="px-3 mb-1.5 text-[9.5px] font-[700] font-sans text-[#A68B67] tracking-[0.12em] uppercase">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {group.items.map(({ href, label, icon: Icon, exact, badge }) => {
                const active = isActive(href, exact)
                const showBadge = badge != null && badge > 0
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      className={cn(
                        'flex items-center gap-2.5 px-3 py-[7px] rounded-md',
                        'text-[13px] font-sans transition-colors',
                        active
                          ? 'bg-[#A68B67]/15 text-[#E8D5BB] font-[600]'
                          : 'text-[#9A9189] font-[400] hover:bg-white/[0.05] hover:text-[#D4C5B0]'
                      )}
                    >
                      <Icon
                        size={14}
                        aria-hidden="true"
                        className={cn('shrink-0', active ? 'text-[#C4A882]' : 'text-[#6B6460]')}
                      />
                      <span className="flex-1">{label}</span>
                      {showBadge && (
                        <span className={cn(
                          'text-[10px] font-[700] px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none',
                          active ? 'bg-[#E04040]/25 text-[#FF8080]' : 'bg-[#E04040]/20 text-[#FF7070]'
                        )}>
                          {badge! > 99 ? '99+' : badge}
                        </span>
                      )}
                      {active && !showBadge && (
                        <span className="w-1.5 h-1.5 rounded-full bg-[#A68B67]" aria-hidden="true" />
                      )}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Profile section */}
      <div className="px-4 py-4 border-t border-white/[0.07] shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#A68B67] to-[#7A6244] flex items-center justify-center shrink-0">
            <span className="text-[11px] font-[700] font-sans text-white">
              {adminInitials}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-[600] font-sans text-[#E8D5BB] truncate leading-tight">
              {adminName}
            </p>
            <p className="text-[11px] font-sans text-[#6B6460] leading-tight">Administrator</p>
          </div>
          <button
            type="button"
            onClick={logout}
            aria-label="Sign out"
            className="text-[#6B6460] hover:text-[#9A9189] transition-colors p-1"
          >
            <LogOut size={14} aria-hidden="true" />
          </button>
        </div>
      </div>
    </aside>
  )
}
