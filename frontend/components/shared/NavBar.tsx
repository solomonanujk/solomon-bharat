'use client'

import { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X, ChevronDown, LogOut, User as UserIcon, ShoppingCart, Globe, Package, MessageSquare, Heart, LayoutDashboard } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { useCurrencyStore } from '@/lib/store/useCurrencyStore'
import { useCartStore } from '@/lib/store/useCartStore'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetClose } from '@/components/ui/sheet'

// ─── Nav items — Home | Categories | Collections | Sign In | Cart (prd §4.1, §11.6) ─

const NAV_LINKS = [
  { href: '/categories', label: 'Categories' },
  { href: '/collections', label: 'Collections' },
]

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
          'inline-flex items-center gap-1.5 h-9 px-2.5 rounded text-[13px] font-[600] font-public-sans transition-colors',
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

          {user.role === 'BUYER' && (
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

              {user.role === 'BUYER' && (
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
                </div>
              )}
            </div>
          )}

          <Link href="/" onClick={onClose} className="py-3 text-[15px] font-[500] font-public-sans text-primary hover:text-accent transition-colors border-b border-border-warm/50">
            Home
          </Link>
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={onClose}
              className="py-3 text-[15px] font-[500] font-public-sans text-primary hover:text-accent transition-colors border-b border-border-warm/50"
            >
              {link.label}
            </Link>
          ))}

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
              <Button variant="primary" className="w-full" onClick={handleAuth}>Sign in</Button>
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

  const ghost = transparent && !scrolled

  return (
    <>
      {!transparent && <div className="shrink-0 h-16" aria-hidden="true" />}

      <header
        className={cn(
          'fixed top-0 left-0 right-0 z-40 transition-all duration-300 h-16',
          ghost ? 'bg-transparent border-b border-transparent' : 'bg-surface border-b border-border-warm shadow-[0_1px_0_0_rgba(26,26,26,0.05)]'
        )}
      >
        <div className="max-w-7xl mx-auto px-4 h-full flex items-center gap-3">
          {/* Logo */}
          <Link href="/" aria-label="Solomon Bharat — home" className="flex-shrink-0 flex items-center self-stretch">
            <img
              src="https://res.cloudinary.com/dxnqyvcdl/image/upload/v1781610714/solomon-logo1_inmwov.png"
              alt="Solomon Bharat"
              className={cn('h-12 w-auto object-contain block', ghost && 'brightness-0 invert')}
            />
          </Link>

          {/* Nav links — desktop */}
          <nav className="hidden md:flex items-center gap-1 ml-4">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'inline-flex items-center h-9 px-3 rounded text-[14px] font-[500] font-public-sans transition-colors',
                  pathname?.startsWith(link.href)
                    ? ghost ? 'text-white' : 'text-primary font-[600]'
                    : ghost ? 'text-white/80 hover:text-white hover:bg-white/10' : 'text-muted-text hover:text-primary hover:bg-muted-bg'
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Right cluster */}
          <div className="hidden md:flex items-center gap-1 flex-shrink-0 ml-auto">
            <CurrencySelector ghost={ghost} />
            <CartButton ghost={ghost} />

            {isAuthenticated ? (
              <UserDropdown />
            ) : (
              <Button
                variant="ghost"
                size="md"
                onClick={() => openAuthModal('login')}
                className={cn('border-0', ghost && 'text-white hover:bg-white/10')}
              >
                Sign In
              </Button>
            )}
          </div>

          {/* Mobile icons */}
          <div className="flex md:hidden items-center gap-0.5 ml-auto">
            <CartButton ghost={ghost} />
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
      </header>

      <MobileNavDrawer open={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
    </>
  )
}
