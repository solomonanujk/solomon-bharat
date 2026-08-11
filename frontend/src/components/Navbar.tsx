'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { ShoppingCart, User as UserIcon, Menu, X } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetClose } from '@/components/ui/Sheet';
import { useCart } from '@/providers/CartProvider';
import { useAuth } from '@/providers/AuthProvider';

const NAV_LINKS = [
  { href: '/categories', label: 'Categories' },
  { href: '/collections', label: 'Collections' },
];

const LOGO_URL = 'https://res.cloudinary.com/dxnqyvcdl/image/upload/v1781610714/solomon-logo1_inmwov.png';

function accountHref(role: string | undefined): string {
  if (role === 'SELLER') return '/seller/dashboard';
  if (role === 'SUPER_ADMIN') return '/admin/dashboard';
  if (role === 'BUYER') return '/profile';
  return '/login';
}

export function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { itemCount } = useCart();
  const { user } = useAuth();
  const accountLink = accountHref(user?.role);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg-surface/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-content items-center gap-3 px-margin-mobile md:px-margin-desktop">
        <Link href="/" aria-label="Solomon Bharat — home" className="flex shrink-0 items-center">
          <Image src={LOGO_URL} alt="Solomon Bharat" width={140} height={36} className="h-9 w-auto object-contain" priority />
        </Link>

        <nav className="hidden items-center gap-6 md:ml-8 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-text-primary transition-colors hover:text-accent-primary"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto hidden items-center gap-1 md:flex">
          <Link
            href="/cart"
            aria-label="Cart"
            className="relative inline-flex h-9 w-9 items-center justify-center rounded text-text-primary transition-colors hover:bg-fill-subtle hover:text-accent-primary"
          >
            <ShoppingCart size={18} aria-hidden="true" />
            {itemCount > 0 && (
              <span className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-accent-secondary text-[10px] font-semibold text-white">
                {itemCount}
              </span>
            )}
          </Link>
          <Link
            href={accountLink}
            aria-label="Account"
            className="inline-flex h-9 w-9 items-center justify-center rounded text-text-primary transition-colors hover:bg-fill-subtle hover:text-accent-primary"
          >
            <UserIcon size={18} aria-hidden="true" />
          </Link>
        </div>

        <div className="ml-auto flex items-center gap-1 md:hidden">
          <Link href="/cart" aria-label="Cart" className="relative inline-flex h-9 w-9 items-center justify-center rounded text-text-primary">
            <ShoppingCart size={18} aria-hidden="true" />
            {itemCount > 0 && (
              <span className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-accent-secondary text-[10px] font-semibold text-white">
                {itemCount}
              </span>
            )}
          </Link>
          <button
            type="button"
            aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
            className="inline-flex h-9 w-9 items-center justify-center rounded text-text-primary"
            onClick={() => setIsMenuOpen(true)}
          >
            <Menu size={20} aria-hidden="true" />
          </button>
        </div>
      </div>

      <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
        <SheetContent side="right" className="flex flex-col">
          <SheetHeader>
            <SheetTitle>Menu</SheetTitle>
            <SheetClose aria-label="Close menu">
              <X size={18} aria-hidden="true" />
            </SheetClose>
          </SheetHeader>
          <nav className="flex flex-col gap-1 p-4">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setIsMenuOpen(false)}
                className="rounded px-2 py-2.5 text-sm font-medium text-text-primary hover:bg-fill-subtle"
              >
                {link.label}
              </Link>
            ))}
            <Link
              href={accountLink}
              onClick={() => setIsMenuOpen(false)}
              className="rounded px-2 py-2.5 text-sm font-medium text-text-primary hover:bg-fill-subtle"
            >
              Account
            </Link>
          </nav>
        </SheetContent>
      </Sheet>
    </header>
  );
}
