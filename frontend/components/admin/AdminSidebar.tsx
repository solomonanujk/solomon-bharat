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

// ─── Nav groups ────────────────────────────────────────────────────────────────
// Matches prd.md §9.2: Dashboard, Seller Applications, Sellers, Products,
// Buyers, Orders, Payouts, Categories & Collections, Reports, Settings.
// (Collections doubles as the platform's CMS — no separate CMS module exists.)

type NavItem = { href: string; label: string; icon: React.ElementType; exact?: boolean }
type NavGroup = { label: string; items: NavItem[] }

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
    ],
  },
  {
    label: 'People',
    items: [
      { href: '/admin/seller-applications', label: 'Seller Applications', icon: Clock },
      { href: '/admin/sellers', label: 'Sellers', icon: Building2 },
      { href: '/admin/agent-applications', label: 'Agent Applications', icon: Briefcase },
      { href: '/admin/buyers', label: 'Buyers', icon: Users },
    ],
  },
  {
    label: 'Catalogue',
    items: [
      { href: '/admin/products', label: 'Products', icon: Package },
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

// ─── Component ────────────────────────────────────────────────────────────────

export function AdminSidebar() {
  const pathname = usePathname()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)

  // User has no `name` field in this product's schema (see types/index.ts) —
  // fall back to the email local-part for display.
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
    <aside className="h-screen w-[260px] bg-white border-r border-[#E5E1D8] flex flex-col fixed left-0 top-0 z-30">

      {/* Logo */}
      <div className="px-6 h-16 flex items-center border-b border-[#E5E1D8] shrink-0">
        <Link href="/" className="block">
          <span className="font-playfair text-[18px] text-[#1A1A1A] font-[600] tracking-[-0.01em]">
            Solomon Bharat
          </span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-3">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="mb-5">
            <p className="px-3 mb-1 text-[10px] font-[700] font-public-sans text-[#A68B67] tracking-[0.1em] uppercase">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {group.items.map(({ href, label, icon: Icon, exact }) => {
                const active = isActive(href, exact)
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      className={cn(
                        'flex items-center gap-2.5 px-3 py-2 rounded-md',
                        'text-[13.5px] font-public-sans transition-colors',
                        active
                          ? 'bg-[#F5F0E8] text-[#1A1A1A] font-[600]'
                          : 'text-[#444748] font-[400] hover:bg-[#F9F7F2] hover:text-[#1A1A1A]'
                      )}
                    >
                      <Icon
                        size={15}
                        aria-hidden="true"
                        className={cn('shrink-0', active ? 'text-[#A68B67]' : 'text-[#9CA3AF]')}
                      />
                      {label}
                      {active && (
                        <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#A68B67]" aria-hidden="true" />
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
      <div className="px-4 py-4 border-t border-[#E5E1D8] shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[#F5F0E8] border border-[#E5E1D8] flex items-center justify-center shrink-0">
            <span className="text-[11px] font-[700] font-public-sans text-[#A68B67]">
              {adminInitials}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-[600] font-public-sans text-[#1A1A1A] truncate leading-tight">
              {adminName}
            </p>
            <p className="text-[11px] font-public-sans text-[#9CA3AF] leading-tight">Administrator</p>
          </div>
          <button
            type="button"
            onClick={logout}
            aria-label="Sign out"
            className="text-[#C4BDB4] hover:text-[#444748] transition-colors p-1"
          >
            <LogOut size={14} aria-hidden="true" />
          </button>
        </div>
      </div>
    </aside>
  )
}
