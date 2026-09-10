'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="font-public-sans text-[14px] text-muted-text hover:text-primary transition-colors leading-[1.4]"
    >
      {children}
    </Link>
  )
}

function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="font-public-sans text-[11px] font-[700] text-primary/40 uppercase tracking-[0.08em]">{title}</p>
      <nav className="flex flex-col gap-2.5" aria-label={title}>{children}</nav>
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
    return <p className="font-public-sans text-[13px] text-accent mt-4">Thanks! We&apos;ll be in touch.</p>
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4" aria-label="Newsletter signup">
      <div className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Your email address"
          required
          className={cn(
            'flex-1 h-9 rounded border border-border-warm bg-muted-bg px-3',
            'font-public-sans text-[13px] text-primary placeholder:text-muted-text/50',
            'outline-none focus:border-accent transition-colors'
          )}
        />
        <button
          type="submit"
          aria-label="Subscribe"
          className="h-9 px-3 rounded bg-accent text-white hover:bg-accent-hover transition-colors flex-shrink-0 flex items-center justify-center"
        >
          <ArrowRight size={14} aria-hidden="true" />
        </button>
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
      className="w-8 h-8 rounded border border-border-warm flex items-center justify-center text-muted-text hover:text-primary hover:border-primary/30 transition-colors"
    >
      {children}
    </a>
  )
}

export function Footer() {
  return (
    <footer className="bg-white border-t border-border-warm">
      <div className="max-w-7xl mx-auto px-5 sm:px-6 py-10 lg:py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-8 lg:gap-8">

          {/* Brand column */}
          <div className="sm:col-span-2 lg:col-span-2 flex flex-col">
            <Link href="/" className="flex-shrink-0">
              <img
                src="https://res.cloudinary.com/dxnqyvcdl/image/upload/v1788850557/branding/1788850490541-solomon-bharat-logo.png"
                alt="Solomon Bharat"
                className="h-16 w-auto object-contain block"
              />
            </Link>
            <p className="font-public-sans text-[14px] leading-[1.6] text-muted-text mt-3 max-w-[260px]">
              Solomon Bharat connects India&apos;s finest artisan goods with global wholesale buyers.
            </p>
            <a
              href="mailto:solomonbharat@gmail.com"
              className="font-public-sans text-[14px] text-muted-text hover:text-primary transition-colors mt-3"
            >
              solomonbharat@gmail.com
            </a>
            <div className="mt-6">
              <p className="font-public-sans text-[11px] font-[700] text-primary/40 uppercase tracking-[0.08em]">
                Stay updated
              </p>
              <NewsletterForm />
            </div>
          </div>

          <FooterColumn title="Marketplace">
            <FooterLink href="/collections">Collections</FooterLink>
          </FooterColumn>

          <FooterColumn title="Company">
            <FooterLink href="/about">About</FooterLink>
            <FooterLink href="/contact">Contact</FooterLink>
            <FooterLink href="/careers">Careers</FooterLink>
          </FooterColumn>

          <FooterColumn title="Resources">
            <FooterLink href="/help">Help Center</FooterLink>
            <FooterLink href="/faqs">FAQs</FooterLink>
            <FooterLink href="/export-guide">Export Guide</FooterLink>
          </FooterColumn>

          <FooterColumn title="Legal">
            <FooterLink href="/privacy">Privacy</FooterLink>
            <FooterLink href="/terms">Terms</FooterLink>
            <FooterLink href="/cookies">Cookies</FooterLink>
          </FooterColumn>
        </div>
      </div>

      <div className="border-t border-border-warm">
        <div className="max-w-7xl mx-auto px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <SocialLink href="https://www.linkedin.com/company/sourcewithsolomon/" label="LinkedIn">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6zM2 9h4v12H2z" />
                <circle cx="4" cy="4" r="2" />
              </svg>
            </SocialLink>
            <SocialLink href="https://www.instagram.com/solomonbharat/" label="Instagram">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                <circle cx="12" cy="12" r="5" />
                <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
              </svg>
            </SocialLink>
            <SocialLink href="https://facebook.com" label="Facebook">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M13.5 21v-8h2.7l.4-3.1h-3.1V8c0-.9.25-1.5 1.55-1.5H16.7V3.7C16.4 3.66 15.4 3.57 14.24 3.57c-2.44 0-4.11 1.49-4.11 4.22V9.9H7.4V13h2.73v8h3.37z" />
              </svg>
            </SocialLink>
          </div>
          <p className="font-public-sans text-[12px] text-muted-text/60">
            &copy; 2026 Solomon Bharat. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}
