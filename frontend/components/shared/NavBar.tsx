'use client'

import { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Menu, X, ChevronDown, LogOut, User as UserIcon, ShoppingCart, Globe, Package, MessageSquare, Heart, LayoutDashboard, Search as SearchIcon, Bell, Layers, Check } from 'lucide-react'
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

// Header geometry (spec §3). Desktop: 72px main row + 44px category row; below
// 1024px: 56px brand row + 60px search row (48px field + 12px bottom padding).
// Both add up to 116px, plus the header's 1px bottom border. The spacer and the
// mega menu's fixed offset below both rely on this — change them together.
const HEADER_HEIGHT_CLASS = 'h-[117px]'
const MEGA_MENU_TOP_CLASS = 'top-[117px]'

// Shared popover surface for every header dropdown: white, 1px line, 6px radius.
const POPOVER_CLASS =
  'absolute right-0 top-full mt-1 z-50 bg-white border border-line rounded-[6px] shadow-[0_8px_24px_rgba(32,32,30,0.08)]'

// Shared row style for links inside the header dropdowns / mobile drawer.
const MENU_ITEM_CLASS =
  'flex items-center gap-2.5 px-4 min-h-11 text-[14px] leading-[20px] font-[500] font-sans text-ink hover:bg-ivory hover:text-forest transition-colors duration-150'

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

function useEscapeKey(handler: () => void, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') handler()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [handler, enabled])
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

// Icon-only header control: 44px square hit area on every breakpoint.
function iconButtonClass(ghost?: boolean) {
  return cn(
    'relative inline-flex items-center justify-center w-11 h-11 rounded-[4px] transition-colors duration-150',
    ghost ? 'text-white hover:bg-white/10' : 'text-ink hover:text-forest hover:bg-ivory'
  )
}

// ─── Wordmark ─────────────────────────────────────────────────────────────────
// Text wordmark (Fraunces 500, 24/28 desktop, 21/26 mobile) in place of the old
// PNG logo. The aria-label keeps the link's purpose explicit for screen readers.

function Wordmark({ ghost, className }: { ghost?: boolean; className?: string }) {
  return (
    <Link
      href="/"
      aria-label="Solomon Bharat — home"
      className={cn(
        'inline-flex items-center min-h-11 whitespace-nowrap font-display font-[500] text-[21px] leading-[26px] lg:text-[24px] lg:leading-[28px]',
        ghost ? 'text-white' : 'text-ink',
        className
      )}
    >
      Solomon Bharat
    </Link>
  )
}

// ─── Currency selector ────────────────────────────────────────────────────────

function CurrencySelector({ ghost }: { ghost?: boolean }) {
  const currency = useCurrencyStore((s) => s.currency)
  const setCurrency = useCurrencyStore((s) => s.setCurrency)
  const { data: availableCurrencies = FALLBACK_CURRENCIES } = useCurrencies()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const close = () => setOpen(false)
  useOutsideClick(ref, close, open)
  useEscapeKey(close, open)

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={`Currency: ${currency}`}
        className={cn(
          'inline-flex items-center gap-1.5 h-11 px-2.5 rounded-[4px] text-[14px] leading-[20px] font-[500] font-sans transition-colors duration-150',
          ghost ? 'text-white hover:bg-white/10' : 'text-ink hover:text-forest hover:bg-ivory'
        )}
      >
        <Globe size={15} aria-hidden="true" />
        {currency}
        <ChevronDown size={12} className={cn('transition-transform', open && 'rotate-180')} aria-hidden="true" />
      </button>

      {open && (
        <div className={cn(POPOVER_CLASS, 'py-1.5 w-[240px] max-h-[320px] overflow-y-auto')}>
          {availableCurrencies.map((c) => {
            const active = c === currency
            return (
              <button
                key={c}
                type="button"
                aria-pressed={active}
                onClick={() => { setCurrency(c); setOpen(false) }}
                className={cn(
                  'w-full flex items-center justify-between gap-3 px-4 min-h-11 text-left transition-colors duration-150',
                  active ? 'bg-selected text-forest' : 'text-ink hover:bg-ivory'
                )}
              >
                <span className={cn('text-[14px] leading-[20px] font-sans', active && 'font-[600]')}>
                  {getCurrencyName(c)}
                </span>
                <span className="inline-flex items-center gap-1.5 text-[12px] font-[600] font-sans">
                  {active && <Check size={14} aria-hidden="true" />}
                  <span className={active ? 'text-forest' : 'text-muted'}>{c}</span>
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

function MegaMenuColumnLabel({ children }: { children: React.ReactNode }) {
  return <p className="type-eyebrow text-brass-deep mb-2">{children}</p>
}

function megaMenuLinkClass(active: boolean) {
  return cn(
    'py-2 text-[14px] leading-[20px] font-sans transition-colors duration-150',
    active
      ? 'text-forest font-[600] underline underline-offset-4'
      : 'text-ink hover:text-forest hover:underline underline-offset-4'
  )
}

function CategoryMegaMenu({ ghost }: { ghost?: boolean }) {
  const { data: tree = [] } = useCategoryTree()
  const [open, setOpen] = useState(false)
  const [activeL1, setActiveL1] = useState(0)
  const [activeL2, setActiveL2] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const close = () => setOpen(false)
  useOutsideClick(ref, close, open)
  useEscapeKey(close, open)

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
          'inline-flex items-center gap-1.5 h-11 px-3 rounded-[4px] text-[14px] leading-[20px] font-[500] font-sans whitespace-nowrap transition-colors duration-150',
          ghost ? 'text-white hover:bg-white/10' : 'text-ink hover:text-forest hover:bg-ivory',
          open && !ghost && 'text-forest bg-ivory'
        )}
      >
        All categories
        <ChevronDown size={12} className={cn('transition-transform', open && 'rotate-180')} aria-hidden="true" />
      </button>

      {open && (
        <div className={cn('fixed left-0 right-0 z-50 bg-white border-y border-line shadow-[0_8px_24px_rgba(32,32,30,0.08)]', MEGA_MENU_TOP_CLASS)}>
          <div className="sb-container py-8 relative">
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close categories menu"
              className="absolute top-3 right-4 inline-flex items-center justify-center w-11 h-11 rounded-[4px] text-muted hover:text-forest hover:bg-ivory transition-colors duration-150"
            >
              <X size={16} aria-hidden="true" />
            </button>

            <div className="flex gap-12 flex-wrap pr-12">
              {/* Column 1 — level 1 */}
              <div className="flex flex-col min-w-[180px] flex-shrink-0">
                <MegaMenuColumnLabel>Categories</MegaMenuColumnLabel>
                {tree.map((category, i) => (
                  <Link
                    key={category.id}
                    href={`/categories/${category.slug}`}
                    onClick={() => setOpen(false)}
                    onMouseEnter={() => handleHoverL1(i)}
                    onFocus={() => handleHoverL1(i)}
                    className={megaMenuLinkClass(i === activeL1)}
                  >
                    {category.name}
                  </Link>
                ))}
              </div>

              {/* Column 2 — level 2 of the active level 1 */}
              {level2.length > 0 && (
                <div className="flex flex-col min-w-[200px] flex-shrink-0">
                  <MegaMenuColumnLabel>{activeL1Category?.name}</MegaMenuColumnLabel>
                  {level2.map((category, i) => (
                    <Link
                      key={category.id}
                      href={`/categories/${category.slug}`}
                      onClick={() => setOpen(false)}
                      onMouseEnter={() => setActiveL2(i)}
                      onFocus={() => setActiveL2(i)}
                      className={megaMenuLinkClass(i === activeL2)}
                    >
                      {category.name}
                    </Link>
                  ))}
                </div>
              )}

              {/* Column 3 — level 3 of the active level 2 */}
              {level3.length > 0 && (
                <div className="flex flex-col min-w-[200px] flex-shrink-0">
                  <MegaMenuColumnLabel>{activeL2Category?.name}</MegaMenuColumnLabel>
                  {level3.map((category) => (
                    <Link
                      key={category.id}
                      href={`/categories/${category.slug}`}
                      onClick={() => setOpen(false)}
                      className={megaMenuLinkClass(false)}
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
// Prefills from the current /search?q= via the initialSearchQuery prop rather than
// calling useSearchParams itself: NavBar renders on nearly every page, and reading
// useSearchParams here directly would force a Suspense boundary everywhere NavBar is
// used. Only the search results page (which already has the value from its own
// Suspense-wrapped useSearchParams call) passes the prop; everywhere else it's
// simply undefined and the box starts empty as before.
// Rendered twice (desktop row / mobile second row) — only one is ever visible.

function NavSearchBar({ ghost, initialQuery, className }: { ghost?: boolean; initialQuery?: string; className?: string }) {
  const router = useRouter()
  const [value, setValue] = useState(initialQuery ?? '')

  // Keeps the box in sync if the active search query changes without this
  // component unmounting (e.g. following a "related search" link while /search
  // stays the active route) — adjusting state during render (React's documented
  // pattern for this) rather than an effect, so it takes effect in the same paint
  // instead of one render later.
  const [syncedQuery, setSyncedQuery] = useState(initialQuery)
  if (initialQuery !== syncedQuery) {
    setSyncedQuery(initialQuery)
    setValue(initialQuery ?? '')
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = value.trim()
    if (!trimmed) return
    router.push(`/search?q=${encodeURIComponent(trimmed)}`)
  }

  function handleClear() {
    setValue('')
  }

  return (
    <form onSubmit={handleSubmit} role="search" className={cn('min-w-0', className)}>
      <div className="relative w-full">
        <SearchIcon
          size={16}
          className={cn('absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none', ghost ? 'text-white/80' : 'text-muted')}
          aria-hidden="true"
        />
        <input
          type="search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder='Search for "tote bags"'
          aria-label="Search products"
          enterKeyHint="search"
          className={cn(
            // Ivory fill, 1px line border, 24px radius (spec §4 SEARCH). 16px text
            // keeps iOS from zooming the page on focus.
            'w-full h-12 lg:h-10 pl-11 pr-11 rounded-[24px] text-[16px] leading-[24px] lg:text-[14px] lg:leading-[20px] font-sans border transition-colors duration-150',
            '[&::-webkit-search-cancel-button]:appearance-none',
            ghost
              ? 'bg-white/10 border-white/30 text-white placeholder:text-white/80 focus:bg-white/20'
              : 'bg-ivory border-line text-ink placeholder:text-muted focus:border-forest focus:bg-white'
          )}
        />
        {value && (
          <button
            type="button"
            onClick={handleClear}
            aria-label="Clear search"
            className={cn(
              'absolute right-1 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-10 h-10 rounded-full transition-colors duration-150',
              ghost ? 'text-white/80 hover:text-white' : 'text-muted hover:text-forest'
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
// order volume in the last 30 days — backed by products.repository findTrending),
// then the real level-1 categories. No "Sale" — this marketplace has no
// discount-price concept to honestly back one.

const CURATED_LINKS = [
  { href: '/search?sort=newest', label: 'New products' },
  { href: '/search?sort=featured', label: 'Bestsellers' },
  { href: '/search?sort=trending', label: 'Trending' },
]

function CategoryQuickLinksRow({ ghost }: { ghost?: boolean }) {
  const { data: tree = [], isLoading } = useCategoryTree()

  const linkClass = cn(
    'flex-shrink-0 inline-flex items-center h-11 whitespace-nowrap text-[14px] leading-[20px] font-[500] font-sans underline-offset-4 transition-colors duration-150',
    ghost ? 'text-white/90 hover:text-white hover:underline' : 'text-muted hover:text-forest hover:underline'
  )

  return (
    <nav aria-label="Featured and categories" className="hidden lg:block">
      {/* justify-center-safe: centred while it fits, left-aligned (never clipped
          off the start) once the row overflows and scrolls. */}
      <div className="sb-container h-11 flex items-center justify-center-safe gap-6 overflow-x-auto [scrollbar-width:none]">
        {/* Curated links and real categories come from two different sources (static
            vs. an API call) — showing the curated links alone first, then having the
            categories pop in a couple seconds later, reads as a layout bug. Hold the
            whole row back until the category tree has loaded so everything appears
            together in one frame; the fixed height above keeps the row's space
            reserved so nothing else on the page shifts while it waits. */}
        {!isLoading && (
          <>
            {CURATED_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className={linkClass}>
                {link.label}
              </Link>
            ))}
            {tree.map((category) => (
              <Link key={category.id} href={`/categories/${category.slug}`} className={linkClass}>
                {category.name}
              </Link>
            ))}
          </>
        )}
      </div>
    </nav>
  )
}

// ─── Cart button ──────────────────────────────────────────────────────────────

function CountBadge({ count }: { count: number }) {
  return (
    <span className="absolute top-1.5 right-1.5 min-w-[16px] h-[16px] rounded-full bg-forest text-white text-[10px] font-[700] font-sans flex items-center justify-center px-1 tabular-nums leading-none pointer-events-none">
      {count > 99 ? '99+' : count}
    </span>
  )
}

function CartButton({ ghost }: { ghost?: boolean }) {
  const items = useCartStore((s) => s.items)
  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0)

  return (
    <Link
      href="/cart"
      aria-label={`Cart — ${totalItems} item${totalItems !== 1 ? 's' : ''}`}
      className={iconButtonClass(ghost)}
    >
      <ShoppingCart size={18} aria-hidden="true" />
      {totalItems > 0 && <CountBadge count={totalItems} />}
    </Link>
  )
}

// ─── Notification bell ────────────────────────────────────────────────────────

function NotificationBell({ ghost }: { ghost?: boolean }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const close = () => setOpen(false)
  useOutsideClick(ref, close, open)
  useEscapeKey(close, open)

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
        aria-haspopup="true"
        aria-label={unreadCount > 0 ? `Notifications — ${unreadCount} unread` : 'Notifications'}
        className={iconButtonClass(ghost)}
      >
        <Bell size={18} aria-hidden="true" />
        {unreadCount > 0 && <CountBadge count={unreadCount} />}
      </button>

      {open && (
        <div className={cn(POPOVER_CLASS, 'w-[340px] max-w-[calc(100vw-40px)] max-h-[420px] flex flex-col')}>
          <div className="flex items-center justify-between px-4 py-2 border-b border-line flex-shrink-0">
            <span className="text-[14px] leading-[20px] font-[600] font-sans text-ink">Notifications</span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => markAllRead.mutate()}
                className="min-h-11 text-[13px] font-[600] font-sans text-forest underline underline-offset-4 hover:text-forest-hover"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-4 py-8 text-center text-[14px] font-sans text-muted">
                No notifications yet.
              </p>
            ) : (
              notifications.map((n) => {
                const body = (
                  <div className={cn('px-4 py-3 border-b border-line last:border-0', !n.isRead && 'bg-selected')}>
                    <p className="text-[14px] font-[600] font-sans text-ink leading-snug">
                      {!n.isRead && <span className="sr-only">Unread: </span>}
                      {n.title}
                    </p>
                    <p className="text-[13px] font-sans text-muted mt-0.5 leading-snug line-clamp-2">
                      {n.message}
                    </p>
                  </div>
                )
                return n.link ? (
                  <Link
                    key={n.id}
                    href={n.link}
                    onClick={() => handleItemClick(n.id, n.isRead)}
                    className="block hover:bg-ivory transition-colors duration-150"
                  >
                    {body}
                  </Link>
                ) : (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => handleItemClick(n.id, n.isRead)}
                    className="block w-full text-left hover:bg-ivory transition-colors duration-150"
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
            className="flex items-center justify-center min-h-11 text-[13px] font-[600] font-sans text-forest underline underline-offset-4 border-t border-line hover:bg-ivory transition-colors duration-150 flex-shrink-0"
          >
            View all
          </Link>
        </div>
      )}
    </div>
  )
}

// ─── User dropdown ────────────────────────────────────────────────────────────

function UserDropdown({ ghost }: { ghost?: boolean }) {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const close = () => setOpen(false)
  useOutsideClick(ref, close, open)
  useEscapeKey(close, open)

  if (!user) return null

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label="Account menu"
        className={iconButtonClass(ghost)}
      >
        <span
          className={cn(
            'w-8 h-8 rounded-full inline-flex items-center justify-center border',
            ghost ? 'border-white/40 text-white' : 'bg-ivory border-line text-forest'
          )}
        >
          <UserIcon size={15} aria-hidden="true" />
        </span>
      </button>

      {open && (
        <div className={cn(POPOVER_CLASS, 'w-[240px] max-w-[calc(100vw-40px)]')}>
          <div className="px-4 py-3 border-b border-line">
            <p className="text-[13px] font-[600] font-sans text-ink truncate">{user.email}</p>
          </div>

          {(user.role === 'BUYER' || user.role === 'AGENT') && (
            <div className="py-1">
              {BUYER_NAV_ITEMS.map(({ href, label, icon: Icon }) => (
                <Link key={href} href={href} onClick={() => setOpen(false)} className={MENU_ITEM_CLASS}>
                  <Icon size={15} aria-hidden="true" />
                  {label}
                </Link>
              ))}
              {user.role === 'AGENT' && (
                <Link href="/catalogue" onClick={() => setOpen(false)} className={MENU_ITEM_CLASS}>
                  <Layers size={15} aria-hidden="true" />
                  My Catalogues
                </Link>
              )}
            </div>
          )}

          {user.role === 'SUPER_ADMIN' && (
            <div className="py-1">
              <Link href="/admin" onClick={() => setOpen(false)} className={MENU_ITEM_CLASS}>
                <LayoutDashboard size={15} aria-hidden="true" />
                Admin Panel
              </Link>
            </div>
          )}

          {user.role === 'SELLER' && (
            <div className="py-1">
              <Link href="/portal" onClick={() => setOpen(false)} className={MENU_ITEM_CLASS}>
                <LayoutDashboard size={15} aria-hidden="true" />
                Seller Portal
              </Link>
            </div>
          )}

          <div className="border-t border-line py-1">
            <button
              type="button"
              onClick={() => { logout(); setOpen(false) }}
              className={cn(MENU_ITEM_CLASS, 'w-full hover:text-error')}
            >
              <LogOut size={15} aria-hidden="true" />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Mobile drawer ────────────────────────────────────────────────────────────
// Below 1024px the category row and mega menu are hidden, so the drawer carries
// the curated links and level-1 categories alongside account links + currency.

const DRAWER_LINK_CLASS =
  'flex items-center gap-2.5 min-h-11 text-[15px] leading-[20px] font-[500] font-sans text-ink hover:text-forest transition-colors duration-150'

function DrawerGroupLabel({ children }: { children: React.ReactNode }) {
  return <p className="type-eyebrow text-brass-deep mb-1">{children}</p>
}

function MobileNavDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const openAuthModal = useAuthStore((s) => s.openAuthModal)
  const currency = useCurrencyStore((s) => s.currency)
  const setCurrency = useCurrencyStore((s) => s.setCurrency)
  const { data: availableCurrencies = FALLBACK_CURRENCIES } = useCurrencies()
  const { data: tree = [] } = useCategoryTree()

  function handleAuth(mode: 'login' | 'signup') { onClose(); openAuthModal(mode) }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="left" className="w-[320px] max-w-[90vw] flex flex-col">
        <SheetHeader className="px-5 py-2">
          <SheetTitle className="text-[21px] leading-[26px] text-ink">Menu</SheetTitle>
          <SheetClose className="w-11 h-11 -mr-2.5" aria-label="Close menu" />
        </SheetHeader>

        <nav aria-label="Mobile" className="flex flex-col px-5 py-4 flex-1 overflow-y-auto gap-6">
          {isAuthenticated && user && (
            <div className="pb-4 border-b border-line">
              <p className="text-[13px] font-sans text-muted truncate">{user.email}</p>

              <div className="mt-2 flex flex-col">
                {(user.role === 'BUYER' || user.role === 'AGENT') && (
                  <>
                    {BUYER_NAV_ITEMS.map(({ href, label, icon: Icon }) => (
                      <Link key={href} href={href} onClick={onClose} className={DRAWER_LINK_CLASS}>
                        <Icon size={15} aria-hidden="true" />
                        {label}
                      </Link>
                    ))}
                    {user.role === 'AGENT' && (
                      <Link href="/catalogue" onClick={onClose} className={DRAWER_LINK_CLASS}>
                        <Layers size={15} aria-hidden="true" />
                        My Catalogues
                      </Link>
                    )}
                  </>
                )}
                <Link href="/notifications" onClick={onClose} className={DRAWER_LINK_CLASS}>
                  <Bell size={15} aria-hidden="true" />
                  Notifications
                </Link>
              </div>
            </div>
          )}

          <div className="flex flex-col">
            <Link href="/" onClick={onClose} className={DRAWER_LINK_CLASS}>Home</Link>
            {CURATED_LINKS.map((link) => (
              <Link key={link.href} href={link.href} onClick={onClose} className={DRAWER_LINK_CLASS}>
                {link.label}
              </Link>
            ))}
          </div>

          {tree.length > 0 && (
            <div className="flex flex-col">
              <DrawerGroupLabel>Categories</DrawerGroupLabel>
              {tree.map((category) => (
                <Link
                  key={category.id}
                  href={`/categories/${category.slug}`}
                  onClick={onClose}
                  className={DRAWER_LINK_CLASS}
                >
                  {category.name}
                </Link>
              ))}
            </div>
          )}

          <div className="pt-4 border-t border-line">
            <DrawerGroupLabel>Currency</DrawerGroupLabel>
            <div className="mt-2 flex flex-col gap-1 max-h-[220px] overflow-y-auto">
              {availableCurrencies.map((c) => {
                const active = c === currency
                return (
                  <button
                    key={c}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setCurrency(c)}
                    className={cn(
                      'flex items-center justify-between gap-3 w-full px-3 min-h-11 rounded-[4px] border text-left transition-colors duration-150',
                      active ? 'border-forest bg-selected text-forest' : 'border-line text-ink hover:bg-ivory'
                    )}
                  >
                    <span className={cn('text-[14px] font-sans', active && 'font-[600]')}>
                      {getCurrencyName(c)}
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-[12px] font-[600] font-sans">
                      {active && <Check size={14} aria-hidden="true" />}
                      <span className={active ? 'text-forest' : 'text-muted'}>{c}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex flex-col gap-3 pb-2">
            {isAuthenticated ? (
              <Button variant="secondary" size="lg" className="w-full" onClick={() => { logout(); onClose() }}>
                Sign out
              </Button>
            ) : (
              <>
                <Button variant="primary" size="lg" className="w-full" onClick={() => handleAuth('signup')}>
                  Sign up to buy
                </Button>
                <Button variant="secondary" size="lg" className="w-full" onClick={() => handleAuth('login')}>
                  Sign in
                </Button>
                <Link
                  href="/sell"
                  onClick={onClose}
                  className="inline-flex items-center justify-center min-h-11 text-[14px] font-[600] font-sans text-forest underline underline-offset-4 hover:text-forest-hover"
                >
                  Sign up to sell
                </Link>
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
  /** Prefills the search box with the current /search?q= value — passed only by
   *  the search results page itself (which already has it via its own Suspense-
   *  wrapped useSearchParams call), so NavBar never needs its own useSearchParams
   *  and doesn't force a Suspense boundary on every page that renders it. */
  initialSearchQuery?: string
}

// Desktop header buttons are 36px tall (size sm) but keep a 44px hit area via
// an invisible pseudo-element that extends 4px above and below.
const HIT_AREA_44 = 'relative after:absolute after:inset-x-0 after:-inset-y-1'

export function NavBar({ transparent = false, initialSearchQuery }: NavBarProps) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const openAuthModal = useAuthStore((s) => s.openAuthModal)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const scrolled = useScrolled(24)
  const pathname = usePathname()
  const hidden = useHideOnScroll(isAuthenticated)

  const ghost = transparent && !scrolled
  const onSellPage = pathname?.startsWith('/sell') ?? false

  return (
    <>
      {!transparent && <div className={cn('shrink-0', HEADER_HEIGHT_CLASS)} aria-hidden="true" />}

      <header
        className={cn(
          'fixed top-0 left-0 right-0 z-40 border-b transition-[translate,background-color,border-color] duration-300',
          hidden && '-translate-y-full',
          ghost ? 'bg-transparent border-transparent' : 'bg-white border-line'
        )}
      >
        {/* ── Desktop (≥1024px): 72px main row ─────────────────────────────── */}
        <div className="hidden lg:flex sb-container h-[72px] items-center gap-3">
          <Wordmark ghost={ghost} className="flex-shrink-0 mr-1" />

          <CategoryMegaMenu ghost={ghost} />

          <NavSearchBar ghost={ghost} initialQuery={initialSearchQuery} className="flex-1 mx-1" />

          <div className="flex items-center gap-1 flex-shrink-0">
            <CurrencySelector ghost={ghost} />

            {isAuthenticated ? (
              <>
                <NotificationBell ghost={ghost} />
                <UserDropdown ghost={ghost} />
                <CartButton ghost={ghost} />
              </>
            ) : (
              <>
                <Link
                  href="/sell"
                  aria-current={onSellPage ? 'page' : undefined}
                  className={cn(
                    'inline-flex items-center h-11 px-2.5 whitespace-nowrap text-[14px] leading-[20px] font-[500] font-sans underline-offset-4 transition-colors duration-150',
                    ghost
                      ? 'text-white hover:underline'
                      : onSellPage
                        ? 'text-forest font-[600] underline'
                        : 'text-ink hover:text-forest hover:underline'
                  )}
                >
                  Sign up to sell
                </Link>
                <Button
                  variant={ghost ? 'outlineOnForest' : 'secondary'}
                  size="sm"
                  className={cn('ml-1 whitespace-nowrap', HIT_AREA_44)}
                  onClick={() => openAuthModal('login')}
                >
                  Sign in
                </Button>
                <Button
                  variant={ghost ? 'onForest' : 'primary'}
                  size="sm"
                  className={cn('ml-2 whitespace-nowrap', HIT_AREA_44)}
                  onClick={() => openAuthModal('signup')}
                >
                  Sign up to buy
                </Button>
              </>
            )}
          </div>
        </div>

        {/* ── Below 1024px: menu left, brand centred, account/cart right ───── */}
        {/* 1fr/auto/1fr keeps the wordmark optically centred; icon buttons pull
            into the gutter (-ml/-mr) so the 44px hit areas fit at 320px. */}
        <div className="lg:hidden sb-container h-14 grid grid-cols-[1fr_auto_1fr] items-center">
          <div className="flex items-center -ml-2.5">
            <button
              type="button"
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileMenuOpen}
              onClick={() => setMobileMenuOpen((v) => !v)}
              className={iconButtonClass(ghost)}
            >
              {mobileMenuOpen ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
            </button>
          </div>

          <Wordmark ghost={ghost} />

          <div className="flex items-center justify-end -mr-2.5">
            {isAuthenticated ? (
              <>
                <CartButton ghost={ghost} />
                <UserDropdown ghost={ghost} />
              </>
            ) : (
              <button
                type="button"
                aria-label="Sign in"
                onClick={() => openAuthModal('login')}
                className={iconButtonClass(ghost)}
              >
                <UserIcon size={20} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        {/* Search on its own row below 1024px: 48px field + 12px bottom padding. */}
        <div className="lg:hidden sb-container pb-3">
          <NavSearchBar ghost={ghost} initialQuery={initialSearchQuery} />
        </div>

        {/* ── Desktop: 44px category quick-links row ───────────────────────── */}
        <CategoryQuickLinksRow ghost={ghost} />
      </header>

      <MobileNavDrawer open={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
    </>
  )
}
