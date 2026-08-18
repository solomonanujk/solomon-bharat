'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Bell, Search } from 'lucide-react'
import { AgentSidebar } from '@/components/agent-portal/AgentSidebar'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { useMyAgentProfileForPortal } from '@/hooks/queries/useCatalogues'

// ─── Mobile bottom tab items — clone of the seller portal layout's pattern,
// adapted to /agent routes. ──────────────────────────────────────────────────

const MOBILE_TABS = [
  { href: '/agent', label: 'Dashboard' },
  { href: '/agent/products', label: 'Products' },
  { href: '/agent/orders', label: 'Orders' },
  { href: '/agent/catalogue', label: 'Catalogue' },
  { href: '/agent/settings', label: 'Settings' },
]

export default function AgentPortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const hasHydrated = useAuthStore((s) => s._hasHydrated)

  useEffect(() => {
    if (!hasHydrated) return
    if (!isAuthenticated || user?.role !== 'AGENT') {
      router.replace('/')
    }
  }, [hasHydrated, isAuthenticated, user, router])

  const { data: profile } = useMyAgentProfileForPortal()
  const agentName = profile?.businessName ?? 'Agent'
  const agentInitials = agentName
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  if (!hasHydrated) return null
  if (!isAuthenticated || user?.role !== 'AGENT') return null

  return (
    <div className="flex min-h-screen bg-bg">
      {/* Sidebar — hidden on mobile */}
      <div className="hidden lg:block">
        <AgentSidebar />
      </div>

      {/* Main area */}
      <div className="flex-1 lg:ml-[260px] flex flex-col min-h-screen">
        {/* Top bar */}
        <header className="h-16 border-b border-border-warm bg-white flex items-center justify-between px-6 sticky top-0 z-20">
          {/* Search */}
          <div className="relative max-w-[280px] w-full hidden sm:block">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]"
              aria-hidden="true"
            />
            <input
              type="search"
              placeholder="Search products, orders..."
              className="w-full h-9 pl-9 pr-4 rounded-md border border-border-warm bg-bg text-[13.5px] font-public-sans text-primary placeholder:text-[#9CA3AF] focus:outline-none focus:border-accent transition-colors"
            />
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2.5 ml-auto">
            <button
              type="button"
              aria-label="Notifications"
              className="w-9 h-9 flex items-center justify-center rounded-md border border-border-warm text-[#9CA3AF] hover:text-primary hover:bg-muted-bg transition-colors"
            >
              <Bell size={15} aria-hidden="true" />
            </button>

            <div className="h-5 w-px bg-border-warm" />

            <div
              className="w-8 h-8 rounded-full bg-muted-bg border border-border-warm flex items-center justify-center shrink-0"
              aria-label="User menu"
            >
              <span className="text-[11px] font-[700] font-public-sans text-accent">
                {agentInitials}
              </span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-8 max-lg:p-4 pb-24 lg:pb-8">
          {children}
        </main>
      </div>

      {/* Mobile bottom tab bar */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-border-warm flex">
        {MOBILE_TABS.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className="flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 text-[10px] font-[600] font-public-sans text-[#9CA3AF] hover:text-primary transition-colors"
          >
            {label}
          </Link>
        ))}
      </nav>
    </div>
  )
}
