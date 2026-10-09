'use client'

import { useState } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

// Every href below is a route that exists under app/ (checked when this footer
// was rebuilt) — don't add links to pages that haven't been built yet.
const FOOTER_GROUPS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: 'Shop',
    links: [
      { href: '/collections', label: 'Collections' },
      { href: '/brands', label: 'Brands' },
      { href: '/search?sort=newest', label: 'New products' },
      { href: '/search?sort=featured', label: 'Bestsellers' },
      { href: '/signup', label: 'Sign up to buy' },
    ],
  },
  {
    title: 'Company',
    links: [
      { href: '/about', label: 'About' },
      { href: '/sell', label: 'Sell with us' },
      { href: '/careers', label: 'Careers' },
      { href: '/contact', label: 'Contact' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { href: '/help', label: 'Help Center' },
      { href: '/faqs', label: 'FAQs' },
      { href: '/export-guide', label: 'Export Guide' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { href: '/privacy', label: 'Privacy' },
      { href: '/terms', label: 'Terms' },
      { href: '/cookies', label: 'Cookies' },
    ],
  },
]

// CONFIRM: legal entity wording for the copyright line — reused verbatim from the
// previous footer; owner to confirm the registered entity name before launch.
const COPYRIGHT_TEXT = '© 2026 Solomon Bharat. All rights reserved.'

const CONTACT_EMAIL = 'solomonbharat@gmail.com'

function FooterColumn({ title, links }: { title: string; links: { href: string; label: string }[] }) {
  return (
    <div className="flex flex-col">
      {/* Hanken 14/20/600 forest, 16px before links (less on mobile, where each
          link's own 44px touch target already adds the breathing room). */}
      <p className="font-sans text-[14px] leading-[20px] font-[600] text-forest mb-1 lg:mb-4">{title}</p>
      <nav className="flex flex-col lg:gap-3" aria-label={title}>
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="inline-flex items-center self-start min-h-11 lg:min-h-0 font-sans text-[14px] leading-[20px] text-muted underline-offset-4 hover:text-forest hover:underline transition-colors duration-150"
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </div>
  )
}

function NewsletterForm() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (email.trim()) setSubmitted(true)
  }

  if (submitted) {
    return (
      <p role="status" className="font-sans text-[14px] leading-[20px] text-forest mt-2">
        Thanks! We&apos;ll be in touch.
      </p>
    )
  }

  return (
    <form onSubmit={handleSubmit} aria-label="Newsletter signup">
      {/* Form field per spec §4: visible 14/20/600 label, 8px gap, 48px input. */}
      <label htmlFor="footer-newsletter-email" className="block font-sans text-[14px] leading-[20px] font-[600] text-forest">
        Stay updated
      </label>
      <div className="mt-2 flex gap-2">
        <input
          id="footer-newsletter-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Your email address"
          required
          className={cn(
            'flex-1 min-w-0 min-h-12 rounded-[4px] border border-line bg-white px-3',
            'font-sans text-[16px] leading-[24px] text-ink placeholder:text-muted',
            'focus:border-forest transition-colors duration-150'
          )}
        />
        <Button type="submit" variant="primary" className="min-h-12 h-auto flex-shrink-0">
          Subscribe
        </Button>
      </div>
    </form>
  )
}

function SocialLink({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      aria-label={label}
      target="_blank"
      rel="noopener noreferrer"
      className="w-11 h-11 lg:w-9 lg:h-9 rounded-[4px] border border-line flex items-center justify-center text-muted hover:text-forest hover:border-forest transition-colors duration-150"
    >
      {children}
    </a>
  )
}

export function Footer() {
  return (
    <footer className="bg-white border-t border-line">
      <div className="sb-container pt-12 lg:pt-14 pb-6">
        {/* Desktop: brand 2fr + four 1fr groups, 32px gaps. Mobile: brand full
            width, then two groups per row with 24px gaps. */}
        <div className="grid grid-cols-2 gap-6 md:grid-cols-4 md:gap-8 lg:grid-cols-[2fr_1fr_1fr_1fr_1fr]">

          {/* Brand column */}
          <div className="col-span-2 md:col-span-4 lg:col-span-1 flex flex-col">
            <Link
              href="/"
              aria-label="Solomon Bharat — home"
              className="self-start font-display font-[500] text-[21px] leading-[26px] lg:text-[24px] lg:leading-[28px] text-ink"
            >
              Solomon Bharat
            </Link>
            <p className="font-sans text-[16px] leading-[24px] text-muted mt-3 max-w-[260px]">
              Solomon Bharat connects India&apos;s finest artisan goods with global wholesale buyers.
            </p>
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="self-start inline-flex items-center min-h-11 font-sans text-[14px] leading-[20px] text-forest underline underline-offset-4 hover:text-forest-hover transition-colors duration-150 mt-1"
            >
              {CONTACT_EMAIL}
            </a>
            <div className="mt-6 max-w-[360px]">
              <NewsletterForm />
            </div>
          </div>

          {FOOTER_GROUPS.map((group) => (
            <FooterColumn key={group.title} title={group.title} links={group.links} />
          ))}
        </div>

        {/* Legal row: 1px divider, 32px above, 24px below; stacked on mobile. */}
        <div className="mt-8 border-t border-line pt-6 flex flex-col-reverse items-start gap-4 md:flex-row md:items-center md:justify-between">
          <p className="font-sans text-[13px] leading-[20px] text-muted">{COPYRIGHT_TEXT}</p>
          <div className="flex items-center gap-2">
            <SocialLink href="https://www.linkedin.com/company/sourcewithsolomon/" label="LinkedIn">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6zM2 9h4v12H2z" />
                <circle cx="4" cy="4" r="2" />
              </svg>
            </SocialLink>
            <SocialLink href="https://www.instagram.com/solomonbharat/" label="Instagram">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                <circle cx="12" cy="12" r="5" />
                <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
              </svg>
            </SocialLink>
            {/* CONFIRM: the previous footer linked Facebook to the bare
                https://facebook.com homepage (no Solomon Bharat page). Removed
                until a real page URL is supplied. */}
          </div>
        </div>
      </div>
    </footer>
  )
}
