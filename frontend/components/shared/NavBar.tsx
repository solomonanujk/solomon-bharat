'use client'

import { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Menu, X, ChevronDown, LogOut, User as UserIcon, ShoppingCart, Globe, Package, MessageSquare, Heart, LayoutDashboard, Search as SearchIcon, Bell, Layers } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { useCurrencyStore } from '@/lib/store/useCurrencyStore'
import { useCartStore } from '@/lib/store/useCartStore'
import { useCategoryTree } from '@/hooks/queries/useCategories'
import {
  useNotifications,
  useUnreadNotificationCount,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from '@/hooks/queries/useNotifications'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetClose } from '@/components/ui/sheet'

const BUYER_NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/orders', label: 'Orders', icon: Package },
  { href: '/messages', label: 'Messages', icon: MessageSquare },
  { href: '/wishlist', label: 'Wishlist', icon: Heart },
  { href: '/profile', label: 'Profile', icon: UserIcon },
]

const FALLBACK_CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'AUD']

const currencyDisplayNames =
  typeof Intl !== 'undefined' && Intl.DisplayNames
    ? new Intl.DisplayNames(['en'], { type: 'currency' })
    : null

function getCurrencyName(code: string): string {
  try {
    return currencyDisplayNames?.of(code) ?? code
  } catch {
    return code
  }
}

function useCurrencies() {
  return useQuery<string[]>({
    queryKey: ['frankfurter-currencies'],
    queryFn: async () => {
      const res = await fetch('/api/currencies')
      if (!res.ok) throw new Error('Failed')
      const codes: Record<string, string> = await res.json()
      const sorted = Object.keys(codes).sort((a, b) => a.localeCompare(b))
      return ['INR', ...sorted.filter((c) => c !== 'INR')]
    },
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    retry: 1,
  })
}

function useOutsideClick(ref: React.RefObject<HTMLElement | null>, handler: () => void, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) handler()
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [ref, handler, enabled])
}

function useScrolled(threshold = 24) {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    function onScroll() { setScrolled(window.scrollY > threshold) }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [threshold])
  return scrolled
}

/**
 * Signed-in nav behavior: hide on scroll down (once past the header itself), reveal
 * immediately on any scroll up — regardless of how far down the page you are. Guests
 * keep the plain always-visible sticky bar; this only kicks in when `enabled`.
 */
function useHideOnScroll(enabled: boolean) {
  const [scrollHidden, setScrollHidden] = useState(false)
  const lastY = useRef(0)

  useEffect(() => {
    if (!enabled) return
    lastY.current = window.scrollY
    function onScroll() {
      const currentY = window.scrollY
      const delta = currentY - lastY.current
      if (Math.abs(delta) < 6) return
      if (delta > 0 && currentY > 120) {
        setScrollHidden(true)
      } else if (delta < 0) {
        setScrollHidden(false)
      }
      lastY.current = currentY
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [enabled])

  return enabled && scrollHidden
}

// ─── Currency selector ────────────────────────────────────────────────────────

function CurrencySelector({ ghost }: { ghost?: boolean }) {
  const currency = useCurrencyStore((s) => s.currency)
  const setCurrency = useCurrencyStore((s) => s.setCurrency)
  const { data: availableCurrencies = FALLBACK_CURRENCIES } = useCurrencies()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useOutsideClick(ref, () => setOpen(false), open)

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={`Currency: ${currency}`}
        className={cn(
          'inline-flex items-center gap-1.5 h-9 px-2.5 rounded text-[15px] font-[600] font-public-sans transition-colors',
          ghost ? 'text-white hover:bg-white/10' : 'text-muted-text hover:text-primary hover:bg-muted-bg'
        )}
      >
        <Globe size={14} aria-hidden="true" />
        {currency}
        <ChevronDown size={11} className={cn('transition-transform', open && 'rotate-180')} aria-hidden="true" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-surface border border-border-warm rounded shadow-[0_4px_20px_rgba(26,26,26,0.08)] py-1.5 min-w-[220px] max-h-[320px] overflow-y-auto">
          {availableCurrencies.map((c) => {
            const active = c === currency
            return (
              <button
                key={c}
                type="button"
                onClick={() => { setCurrency(c); setOpen(false) }}
                className={cn('w-full flex items-center justify-between px-4 py-2.5 transition-colors', active ? 'bg-muted-bg' : 'hover:bg-muted-bg')}
              >
                <span className={cn('text-[13px] font-public-sans', active ? 'text-primary font-[600]' : 'text-muted-text')}>
                  {getCurrencyName(c)}
                </span>
                <span className={cn('text-[12px] font-[600] font-public-sans ml-3', active ? 'text-primary' : 'text-muted-text/70')}>
                  {c}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Categories mega menu ─────────────────────────────────────────────────────
// Faire-style: level 1 in the leftmost column (first one active by default), its
// level 2 children in the next column, and hovering a level 2 shows its own level 3
// children in a third column. Every item is a real link to its own category page —
// hovering only changes which columns are visible, it never blocks navigation.

function CategoryMegaMenu({ ghost }: { ghost?: boolean }) {
  const { data: tree = [] } = useCategoryTree()
  const [open, setOpen] = useState(false)
  const [activeL1, setActiveL1] = useState(0)
  const [activeL2, setActiveL2] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  useOutsideClick(ref, () => setOpen(false), open)

  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])

  function handleOpen() {
    setActiveL1(0)
    setActiveL2(0)
    setOpen(true)
  }

  const activeL1Category = tree[activeL1]
  const level2 = activeL1Category?.children ?? []
  const activeL2Category = level2[activeL2]
  const level3 = activeL2Category?.children ?? []

  function handleHoverL1(index: number) {
    setActiveL1(index)
    setActiveL2(0)
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : handleOpen())}
        aria-expanded={open}
        aria-haspopup="true"
        className={cn(
          'inline-flex items-center gap-1.5 h-9 px-4 rounded-full text-[15px] font-[500] font-public-sans transition-colors',
          ghost ? 'text-white hover:bg-white/10' : 'text-primary hover:bg-muted-bg'
        )}
      >
        All categories
        <ChevronDown size={12} className={cn('transition-transform', open && 'rotate-180')} aria-hidden="true" />
      </button>

      {open && (
        <div className="fixed top-[108px] left-0 right-0 z-50 bg-surface border-b border-border-warm shadow-[0_8px_30px_rgba(26,26,26,0.10)]">
          <div className="max-w-7xl mx-auto px-8 py-10 relative">
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close categories menu"
              className="absolute top-4 right-4 sm:right-8 inline-flex items-center justify-center w-8 h-8 rounded text-muted-text hover:text-primary hover:bg-muted-bg transition-colors"
            >
              <X size={16} aria-hidden="true" />
            </button>

            <div className="flex gap-14 flex-wrap">
              {/* Column 1 — level 1 */}
              <div className="flex flex-col gap-1 min-w-[180px] flex-shrink-0">
                <p className="text-[11px] font-[600] font-public-sans text-muted-text uppercase tracking-[0.06em] mb-2">
                  Categories
                </p>
                {tree.map((category, i) => (
                  <Link
                    key={category.id}
                    href={`/categories/${category.slug}`}
                    onClick={() => setOpen(false)}
                    onMouseEnter={() => handleHoverL1(i)}
                    className={cn(
                      'py-1.5 text-[15px] font-public-sans transition-colors',
                      i === activeL1
                        ? 'text-primary font-[600] underline underline-offset-4'
                        : 'text-muted-text hover:text-primary'
                    )}
                  >
                    {category.name}
                  </Link>
                ))}
              </div>

              {/* Column 2 — level 2 of the active level 1 */}
              {level2.length > 0 && (
                <div className="flex flex-col gap-1 min-w-[200px] flex-shrink-0">
                  <p className="text-[11px] font-[600] font-public-sans text-muted-text uppercase tracking-[0.06em] mb-2">
                    {activeL1Category?.name}
                  </p>
                  {level2.map((category, i) => (
                    <Link
                      key={category.id}
                      href={`/categories/${category.slug}`}
                      onClick={() => setOpen(false)}
                      onMouseEnter={() => setActiveL2(i)}
                      className={cn(
                        'py-1.5 text-[15px] font-public-sans transition-colors',
                        i === activeL2
                          ? 'text-primary font-[600] underline underline-offset-4'
                          : 'text-muted-text hover:text-primary'
                      )}
                    >
                      {category.name}
                    </Link>
                  ))}
                </div>
              )}

              {/* Column 3 — level 3 of the active level 2 */}
              {level3.length > 0 && (
                <div className="flex flex-col gap-1 min-w-[200px] flex-shrink-0">
                  <p className="text-[11px] font-[600] font-public-sans text-muted-text uppercase tracking-[0.06em] mb-2">
                    {activeL2Category?.name}
                  </p>
                  {level3.map((category) => (
                    <Link
                      key={category.id}
                      href={`/categories/${category.slug}`}
                      onClick={() => setOpen(false)}
                      className="py-1.5 text-[15px] font-public-sans text-muted-text hover:text-primary transition-colors"
                    >
                      {category.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Global search bar ────────────────────────────────────────────────────────
// Deliberately global (not scoped to a category/collection) — see AGENTS.md "Search".
// Doesn't prefill from the current /search?q= on mount: NavBar renders on nearly every
// page, and reading useSearchParams here would force a Suspense boundary everywhere
// NavBar is used, which isn't worth it just to preserve the box's text across a reload.

function NavSearchBar({ ghost }: { ghost?: boolean }) {
  const router = useRouter()
  const [value, setValue] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = value.trim()
    if (!trimmed) return
    router.push(`/search?q=${encodeURIComponent(trimmed)}`)
  }

  return (
    <form onSubmit={handleSubmit} className="hidden md:block flex-1 mx-3">
      <div className="relative w-full">
        <SearchIcon
          size={15}
          className={cn('absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none', ghost ? 'text-white/70' : 'text-muted-text')}
          aria-hidden="true"
        />
        <input
          type="search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder='Search for "tote bags"'
          aria-label="Search products"
          className={cn(
            'w-full h-11 pl-10 pr-9 rounded-full text-[15px] font-public-sans border transition-colors focus:outline-none',
            ghost
              ? 'bg-white/10 border-white/20 text-white placeholder:text-white/60 focus:bg-white/20'
              : 'bg-muted-bg/50 border-border-warm text-primary placeholder:text-muted-text/70 focus:border-accent focus:bg-surface'
          )}
        />
        {value && (
          <button
            type="button"
            onClick={() => setValue('')}
            aria-label="Clear search"
            className={cn(
              'absolute right-3 top-1/2 -translate-y-1/2 transition-colors',
              ghost ? 'text-white/70 hover:text-white' : 'text-muted-text hover:text-primary'
            )}
          >
            <X size={14} aria-hidden="true" />
          </button>
        )}
      </div>
    </form>
  )
}

// ─── Category quick-links row ─────────────────────────────────────────────────
// The secondary row under the main bar — curated links backed by real data
// ("New Products" = createdAt desc, "Bestsellers" = isFeatured, "Trending" = real
// order volume in the last 30 days), then the real level-1 categories. No "Sale" —
// this marketplace has no discount-price concept to honestly back one.

const CURATED_LINKS = [
  { href: '/search?sort=newest', label: 'New products' },
  { href: '/search?sort=featured', label: 'Bestsellers' },
  { href: '/search?sort=trending', label: 'Trending' },
]

function CategoryQuickLinksRow({ ghost }: { ghost?: boolean }) {
  const { data: tree = [] } = useCategoryTree()

  return (
    <div className="hidden md:block">
      <div className="max-w-7xl mx-auto px-4 h-11 flex items-center justify-center gap-6 overflow-x-auto scrollbar-none">
        {CURATED_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              'flex-shrink-0 whitespace-nowrap text-[14px] font-[500] font-public-sans transition-colors',
              ghost ? 'text-white/85 hover:text-white' : 'text-muted-text hover:text-primary'
            )}
          >
            {link.label}
          </Link>
        ))}
        {tree.map((category) => (
          <Link
            key={category.id}
            href={`/categories/${category.slug}`}
            className={cn(
              'flex-shrink-0 whitespace-nowrap text-[14px] font-[500] font-public-sans transition-colors',
              ghost ? 'text-white/85 hover:text-white' : 'text-muted-text hover:text-primary'
            )}
          >
            {category.name}
          </Link>
        ))}
      </div>
    </div>
  )
}

// ─── Cart button ──────────────────────────────────────────────────────────────

function CartButton({ ghost }: { ghost?: boolean }) {
  const items = useCartStore((s) => s.items)
  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0)

  return (
    <Link
      href="/cart"
      aria-label={`Cart — ${totalItems} item${totalItems !== 1 ? 's' : ''}`}
      className={cn(
        'relative inline-flex items-center justify-center w-9 h-9 rounded transition-colors',
        ghost ? 'text-white hover:bg-white/10' : 'text-muted-text hover:text-primary hover:bg-muted-bg'
      )}
    >
      <ShoppingCart size={17} aria-hidden="true" />
      {totalItems > 0 && (
        <span className="absolute top-1 right-1 min-w-[14px] h-[14px] rounded-full bg-accent text-white text-[9px] font-[700] font-public-sans flex items-center justify-center px-0.5 tabular-nums leading-none pointer-events-none">
          {totalItems > 99 ? '99+' : totalItems}
        </span>
      )}
    </Link>
  )
}

// ─── Notification bell ────────────────────────────────────────────────────────

function NotificationBell({ ghost }: { ghost?: boolean }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useOutsideClick(ref, () => setOpen(false), open)

  const { data: unreadCount = 0 } = useUnreadNotificationCount()
  const { data } = useNotifications({ limit: 6 })
  const markRead = useMarkNotificationRead()
  const markAllRead = useMarkAllNotificationsRead()
  const notifications = data?.items ?? []

  function handleItemClick(id: string, isRead: boolean) {
    if (!isRead) markRead.mutate(id)
    setOpen(false)
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={unreadCount > 0 ? `Notifications — ${unreadCount} unread` : 'Notifications'}
        className={cn(
          'relative inline-flex items-center justify-center w-9 h-9 rounded transition-colors',
          ghost ? 'text-white hover:bg-white/10' : 'text-muted-text hover:text-primary hover:bg-muted-bg'
        )}
      >
        <Bell size={17} aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[14px] h-[14px] rounded-full bg-accent text-white text-[9px] font-[700] font-public-sans flex items-center justify-center px-0.5 tabular-nums leading-none pointer-events-none">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-surface border border-border-warm rounded shadow-[0_4px_20px_rgba(26,26,26,0.08)] w-[340px] max-h-[420px] flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border-warm flex-shrink-0">
            <span className="text-[13px] font-[600] font-public-sans text-primary">Notifications</span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => markAllRead.mutate()}
                className="text-[11.5px] font-[600] font-public-sans text-accent hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-4 py-8 text-center text-[13px] font-public-sans text-muted-text">
                No notifications yet.
              </p>
            ) : (
              notifications.map((n) => {
                const body = (
                  <div className={cn('px-4 py-3 border-b border-border-warm last:border-0', !n.isRead && 'bg-accent/5')}>
                    <p className="text-[13px] font-[600] font-public-sans text-primary leading-snug">{n.title}</p>
                    <p className="text-[12px] font-public-sans text-muted-text mt-0.5 leading-snug line-clamp-2">
                      {n.message}
                    </p>
                  </div>
                )
                return n.link ? (
                  <Link
                    key={n.id}
                    href={n.link}
                    onClick={() => handleItemClick(n.id, n.isRead)}
                    className="block hover:bg-muted-bg transition-colors"
                  >
                    {body}
                  </Link>
                ) : (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => handleItemClick(n.id, n.isRead)}
                    className="block w-full text-left hover:bg-muted-bg transition-colors"
                  >
                    {body}
                  </button>
                )
              })
            )}
          </div>

          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            className="block text-center py-2.5 text-[12.5px] font-[600] font-public-sans text-accent border-t border-border-warm hover:bg-muted-bg transition-colors flex-shrink-0"
          >
            View all
          </Link>
        </div>
      )}
    </div>
  )
}

// ─── User dropdown ────────────────────────────────────────────────────────────

function UserDropdown() {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useOutsideClick(ref, () => setOpen(false), open)

  if (!user) return null

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Account menu"
        className="inline-flex items-center h-9 px-2 rounded hover:bg-muted-bg transition-colors"
      >
        <span className="w-7 h-7 rounded-full inline-flex items-center justify-center bg-muted-bg border border-border-warm text-muted-text">
          <UserIcon size={13} aria-hidden="true" />
        </span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-surface border border-border-warm rounded shadow-[0_4px_20px_rgba(26,26,26,0.08)] min-w-[220px]">
          <div className="px-4 py-3 border-b border-border-warm">
            <p className="text-[13px] font-[600] font-public-sans text-primary truncate">{user.email}</p>
          </div>

          {(user.role === 'BUYER' || user.role === 'AGENT') && (
            <div className="py-1">
              {BUYER_NAV_ITEMS.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2 text-[13px] font-[500] font-public-sans text-muted-text hover:text-primary hover:bg-muted-bg transition-colors"
                >
                  <Icon size={13} aria-hidden="true" />
                  {label}
                </Link>
              ))}
              {user.role === 'AGENT' && (
                <Link
                  href="/catalogue"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2 text-[13px] font-[500] font-public-sans text-muted-text hover:text-primary hover:bg-muted-bg transition-colors"
                >
                  <Layers size={13} aria-hidden="true" />
                  My Catalogues
                </Link>
              )}
            </div>
          )}

          {user.role === 'SUPER_ADMIN' && (
            <div className="py-1">
              <Link
                href="/admin"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2 text-[13px] font-[500] font-public-sans text-muted-text hover:text-primary hover:bg-muted-bg transition-colors"
              >
                <LayoutDashboard size={13} aria-hidden="true" />
                Admin Panel
              </Link>
            </div>
          )}

          {user.role === 'SELLER' && (
            <div className="py-1">
              <Link
                href="/portal"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2 text-[13px] font-[500] font-public-sans text-muted-text hover:text-primary hover:bg-muted-bg transition-colors"
              >
                <LayoutDashboard size={13} aria-hidden="true" />
                Seller Portal
              </Link>
            </div>
          )}

          <div className="border-t border-border-warm py-1">
            <button
              type="button"
              onClick={() => { logout(); setOpen(false) }}
              className="w-full flex items-center gap-2.5 px-4 py-2 text-[13px] font-[500] font-public-sans text-muted-text hover:text-red-500 hover:bg-muted-bg transition-colors"
            >
              <LogOut size={13} aria-hidden="true" />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Mobile drawer ────────────────────────────────────────────────────────────

function MobileNavDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const openAuthModal = useAuthStore((s) => s.openAuthModal)
  const currency = useCurrencyStore((s) => s.currency)
  const setCurrency = useCurrencyStore((s) => s.setCurrency)
  const { data: availableCurrencies = FALLBACK_CURRENCIES } = useCurrencies()
  const pathname = usePathname()

  function handleAuth() { onClose(); openAuthModal('login') }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-[320px] max-w-[90vw] flex flex-col">
        <SheetHeader>
          <SheetTitle>Menu</SheetTitle>
          <SheetClose />
        </SheetHeader>

        <nav className="flex flex-col px-6 py-4 flex-1 overflow-y-auto gap-0">
          {isAuthenticated && user && (
            <div className="mb-4 pb-4 border-b border-border-warm">
              <p className="text-[13px] font-public-sans text-muted-text">{user.email}</p>

              {(user.role === 'BUYER' || user.role === 'AGENT') && (
                <div className="mt-3 flex flex-col gap-0.5">
                  {BUYER_NAV_ITEMS.map(({ href, label, icon: Icon }) => (
                    <Link
                      key={href}
                      href={href}
                      onClick={onClose}
                      className="flex items-center gap-2.5 py-2 text-[13px] font-[500] font-public-sans text-muted-text hover:text-primary transition-colors"
                    >
                      <Icon size={13} aria-hidden="true" />
                      {label}
                    </Link>
                  ))}
                  {user.role === 'AGENT' && (
                    <Link
                      href="/catalogue"
                      onClick={onClose}
                      className="flex items-center gap-2.5 py-2 text-[13px] font-[500] font-public-sans text-muted-text hover:text-primary transition-colors"
                    >
                      <Layers size={13} aria-hidden="true" />
                      My Catalogues
                    </Link>
                  )}
                </div>
              )}
            </div>
          )}

          <Link href="/" onClick={onClose} className="py-3 text-[15px] font-[500] font-public-sans text-primary hover:text-accent transition-colors border-b border-border-warm/50">
            Home
          </Link>

          <div className="mt-5 pt-4 border-t border-border-warm">
            <p className="text-[11px] font-[600] font-public-sans text-muted-text uppercase tracking-[0.06em] mb-3">
              Currency
            </p>
            <div className="flex flex-col gap-1 max-h-[220px] overflow-y-auto">
              {availableCurrencies.map((c) => {
                const active = c === currency
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCurrency(c)}
                    className={cn(
                      'flex items-center justify-between w-full px-3 py-2.5 rounded border transition-colors text-left',
                      active ? 'border-primary bg-primary/5' : 'border-border-warm hover:border-primary/40 hover:bg-muted-bg'
                    )}
                  >
                    <span className={cn('text-[13px] font-public-sans', active ? 'text-primary font-[600]' : 'text-muted-text')}>
                      {getCurrencyName(c)}
                    </span>
                    <span className={cn('text-[12px] font-[600] font-public-sans', active ? 'text-primary' : 'text-muted-text/60')}>
                      {c}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-2">
            {isAuthenticated ? (
              <Button variant="ghost" className="w-full" onClick={() => { logout(); onClose() }}>
                Sign out
              </Button>
            ) : (
              <>
                <Button variant="primary" className="w-full" onClick={handleAuth}>Sign in</Button>
                <Button
                  variant={pathname?.startsWith('/sell') ? 'accent' : 'ghost'}
                  className="w-full"
                  asChild
                >
                  <Link href="/sell" onClick={onClose}>Sign up to sell</Link>
                </Button>
              </>
            )}
          </div>
        </nav>
      </SheetContent>
    </Sheet>
  )
}

// ─── NavBar ───────────────────────────────────────────────────────────────────

interface NavBarProps {
  /** When true: nav has transparent bg + white text until scrolled */
  transparent?: boolean
}

export function NavBar({ transparent = false }: NavBarProps) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const openAuthModal = useAuthStore((s) => s.openAuthModal)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const scrolled = useScrolled(24)
  const pathname = usePathname()
  const hidden = useHideOnScroll(isAuthenticated)

  const ghost = transparent && !scrolled

  return (
    <>
      {!transparent && <div className="shrink-0 h-16 md:h-[108px]" aria-hidden="true" />}

      <header
        className={cn(
          'fixed top-0 left-0 right-0 z-40 transition-all duration-300',
          hidden && '-translate-y-full',
          ghost ? 'bg-transparent border-b border-transparent' : 'bg-surface border-b border-border-warm shadow-[0_1px_0_0_rgba(26,26,26,0.05)]'
        )}
      >
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center gap-3">
          {/* Logo */}
          <Link href="/" aria-label="Solomon Bharat — home" className="flex-shrink-0 flex items-center self-stretch">
            <img
              src="https://res.cloudinary.com/dxnqyvcdl/image/upload/v1788850557/branding/1788850490541-solomon-bharat-logo.png"
              alt="Solomon Bharat"
              className={cn('h-14 w-auto object-contain block', ghost && 'brightness-0 invert')}
            />
          </Link>

          {/* Nav links — desktop */}
          <nav className="hidden md:flex items-center gap-1 ml-4">
            <CategoryMegaMenu ghost={ghost} />
          </nav>

          <NavSearchBar ghost={ghost} />

          {/* Right cluster */}
          <div className="hidden md:flex items-center gap-1 flex-shrink-0 ml-auto">
            <CurrencySelector ghost={ghost} />

            {isAuthenticated ? (
              <>
                <NotificationBell ghost={ghost} />
                <UserDropdown />
                <CartButton ghost={ghost} />
              </>
            ) : (
              <>
                <Link
                  href="/sell"
                  className={cn(
                    'inline-flex items-center h-9 px-3 rounded text-[15px] font-[500] font-public-sans transition-colors',
                    pathname?.startsWith('/sell')
                      ? ghost ? 'text-white bg-white/10' : 'text-primary font-[600] bg-muted-bg'
                      : ghost ? 'text-white/80 hover:text-white hover:bg-white/10' : 'text-muted-text hover:text-primary hover:bg-muted-bg'
                  )}
                >
                  Sign up to sell
                </Link>
                <button
                  type="button"
                  onClick={() => openAuthModal('login')}
                  className={cn(
                    'inline-flex items-center h-9 px-3 rounded text-[15px] font-[500] font-public-sans transition-colors',
                    ghost ? 'text-white/80 hover:text-white hover:bg-white/10' : 'text-muted-text hover:text-primary hover:bg-muted-bg'
                  )}
                >
                  Sign in
                </button>
                <button
                  type="button"
                  onClick={() => openAuthModal('signup')}
                  className={cn(
                    'inline-flex items-center h-9 px-5 ml-1 rounded font-[600] font-public-sans text-[15px] transition-colors',
                    ghost ? 'bg-white text-primary hover:bg-white/90' : 'bg-primary text-white hover:bg-[#2a2a2a]'
                  )}
                >
                  Sign up to buy
                </button>
              </>
            )}
          </div>

          {/* Mobile icons */}
          <div className="flex md:hidden items-center gap-0.5 ml-auto">
            {isAuthenticated && <CartButton ghost={ghost} />}
            <button
              type="button"
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              onClick={() => setMobileMenuOpen((v) => !v)}
              className={cn(
                'inline-flex items-center justify-center w-9 h-9 rounded transition-colors',
                ghost ? 'text-white hover:bg-white/10' : 'text-primary hover:bg-muted-bg'
              )}
            >
              {mobileMenuOpen ? <X size={17} aria-hidden="true" /> : <Menu size={17} aria-hidden="true" />}
            </button>
          </div>
        </div>

        <CategoryQuickLinksRow ghost={ghost} />
      </header>

      <MobileNavDrawer open={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
    </>
  )
}
