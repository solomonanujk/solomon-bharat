'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import {
  ArrowRight, Globe2, Shield, Zap, BarChart3, Star,
  ChevronDown, ChevronRight, Store, Award, Users, Package, CheckCircle2,
  Clock, BadgeCheck, ClipboardCheck, Bell, Wallet,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { NavBar } from '@/components/shared/NavBar'
import { Footer } from '@/components/shared/Footer'
import { useAuthStore } from '@/lib/store/useAuthStore'

// ─── Hero ─────────────────────────────────────────────────────────────────────

const HERO_STATS = [
  { Icon: BadgeCheck, value: 'Selective', label: 'Not open to everyone'  },
  { Icon: Globe2,     value: '40+',       label: 'Countries we sell to'  },
  { Icon: Users,      value: '24–48h',    label: 'Application review'    },
  { Icon: Package,    value: '₹0',        label: 'To list and apply'     },
]

function Hero() {
  return (
    <section className="relative overflow-hidden min-h-[580px] h-[90vh]">

      {/* Full-bleed background image */}
      <Image
        src="https://res.cloudinary.com/dxnqyvcdl/image/upload/v1783429597/Gemini_Generated_Image_56ug4l56ug4l56ug_hvg3kn.png"
        alt="Indian artisan crafting handmade products for wholesale"
        fill
        sizes="100vw"
        className="object-cover object-right"
        priority
      />

      {/* Left-side fade — matches homepage exactly */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'linear-gradient(to right, rgba(249,247,242,0.95) 0%, rgba(249,247,242,0.82) 50%, rgba(249,247,242,0.30) 72%, rgba(249,247,242,0) 100%)' }}
        aria-hidden
      />

      {/* Content — left side */}
      <div className="relative z-10 flex items-center h-full absolute inset-0">
        <div className="w-full px-5 sm:px-8 md:px-10 lg:px-16 py-12 sm:py-16 lg:py-20">
          <div className="max-w-[520px]">

            {/* Eyebrow pill — matches homepage style */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-border-warm bg-white/60 backdrop-blur-sm mb-7">
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden>
                <path d="M6.5 1L8.2 5.1H12.5L9.2 7.6L10.4 11.8L6.5 9.3L2.6 11.8L3.8 7.6L0.5 5.1H4.8L6.5 1Z" fill="#A68B67"/>
              </svg>
              <span className="font-sans text-[11px] font-[700] text-accent uppercase tracking-[0.1em]">
                Sell on Solomon Bharat
              </span>
            </div>

            {/* Headline */}
            <h1 className="font-display font-[700] text-primary leading-[1.05] tracking-[-0.01em] text-[26px] sm:text-[34px] lg:text-[44px]">
              Your craft.<br />
              <span className="text-accent">Their shelves.</span><br />
              Zero fees to start.
            </h1>

            {/* Body */}
            <p className="font-sans text-[14px] sm:text-[15px] font-[500] leading-[1.65] text-muted-text mt-4 sm:mt-6 max-w-[400px]">
              We sell Indian-made products to wholesale buyers in 40+ countries.
              You make the product and set your price — we handle the buyers,
              the payments, and the international paperwork.
            </p>

            {/* CTAs */}
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/apply"
                className="inline-flex items-center gap-2 rounded bg-primary text-white font-[700] font-sans text-[14px] px-6 py-3 hover:bg-[#2a2a2a] transition-colors"
              >
                Apply now — it&apos;s free
                <ArrowRight size={14} aria-hidden />
              </Link>
              <a
                href="#how-it-works"
                className="inline-flex items-center gap-2 rounded border border-border-warm bg-white/50 backdrop-blur-sm text-primary font-[700] font-sans text-[14px] px-5 py-3 hover:bg-white/80 transition-colors"
              >
                How it works
              </a>
            </div>

            {/* Stats row */}
            <div className="mt-8 sm:mt-10 grid grid-cols-2 sm:flex sm:flex-wrap gap-x-5 gap-y-3 sm:gap-x-6 sm:gap-y-4">
              {HERO_STATS.map(({ Icon, value, label }) => (
                <div key={label} className="flex items-center gap-2">
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/70 border border-border-warm flex items-center justify-center flex-shrink-0">
                    <Icon size={13} className="text-accent" aria-hidden />
                  </div>
                  <div>
                    <p className="font-sans text-[13px] sm:text-[14px] font-[700] text-primary leading-tight">{value}</p>
                    <p className="font-sans text-[10px] sm:text-[11px] text-muted-text leading-tight">{label}</p>
                  </div>
                </div>
              ))}
            </div>

          </div>
        </div>
      </div>

      {/* Floating trust card — matches homepage floating card */}
      <div className="hidden sm:flex absolute top-8 left-[52%] lg:left-[50%] bg-white border border-border-warm rounded-lg px-4 py-3 shadow-[0_4px_24px_rgba(26,26,26,0.10)] items-center gap-3 z-10">
        <div className="w-9 h-9 rounded-full bg-accent/10 border border-border-warm flex items-center justify-center flex-shrink-0">
          <Store size={15} className="text-accent" aria-hidden />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-sans text-[13px] font-[700] text-primary leading-tight">Free to join</p>
          <p className="font-sans text-[11px] text-muted-text">No listing fees, ever</p>
        </div>
        <CheckCircle2 size={17} className="text-accent flex-shrink-0 ml-2" aria-hidden />
      </div>

    </section>
  )
}

// ─── Country ticker ───────────────────────────────────────────────────────────

const COUNTRIES = [
  'United Kingdom', 'United States', 'Germany', 'France', 'Netherlands',
  'Australia', 'Canada', 'UAE', 'Singapore', 'Italy', 'Spain', 'Sweden',
  'Denmark', 'Norway', 'Belgium', 'Switzerland', 'Japan', 'New Zealand',
]

function StatsBar() {
  const items = [...COUNTRIES, ...COUNTRIES]

  return (
    <section className="bg-muted-bg border-y border-border-warm py-5 lg:py-7 overflow-hidden">
      <p className="font-sans text-[10px] font-[700] text-accent uppercase tracking-[0.15em] text-center mb-4">
        Reaching buyers in
      </p>
      <div className="relative overflow-hidden">
        <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-muted-bg to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-muted-bg to-transparent z-10 pointer-events-none" />
        <div className="flex animate-[ticker_35s_linear_infinite]" style={{ width: 'max-content' }}>
          {items.map((country, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-5 px-6 font-display text-[26px] lg:text-[33px] font-[600] text-primary whitespace-nowrap"
            >
              {country}
              <span className="w-1.5 h-1.5 rounded-full bg-accent/50 flex-shrink-0" aria-hidden />
            </span>
          ))}
        </div>
      </div>
      <style>{`@keyframes ticker { from { transform: translateX(0); } to { transform: translateX(-50%); } }`}</style>
    </section>
  )
}

// ─── Why Solomon Bharat ───────────────────────────────────────────────────────

const WHY_ITEMS = [
  {
    Icon: Globe2,
    title: 'We find the buyers — you don\'t have to',
    body: 'Solomon Bharat sells to wholesale buyers in the US, UK, Europe, Australia, UAE, and 35+ more countries. You never cold-pitch a retailer or chase an international lead.',
  },
  {
    Icon: Wallet,
    title: 'No negotiation. You name your price.',
    body: 'Set the price you want when you submit a product. If it\'s approved and someone orders it, we pay you that exact amount. No commission, no hidden cut.',
  },
  {
    Icon: Shield,
    title: 'We\'re the ones selling internationally — not you',
    body: 'Solomon Bharat buys from you and sells to buyers under its own name. You don\'t deal with foreign invoices, customs paperwork, or chasing payment from an overseas retailer.',
  },
  {
    Icon: ClipboardCheck,
    title: 'The application is short — no documents needed',
    body: 'Just your business name, contact details, and a brief description of what you make. We don\'t ask for GST certificates or export docs just to apply.',
  },
  {
    Icon: BarChart3,
    title: 'One place for your products, orders, and payouts',
    body: 'Submit products, see where each one is in the review process, and track your orders and payments — all from your seller dashboard.',
  },
  {
    Icon: Bell,
    title: 'You\'ll know the moment something happens',
    body: 'We send you a notification as soon as a product is approved, rejected, or an order comes in. No refreshing the dashboard to find out.',
  },
]

function WhySection() {
  return (
    <section className="py-14 lg:py-20 bg-bg relative overflow-hidden">
      <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full bg-accent/[0.04] blur-[120px] translate-x-1/3 -translate-y-1/3 pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 lg:px-16 relative">
        <div className="max-w-[600px] mb-10">
          <div className="inline-flex items-center gap-2 mb-4">
            <span className="w-8 h-px bg-accent flex-shrink-0" />
            <p className="font-sans text-[11px] font-[700] text-accent uppercase tracking-[0.12em]">
              Why Solomon Bharat
            </p>
          </div>
          <h2 className="font-display text-[34px] sm:text-[44px] font-[600] text-primary leading-[1.1]">
            Built around how Indian brands actually work
          </h2>
          <p className="font-sans text-[15px] text-muted-text mt-4 leading-[1.7]">
            Most export platforms were built for large manufacturers. We built this
            for smaller Indian brands — the ones doing the actual craft work, not just
            the packaging.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {WHY_ITEMS.map(({ Icon, title, body }) => (
            <div
              key={title}
              className="group bg-surface border border-border-warm rounded-xl p-6 flex flex-col gap-4 hover:shadow-lg hover:shadow-black/6 hover:-translate-y-1 hover:border-accent/25 transition-all duration-300"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent/15 to-accent/5 border border-accent/20 flex items-center justify-center flex-shrink-0 group-hover:from-accent/25 group-hover:to-accent/10 transition-all duration-300">
                <Icon size={17} className="text-accent" aria-hidden />
              </div>
              <h3 className="font-sans text-[14px] font-[700] text-primary leading-[1.35]">
                {title}
              </h3>
              <p className="font-sans text-[13px] text-muted-text leading-[1.65]">
                {body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── How it works ─────────────────────────────────────────────────────────────

const STEPS = [
  {
    number: '01',
    title: 'Apply — takes about 10 minutes',
    body: 'Fill in your brand name, what you make, and your contact details. No documents upfront, no fees to apply.',
  },
  {
    number: '02',
    title: 'We review your application',
    body: 'A real person on our team looks at every application. We\'ll email you a decision within 24–48 hours.',
  },
  {
    number: '03',
    title: 'Add your products',
    body: 'Once approved, use your seller portal to submit products with photos and pricing. Each one gets reviewed before it goes live.',
  },
  {
    number: '04',
    title: 'Ship when orders come in',
    body: 'Orders appear in your portal. You ship them, mark them dispatched, and we process your payment within 15 days.',
  },
]

function HowItWorks() {
  return (
    <section id="how-it-works" className="py-14 lg:py-20 bg-surface border-y border-border-warm relative overflow-hidden">
      <div className="absolute bottom-0 left-0 w-[500px] h-[400px] rounded-full bg-accent/[0.03] blur-[100px] -translate-x-1/3 translate-y-1/3 pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 lg:px-16 relative">
        <div className="max-w-[560px] mb-10">
          <div className="inline-flex items-center gap-2 mb-4">
            <span className="w-8 h-px bg-accent flex-shrink-0" />
            <p className="font-sans text-[11px] font-[700] text-accent uppercase tracking-[0.12em]">
              How it works
            </p>
          </div>
          <h2 className="font-display text-[34px] sm:text-[44px] font-[600] text-primary leading-[1.1]">
            What happens after you apply
          </h2>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 relative">
          {/* Connector line (desktop only, behind steps) */}
          <div className="hidden lg:block absolute top-[22px] left-[calc(12.5%+22px)] right-[calc(12.5%+22px)] h-px bg-gradient-to-r from-accent/30 via-accent/20 to-accent/30 pointer-events-none" />

          {STEPS.map(({ number, title, body }) => (
            <div key={number} className="flex flex-col gap-4">
              <div className="relative w-11 h-11 rounded-full bg-bg border-2 border-accent/40 flex items-center justify-center z-10 flex-shrink-0 shadow-sm">
                <span className="font-display text-[14px] font-[700] text-accent">{number}</span>
              </div>
              <h3 className="font-sans text-[15px] font-[700] text-primary leading-[1.3]">
                {title}
              </h3>
              <p className="font-sans text-[13px] text-muted-text leading-[1.65]">
                {body}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-10 text-center">
          <Link
            href="/apply"
            className="inline-flex items-center gap-2 rounded-lg bg-primary text-white font-[700] font-sans text-[15px] px-9 py-4 hover:bg-[#2a2a2a] transition-all hover:shadow-xl hover:shadow-black/12 hover:-translate-y-0.5"
          >
            Start your application
            <ArrowRight size={15} aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  )
}

// ─── How you get paid ─────────────────────────────────────────────────────────

function PricingSection() {
  return (
    <section className="py-14 lg:py-20 bg-bg relative overflow-hidden">
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] rounded-full bg-accent/[0.04] blur-[110px] -translate-x-1/3 translate-y-1/3 pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 lg:px-16 relative">
        <div className="max-w-[640px]">
          <div className="inline-flex items-center gap-2 mb-4">
            <span className="w-8 h-px bg-accent flex-shrink-0" />
            <p className="font-sans text-[11px] font-[700] text-accent uppercase tracking-[0.12em]">
              How you get paid
            </p>
          </div>
          <h2 className="font-display text-[34px] sm:text-[44px] font-[600] text-primary leading-[1.1] mb-5">
            You set the price. We pay it. That&apos;s it.
          </h2>
          <p className="font-sans text-[15px] text-muted-text leading-[1.7] mb-7">
            There are no listing fees, no subscriptions, and we don&apos;t take a percentage of your sale.
            When you submit a product, you tell us what you want for it. If someone orders it, we pay
            you that amount — the international markup is ours to manage, not yours to negotiate.
          </p>
          <div className="flex flex-col gap-3.5">
            {[
              'Free to apply, free to list',
              'You set your price per product — no bidding, no negotiation',
              'We pay your price in full when an order is placed',
              'We handle the buyer, the invoice, and the international transfer',
            ].map((text) => (
              <div key={text} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-accent/15 flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 size={12} className="text-accent" aria-hidden />
                </div>
                <span className="font-sans text-[14px] text-primary">{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Seller portal features ───────────────────────────────────────────────────

const PORTAL_FEATURES = [
  { Icon: Package, title: 'Submit products', body: 'Add photos, pricing, and product details. We review each submission before it goes live on the platform.' },
  { Icon: ClipboardCheck, title: 'See where each product stands', body: 'Pending, approved, or needs changes — you\'ll see the status for every submission, with a reason if something was rejected.' },
  { Icon: Bell, title: 'Notifications that actually matter', body: 'We tell you when a product gets approved, when something needs a fix, and when an order comes in for your products.' },
  { Icon: Wallet, title: 'Orders and payout history', body: 'Every order for your products is listed here, along with your payout history as payments are processed.' },
]

function PortalSection() {
  return (
    <section className="py-14 lg:py-20 bg-surface border-y border-border-warm">
      <div className="max-w-7xl mx-auto px-6 lg:px-16">
        <div className="max-w-[600px] mb-10">
          <div className="inline-flex items-center gap-2 mb-4">
            <span className="w-8 h-px bg-accent flex-shrink-0" />
            <p className="font-sans text-[11px] font-[700] text-accent uppercase tracking-[0.12em]">
              Seller portal
            </p>
          </div>
          <h2 className="font-display text-[34px] sm:text-[44px] font-[600] text-primary leading-[1.1]">
            Your seller portal isn&apos;t just for uploading products
          </h2>
          <p className="font-sans text-[15px] text-muted-text mt-4 leading-[1.7]">
            It&apos;s where you run the whole thing — submissions, approvals, orders, and
            payments, in one place.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {PORTAL_FEATURES.map(({ Icon, title, body }) => (
            <div
              key={title}
              className="group rounded-xl border border-border-warm bg-bg p-5 flex flex-col gap-3.5 hover:border-accent/40 hover:-translate-y-0.5 transition-all duration-200"
            >
              <div className="w-10 h-10 rounded-xl bg-muted-bg border border-border-warm flex items-center justify-center flex-shrink-0">
                <Icon size={16} className="text-accent" aria-hidden />
              </div>
              <h3 className="font-sans text-[14px] font-[700] text-primary leading-[1.35]">
                {title}
              </h3>
              <p className="font-sans text-[13px] text-muted-text leading-[1.65]">
                {body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Seller testimonials ──────────────────────────────────────────────────────

const TESTIMONIALS = [
  {
    quote: "I honestly didn't expect the first order to come this quickly. Three months after applying, we had buyers reordering from the UK and Australia. I just had to ship.",
    name: 'Priya Mehta',
    brand: 'Indigo Root Textiles · Jaipur',
    avatar: 'PM',
  },
  {
    quote: "I run this by myself and international paperwork was always the thing stopping me. The application was straightforward — approval came in about 36 hours and the portal is simple enough that I figured it out on my own.",
    name: 'Rajan Nair',
    brand: 'Canework & Clay · Thrissur',
    avatar: 'RN',
  },
  {
    quote: "A buyer in France placed a large order and kept reordering. We never spoke to them directly — Solomon Bharat managed all of that. It became our biggest wholesale account.",
    name: 'Anika Sharma',
    brand: 'Bagh Print House · Bhopal',
    avatar: 'AS',
  },
]

function Testimonials() {
  return (
    <section className="py-14 lg:py-20 bg-bg relative overflow-hidden">
      <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full bg-accent/[0.04] blur-[110px] translate-x-1/4 -translate-y-1/4 pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 lg:px-16 relative">
        <div className="max-w-[480px] mb-10">
          <div className="inline-flex items-center gap-2 mb-4">
            <span className="w-8 h-px bg-accent flex-shrink-0" />
            <p className="font-sans text-[11px] font-[700] text-accent uppercase tracking-[0.12em]">
              Seller stories
            </p>
          </div>
          <h2 className="font-display text-[34px] sm:text-[44px] font-[600] text-primary leading-[1.1]">
            From the sellers already on the platform
          </h2>
        </div>

        <div className="grid sm:grid-cols-3 gap-6">
          {TESTIMONIALS.map(({ quote, name, brand, avatar }) => (
            <div
              key={name}
              className="group relative bg-surface border border-border-warm rounded-2xl p-7 flex flex-col gap-5 overflow-hidden hover:shadow-xl hover:shadow-black/6 hover:-translate-y-1 hover:border-accent/20 transition-all duration-300"
            >
              {/* Decorative quote mark */}
              <span className="absolute top-3 right-5 font-display text-[90px] leading-none text-accent/[0.07] select-none pointer-events-none group-hover:text-accent/[0.12] transition-colors duration-300">
                &ldquo;
              </span>

              <div className="flex gap-0.5">
                {Array.from({ length: 5 }, (_, i) => (
                  <Star key={i} size={13} fill="#A68B67" stroke="none" aria-hidden />
                ))}
              </div>
              <blockquote className="font-sans text-[14px] text-muted-text leading-[1.75] flex-1 relative z-10">
                &ldquo;{quote}&rdquo;
              </blockquote>
              <div className="flex items-center gap-3 pt-4 border-t border-border-warm">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-accent/20 to-accent/5 border border-accent/25 flex items-center justify-center flex-shrink-0">
                  <span className="font-sans text-[12px] font-[700] text-accent">{avatar}</span>
                </div>
                <div>
                  <p className="font-sans text-[13px] font-[700] text-primary">{name}</p>
                  <p className="font-sans text-[11px] text-muted-text">{brand}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── The man behind it ────────────────────────────────────────────────────────

const FOUNDER_STATS = [
  { value: '16K+',  label: 'Instagram community' },
  { value: '300+',  label: 'Brands launched across 20+ countries' },
  { value: '₹7.5L', label: 'Grants raised for Solomon Bharat' },
  { value: '5',     label: 'Countries personally exported to' },
]

const FOUNDER_HIGHLIGHTS = [
  "Mentor at Tetr College of Business & Masters' Union",
  "Incubated at Masters' Union",
  'Backed by Ashish Singhal (Founder, CoinSwitch) & Masters\' Union',
  'Previously exported to UK, Australia, Canada, Bangkok & Qatar',
]

function FounderSection() {
  return (
    <section className="py-14 lg:py-20 bg-surface border-y border-border-warm relative overflow-hidden">
      <div className="absolute top-0 left-0 w-[500px] h-[500px] rounded-full bg-accent/[0.05] blur-[120px] -translate-x-1/3 -translate-y-1/3 pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 lg:px-16 relative">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-start">

          {/* Left: photo + stats */}
          <div>
            <div className="relative rounded-2xl overflow-hidden aspect-[4/5] sm:aspect-[16/11] border border-border-warm">
              <Image
                src="https://res.cloudinary.com/dxnqyvcdl/image/upload/v1784015077/founder-pranjal_u57boj.jpg"
                alt="Pranjal S Agrawal, Founder of Solomon Bharat"
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/5 to-transparent" aria-hidden />
              <div className="absolute bottom-5 left-5">
                <p className="font-display text-[20px] font-[600] text-white leading-tight">Pranjal S Agrawal</p>
                <p className="font-sans text-[12px] text-white/70">Founder · Solomon Bharat</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-5">
              {FOUNDER_STATS.map(({ value, label }) => (
                <div key={label} className="bg-bg border border-border-warm rounded-xl p-5">
                  <p className="font-display text-[26px] font-[600] text-primary leading-none">{value}</p>
                  <p className="font-sans text-[12px] text-muted-text mt-1.5 leading-snug">{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Right: copy */}
          <div>
            <div className="inline-flex items-center gap-2 mb-4">
              <span className="w-8 h-px bg-accent flex-shrink-0" />
              <p className="font-sans text-[11px] font-[700] text-accent uppercase tracking-[0.12em]">
                The man behind it
              </p>
            </div>
            <h2 className="font-display text-[30px] sm:text-[38px] font-[700] text-primary leading-[1.15] mb-5">
              This was built by someone who{' '}
              <span className="text-accent italic">has actually done this</span>.
            </h2>
            <p className="font-sans text-[15px] text-muted-text leading-[1.75] mb-6">
              <strong className="text-primary font-[700]">Pranjal S Agrawal</strong> started Solomon Bharat after
              years of personally exporting Indian goods and watching other brands struggle
              to find international buyers without a middleman. He&apos;s also a mentor, a
              content creator with a community of over 7,000 people, and someone who&apos;s
              shipped to five countries himself.
            </p>

            <div className="flex flex-col gap-3 mb-8">
              {FOUNDER_HIGHLIGHTS.map((text) => (
                <div key={text} className="flex items-start gap-2">
                  <ChevronRight size={14} className="text-accent flex-shrink-0 mt-[3px]" aria-hidden />
                  <span className="font-sans text-[14px] text-primary/80 leading-[1.6]">{text}</span>
                </div>
              ))}
            </div>

            <a
              href="https://instagram.com/pranjalsagrawal"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-accent text-white font-[700] font-sans text-[13px] px-5 py-2.5 hover:bg-accent-hover transition-colors mb-8"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                <circle cx="12" cy="12" r="5" />
                <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
              </svg>
              Follow @pranjalsagrawal
            </a>

            <div className="bg-bg border border-border-warm rounded-xl p-6">
              <p className="font-display text-[17px] italic text-primary leading-[1.5]">
                &ldquo;I&apos;ve done this myself. I know what the paperwork looks like,
                what it takes to find a real buyer, and what Indian makers actually need.
                That&apos;s what I built this for.&rdquo;
              </p>
              <p className="font-sans text-[13px] text-muted-text mt-3">— Pranjal S Agrawal</p>
            </div>
          </div>

        </div>
      </div>
    </section>
  )
}

// ─── Requirements ─────────────────────────────────────────────────────────────

const REQUIREMENTS = [
  { Icon: BadgeCheck, label: 'India-based', detail: 'Your products must be made or sourced in India' },
  { Icon: Package, label: 'At least 10 wholesale styles', detail: 'We look for brands that have a real range to offer, not just one or two items' },
  { Icon: Clock, label: 'You can actually fulfil orders', detail: 'You need to be able to ship within the lead times you quote — buyers depend on it' },
  { Icon: Award, label: 'Craft or design-led products', detail: 'Handmade, artisanal, or thoughtfully designed — not mass-produced generic goods' },
]

function RequirementsSection() {
  return (
    <section className="py-14 lg:py-20 bg-surface border-y border-border-warm">
      <div className="max-w-7xl mx-auto px-6 lg:px-16">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          <div>
            <div className="inline-flex items-center gap-2 mb-4">
              <span className="w-8 h-px bg-accent flex-shrink-0" />
              <p className="font-sans text-[11px] font-[700] text-accent uppercase tracking-[0.12em]">
                Who can apply
              </p>
            </div>
            <h2 className="font-display text-[34px] sm:text-[44px] font-[600] text-primary leading-[1.1] mb-5">
              We&apos;re not looking for the biggest brands
            </h2>
            <p className="font-sans text-[15px] text-muted-text leading-[1.7]">
              Most of our sellers are small independent makers — somewhere between 1 and 200 people.
              You don&apos;t need an export history or an import-export code to apply.
              You just need a genuine product and the ability to ship it reliably.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {REQUIREMENTS.map(({ Icon, label, detail }) => (
              <div
                key={label}
                className="group bg-bg border border-border-warm rounded-xl p-5 flex flex-col gap-3 hover:shadow-md hover:shadow-black/5 hover:-translate-y-0.5 hover:border-accent/25 transition-all duration-300"
              >
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent/12 to-accent/4 border border-accent/18 flex items-center justify-center group-hover:from-accent/22 transition-all duration-300">
                  <Icon size={16} className="text-accent" aria-hidden />
                </div>
                <p className="font-sans text-[14px] font-[700] text-primary">{label}</p>
                <p className="font-sans text-[12.5px] text-muted-text leading-[1.5]">{detail}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── FAQ ─────────────────────────────────────────────────────────────────────

const FAQS = [
  {
    q: 'How long does the review take?',
    a: 'We look at every application ourselves — it\'s not automated. You\'ll get an email with a decision within 24–48 hours on business days.',
  },
  {
    q: 'Is there any cost to join?',
    a: 'No. Applying is free, listing is free, and we don\'t take a commission from the price you set. The only money that moves is us paying you when orders come in.',
  },
  {
    q: 'How does pricing work?',
    a: 'When you submit a product, you set the price you want to receive for it. If we approve it and an order comes in, we pay you that amount. We mark it up on our side when we sell internationally — that\'s our business, not yours to manage.',
  },
  {
    q: 'Do I have to talk to the buyers myself?',
    a: 'No. Solomon Bharat is the seller on record internationally. You never deal with a foreign buyer directly — no invoicing, no customs back-and-forth, no chasing payment from someone overseas.',
  },
  {
    q: 'Can I sell on other platforms at the same time?',
    a: 'Yes. We don\'t ask for exclusivity. Sell through your own site, on Etsy, through other platforms — it\'s your business.',
  },
  {
    q: 'What do I need to apply?',
    a: 'Your business name, what you make, a contact name, email, phone, and address. That\'s it for the application — we don\'t ask for GST certificates or IEC codes just to get started.',
  },
]

function FAQ() {
  const [open, setOpen] = useState<number | null>(null)

  return (
    <section className="py-14 lg:py-20 bg-bg">
      <div className="max-w-3xl mx-auto px-6 lg:px-8">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center gap-3 mb-4">
            <span className="w-10 h-px bg-accent" />
            <p className="font-sans text-[11px] font-[700] text-accent uppercase tracking-[0.12em]">FAQ</p>
            <span className="w-10 h-px bg-accent" />
          </div>
          <h2 className="font-display text-[34px] sm:text-[44px] font-[600] text-primary leading-[1.1]">
            Common questions
          </h2>
        </div>

        <div className="flex flex-col divide-y divide-border-warm border-y border-border-warm">
          {FAQS.map(({ q, a }, i) => (
            <div key={q}>
              <button
                type="button"
                onClick={() => setOpen(open === i ? null : i)}
                aria-expanded={open === i}
                className="w-full flex items-start justify-between gap-4 py-5 text-left group"
              >
                <span className="font-sans text-[15px] font-[700] text-primary leading-[1.4] group-hover:text-accent transition-colors duration-200">
                  {q}
                </span>
                <div className={cn(
                  'w-6 h-6 rounded-full border flex items-center justify-center flex-shrink-0 mt-0.5 transition-all duration-200',
                  open === i
                    ? 'bg-accent border-accent shadow-sm shadow-accent/30'
                    : 'bg-surface border-border-warm'
                )}>
                  <ChevronDown
                    size={13}
                    className={cn(
                      'transition-transform duration-200',
                      open === i ? 'rotate-180 text-white' : 'text-muted-text'
                    )}
                    aria-hidden
                  />
                </div>
              </button>
              {open === i && (
                <p className="font-sans text-[14px] text-muted-text leading-[1.75] pb-6 pr-10">
                  {a}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Final CTA ────────────────────────────────────────────────────────────────

function FinalCTA() {
  const openAuthModal = useAuthStore((s) => s.openAuthModal)
  return (
    <section className="py-14 lg:py-20 bg-bg border-t border-border-warm">
      <div className="max-w-3xl mx-auto px-6 text-center">

        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-border-warm bg-white/60 mb-8">
          <Store size={11} className="text-accent" aria-hidden />
          <span className="font-sans text-[11px] font-[700] text-accent uppercase tracking-[0.1em]">
            Free to join · No contracts
          </span>
        </div>

        <h2 className="font-display text-[38px] sm:text-[50px] font-[700] text-primary leading-[1.05] mb-5">
          If the product is good,<br />
          <span className="text-accent">let&apos;s talk.</span>
        </h2>
        <p className="font-sans text-[15px] text-muted-text leading-[1.75] max-w-[480px] mx-auto mb-10">
          The application takes about 10 minutes. We review it ourselves, and
          you&apos;ll hear back within two business days.
        </p>

        <Link
          href="/apply"
          className="inline-flex items-center gap-2 rounded bg-primary text-white font-[700] font-sans text-[14px] px-8 py-3.5 hover:bg-[#2a2a2a] transition-colors"
        >
          Apply now — it&apos;s free
          <ArrowRight size={14} aria-hidden />
        </Link>

        <p className="mt-6 font-sans text-[13px] text-muted-text">
          Already have an account?{' '}
          <button
            type="button"
            onClick={() => openAuthModal('login')}
            className="text-primary font-[700] underline underline-offset-2 hover:text-accent transition-colors"
          >
            Log in
          </button>
        </p>
      </div>
    </section>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SellPage() {
  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <NavBar />

      <main className="flex-1">
        <Hero />
        <StatsBar />
        <WhySection />
        <HowItWorks />
        <PricingSection />
        <PortalSection />
        <Testimonials />
        <FounderSection />
        <RequirementsSection />
        <FAQ />
        <FinalCTA />
      </main>

      <Footer />
    </div>
  )
}
