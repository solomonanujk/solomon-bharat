'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import {
  ArrowRight, Globe2, BarChart3, Star,
  ChevronDown, ChevronRight, Store, Award, Users, Package, CheckCircle2,
  Clock, BadgeCheck, Bell, Wallet, FileText, Share2, ShoppingBag,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { NavBar } from '@/components/shared/NavBar'
import { Footer } from '@/components/shared/Footer'
import { useAuthStore } from '@/lib/store/useAuthStore'

// ─── Hero ─────────────────────────────────────────────────────────────────────

const HERO_STATS = [
  { Icon: BadgeCheck, value: 'Special',  label: 'Agent pricing'      },
  { Icon: Globe2,     value: '40+',      label: 'Countries Reached'  },
  { Icon: Users,      value: '24–48h',   label: 'Review Time'        },
  { Icon: Package,    value: 'Free',     label: 'To Apply'           },
]

function Hero() {
  return (
    <section className="relative overflow-hidden min-h-[580px] h-[90vh]">

      {/* Full-bleed background image */}
      <Image
        src="https://res.cloudinary.com/dxnqyvcdl/image/upload/v1783429597/Gemini_Generated_Image_56ug4l56ug4l56ug_hvg3kn.png"
        alt="Reseller sharing an Indian artisan product catalogue with a customer"
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
              <span className="font-public-sans text-[11px] font-[600] text-accent uppercase tracking-[0.1em]">
                Become an Agent
              </span>
            </div>

            {/* Headline */}
            <h1 className="font-playfair font-[600] text-primary leading-[1.05] tracking-[-0.01em] text-[26px] sm:text-[34px] lg:text-[44px]">
              Resell India&apos;s finest<br />
              <span className="text-accent">catalogue.</span> Your customers,<br />
              your business.
            </h1>

            {/* Body */}
            <p className="font-public-sans text-[14px] sm:text-[15px] font-[400] leading-[1.65] text-muted-text mt-4 sm:mt-6 max-w-[400px]">
              Browse the full Solomon Bharat catalogue at a special agent price, build your own
              PDF catalogues, and share them with customers over WhatsApp or social media —
              then purchase on their behalf whenever they&apos;re ready to buy.
            </p>

            {/* CTAs */}
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/apply-agent"
                className="inline-flex items-center gap-2 rounded bg-primary text-white font-[600] font-public-sans text-[14px] px-6 py-3 hover:bg-[#2a2a2a] transition-colors"
              >
                Apply now — it&apos;s free
                <ArrowRight size={14} aria-hidden />
              </Link>
              <a
                href="#how-it-works"
                className="inline-flex items-center gap-2 rounded border border-border-warm bg-white/50 backdrop-blur-sm text-primary font-[600] font-public-sans text-[14px] px-5 py-3 hover:bg-white/80 transition-colors"
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
                    <p className="font-public-sans text-[13px] sm:text-[14px] font-[600] text-primary leading-tight">{value}</p>
                    <p className="font-public-sans text-[10px] sm:text-[11px] text-muted-text leading-tight">{label}</p>
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
          <ShoppingBag size={15} className="text-accent" aria-hidden />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-public-sans text-[13px] font-[600] text-primary leading-tight">Free to join</p>
          <p className="font-public-sans text-[11px] text-muted-text">No listing fees, ever</p>
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
      <p className="font-public-sans text-[10px] font-[700] text-accent uppercase tracking-[0.15em] text-center mb-4">
        Selling into
      </p>
      <div className="relative overflow-hidden">
        <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-muted-bg to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-muted-bg to-transparent z-10 pointer-events-none" />
        <div className="flex animate-[ticker_35s_linear_infinite]" style={{ width: 'max-content' }}>
          {items.map((country, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-5 px-6 font-playfair text-[26px] lg:text-[33px] font-[500] text-primary whitespace-nowrap"
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
    Icon: Wallet,
    title: 'Special agent pricing',
    body: 'Browse the entire Solomon Bharat catalogue at a special agent price — lower than retail — so you always have room to build in your own margin when you resell.',
  },
  {
    Icon: FileText,
    title: 'Build your own PDF catalogues',
    body: 'Curate a selection of products and generate a clean, branded PDF catalogue in a few clicks — ready to send to any customer.',
  },
  {
    Icon: Share2,
    title: 'Share over WhatsApp & social',
    body: 'Send your catalogues and individual product listings straight to customers on WhatsApp, Instagram, or wherever they already are.',
  },
  {
    Icon: ShoppingBag,
    title: 'Purchase on behalf of your customers',
    body: 'Once a customer picks what they want, place the order on their behalf directly through your agent portal — no need to hand off to anyone else.',
  },
  {
    Icon: BarChart3,
    title: 'Track everything from your agent portal',
    body: 'See your catalogues, orders, and order status all from one dashboard built for running a reselling business.',
  },
  {
    Icon: Bell,
    title: 'Stay informed at every step',
    body: 'Get notified the moment an order you placed is confirmed, shipped, or delivered — so you always know where things stand with your customer.',
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
            <p className="font-public-sans text-[11px] font-[700] text-accent uppercase tracking-[0.12em]">
              Why Solomon Bharat
            </p>
          </div>
          <h2 className="font-playfair text-[34px] sm:text-[44px] font-[500] text-primary leading-[1.1]">
            Built for independent resellers
          </h2>
          <p className="font-public-sans text-[15px] text-muted-text mt-4 leading-[1.7]">
            We designed the agent programme around how independent resellers actually work —
            curating for customers, sharing on the channels they already use, and getting paid
            without holding any inventory.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {WHY_ITEMS.map(({ Icon, title, body }) => (
            <div
              key={title}
              className="group bg-surface border border-border-warm rounded-xl p-6 flex flex-col gap-4 hover:shadow-lg hover:shadow-black/6 hover:-translate-y-1 hover:border-accent/25 transition-all duration-300"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent/15 to-accent/5 border border-accent/20 flex items-center justify-center flex-shrink-0 group-hover:from-accent/25 group-hover:to-accent/10 transition-all duration-300">
                <Icon size={17} className="text-accent" aria-hidden />
              </div>
              <h3 className="font-public-sans text-[14px] font-[600] text-primary leading-[1.35]">
                {title}
              </h3>
              <p className="font-public-sans text-[13px] text-muted-text leading-[1.65]">
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
    title: 'Submit your application',
    body: 'Fill in your business details. Takes about 10 minutes. No fees, no commitments.',
  },
  {
    number: '02',
    title: 'Our team reviews (24–48h)',
    body: 'We manually review every application to maintain quality. You\'ll get a decision by email within two business days.',
  },
  {
    number: '03',
    title: 'Browse & build your catalogues',
    body: 'Once approved, browse the full catalogue at your agent price and curate PDF catalogues to share with your customers.',
  },
  {
    number: '04',
    title: 'Share, sell & order on their behalf',
    body: 'Send your catalogues over WhatsApp or social media, then place the order for your customer directly from your agent portal.',
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
            <p className="font-public-sans text-[11px] font-[700] text-accent uppercase tracking-[0.12em]">
              How it works
            </p>
          </div>
          <h2 className="font-playfair text-[34px] sm:text-[44px] font-[500] text-primary leading-[1.1]">
            From application to first sale
          </h2>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 relative">
          {/* Connector line (desktop only, behind steps) */}
          <div className="hidden lg:block absolute top-[22px] left-[calc(12.5%+22px)] right-[calc(12.5%+22px)] h-px bg-gradient-to-r from-accent/30 via-accent/20 to-accent/30 pointer-events-none" />

          {STEPS.map(({ number, title, body }) => (
            <div key={number} className="flex flex-col gap-4">
              <div className="relative w-11 h-11 rounded-full bg-bg border-2 border-accent/40 flex items-center justify-center z-10 flex-shrink-0 shadow-sm">
                <span className="font-playfair text-[14px] font-[600] text-accent">{number}</span>
              </div>
              <h3 className="font-public-sans text-[15px] font-[600] text-primary leading-[1.3]">
                {title}
              </h3>
              <p className="font-public-sans text-[13px] text-muted-text leading-[1.65]">
                {body}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-10 text-center">
          <Link
            href="/apply-agent"
            className="inline-flex items-center gap-2 rounded-lg bg-primary text-white font-[600] font-public-sans text-[15px] px-9 py-4 hover:bg-[#2a2a2a] transition-all hover:shadow-xl hover:shadow-black/12 hover:-translate-y-0.5"
          >
            Start your application
            <ArrowRight size={15} aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  )
}

// ─── How you earn ─────────────────────────────────────────────────────────────

function PricingSection() {
  return (
    <section className="py-14 lg:py-20 bg-bg relative overflow-hidden">
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] rounded-full bg-accent/[0.04] blur-[110px] -translate-x-1/3 translate-y-1/3 pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 lg:px-16 relative">
        <div className="max-w-[640px]">
          <div className="inline-flex items-center gap-2 mb-4">
            <span className="w-8 h-px bg-accent flex-shrink-0" />
            <p className="font-public-sans text-[11px] font-[700] text-accent uppercase tracking-[0.12em]">
              How you earn
            </p>
          </div>
          <h2 className="font-playfair text-[34px] sm:text-[44px] font-[500] text-primary leading-[1.1] mb-5">
            No commission. You set your resale price.
          </h2>
          <p className="font-public-sans text-[15px] text-muted-text leading-[1.7] mb-7">
            There are no listing fees, no monthly subscriptions, and no commission cut. Every
            product on the catalogue carries a special agent price for you. Whatever you charge
            your customer above that price is yours to keep — Solomon Bharat handles sourcing,
            fulfilment, and shipping on the order you place.
          </p>
          <div className="flex flex-col gap-3.5">
            {[
              'Free to apply and browse — no setup costs',
              'Every product carries a special agent price, visible only to you',
              'You decide what to charge your customer — the difference is your margin',
              'Solomon Bharat handles sourcing, fulfilment, and shipping for every order',
            ].map((text) => (
              <div key={text} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-accent/15 flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 size={12} className="text-accent" aria-hidden />
                </div>
                <span className="font-public-sans text-[14px] text-primary">{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Agent portal features ────────────────────────────────────────────────────

const PORTAL_FEATURES = [
  { Icon: FileText, title: 'Catalogue builder', body: 'Curate products from across the marketplace into your own branded PDF catalogues in a few clicks.' },
  { Icon: Share2, title: 'Share anywhere', body: 'Send catalogues and individual products straight to customers over WhatsApp, Instagram, or any channel.' },
  { Icon: ShoppingBag, title: 'Order on their behalf', body: 'Place orders for your customers directly through your portal at your agent price.' },
  { Icon: Bell, title: 'Real-time notifications', body: 'Get notified the moment an order you placed is confirmed, shipped, or delivered.' },
]

function PortalSection() {
  return (
    <section className="py-14 lg:py-20 bg-surface border-y border-border-warm">
      <div className="max-w-7xl mx-auto px-6 lg:px-16">
        <div className="max-w-[600px] mb-10">
          <div className="inline-flex items-center gap-2 mb-4">
            <span className="w-8 h-px bg-accent flex-shrink-0" />
            <p className="font-public-sans text-[11px] font-[700] text-accent uppercase tracking-[0.12em]">
              Agent portal
            </p>
          </div>
          <h2 className="font-playfair text-[34px] sm:text-[44px] font-[500] text-primary leading-[1.1]">
            Everything you need to run your reselling business
          </h2>
          <p className="font-public-sans text-[15px] text-muted-text mt-4 leading-[1.7]">
            Your agent portal is a fully-featured business dashboard — not just a
            product catalogue.
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
              <h3 className="font-public-sans text-[14px] font-[600] text-primary leading-[1.35]">
                {title}
              </h3>
              <p className="font-public-sans text-[13px] text-muted-text leading-[1.65]">
                {body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Agent stories ─────────────────────────────────────────────────────────────

const TESTIMONIALS = [
  {
    quote: "I build a new PDF catalogue every month and send it straight to my customer list on WhatsApp. Orders come in within hours and Solomon Bharat handles the rest.",
    name: 'Meera Iyer',
    brand: 'Independent Reseller · Bengaluru',
    avatar: 'MI',
  },
  {
    quote: "The agent pricing gives me enough room to build a real margin, and I never have to hold stock or manage shipping — I just place the order once my customer confirms.",
    name: 'Daniyal Ahmed',
    brand: 'Independent Reseller · Lucknow',
    avatar: 'DA',
  },
  {
    quote: "My customers love browsing a curated catalogue instead of a huge marketplace. Sharing it on Instagram Stories alone has doubled my repeat orders.",
    name: 'Fatima Sheikh',
    brand: 'Independent Reseller · Hyderabad',
    avatar: 'FS',
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
            <p className="font-public-sans text-[11px] font-[700] text-accent uppercase tracking-[0.12em]">
              Agent stories
            </p>
          </div>
          <h2 className="font-playfair text-[34px] sm:text-[44px] font-[500] text-primary leading-[1.1]">
            Resellers building a business with us
          </h2>
        </div>

        <div className="grid sm:grid-cols-3 gap-6">
          {TESTIMONIALS.map(({ quote, name, brand, avatar }) => (
            <div
              key={name}
              className="group relative bg-surface border border-border-warm rounded-2xl p-7 flex flex-col gap-5 overflow-hidden hover:shadow-xl hover:shadow-black/6 hover:-translate-y-1 hover:border-accent/20 transition-all duration-300"
            >
              {/* Decorative quote mark */}
              <span className="absolute top-3 right-5 font-playfair text-[90px] leading-none text-accent/[0.07] select-none pointer-events-none group-hover:text-accent/[0.12] transition-colors duration-300">
                &ldquo;
              </span>

              <div className="flex gap-0.5">
                {Array.from({ length: 5 }, (_, i) => (
                  <Star key={i} size={13} fill="#A68B67" stroke="none" aria-hidden />
                ))}
              </div>
              <blockquote className="font-public-sans text-[14px] text-muted-text leading-[1.75] flex-1 relative z-10">
                &ldquo;{quote}&rdquo;
              </blockquote>
              <div className="flex items-center gap-3 pt-4 border-t border-border-warm">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-accent/20 to-accent/5 border border-accent/25 flex items-center justify-center flex-shrink-0">
                  <span className="font-public-sans text-[12px] font-[700] text-accent">{avatar}</span>
                </div>
                <div>
                  <p className="font-public-sans text-[13px] font-[600] text-primary">{name}</p>
                  <p className="font-public-sans text-[11px] text-muted-text">{brand}</p>
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
  { value: '7K+',   label: 'Instagram community' },
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
                <p className="font-playfair text-[20px] font-[500] text-white leading-tight">Pranjal S Agrawal</p>
                <p className="font-public-sans text-[12px] text-white/70">Founder · Solomon Bharat</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-5">
              {FOUNDER_STATS.map(({ value, label }) => (
                <div key={label} className="bg-bg border border-border-warm rounded-xl p-5">
                  <p className="font-playfair text-[26px] font-[500] text-primary leading-none">{value}</p>
                  <p className="font-public-sans text-[12px] text-muted-text mt-1.5 leading-snug">{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Right: copy */}
          <div>
            <div className="inline-flex items-center gap-2 mb-4">
              <span className="w-8 h-px bg-accent flex-shrink-0" />
              <p className="font-public-sans text-[11px] font-[700] text-accent uppercase tracking-[0.12em]">
                The man behind it
              </p>
            </div>
            <h2 className="font-playfair text-[30px] sm:text-[38px] font-[600] text-primary leading-[1.15] mb-5">
              Built by someone who has{' '}
              <span className="text-accent italic">actually exported</span>.
            </h2>
            <p className="font-public-sans text-[15px] text-muted-text leading-[1.75] mb-6">
              Solomon Bharat is led by <strong className="text-primary font-[600]">Pranjal S Agrawal</strong> — a
              content creator, exporter and mentor who has spent the last few years helping
              Indian founders take their craft to the world.
            </p>

            <div className="flex flex-col gap-3 mb-8">
              {FOUNDER_HIGHLIGHTS.map((text) => (
                <div key={text} className="flex items-start gap-2">
                  <ChevronRight size={14} className="text-accent flex-shrink-0 mt-[3px]" aria-hidden />
                  <span className="font-public-sans text-[14px] text-primary/80 leading-[1.6]">{text}</span>
                </div>
              ))}
            </div>

            <a
              href="https://instagram.com/pranjalsagrawal"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-accent text-white font-[600] font-public-sans text-[13px] px-5 py-2.5 hover:bg-accent-hover transition-colors mb-8"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                <circle cx="12" cy="12" r="5" />
                <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
              </svg>
              Follow @pranjalsagrawal
            </a>

            <div className="bg-bg border border-border-warm rounded-xl p-6">
              <p className="font-playfair text-[17px] italic text-primary leading-[1.5]">
                &ldquo;Now I&apos;m taking Indian businesses global — at scale.&rdquo;
              </p>
              <p className="font-public-sans text-[13px] text-muted-text mt-3">— Pranjal S Agrawal</p>
            </div>
          </div>

        </div>
      </div>
    </section>
  )
}

// ─── Who can apply ─────────────────────────────────────────────────────────────

const REQUIREMENTS = [
  { Icon: BadgeCheck, label: 'Any background', detail: 'No prior reselling experience required' },
  { Icon: Users, label: 'A customer base', detail: 'Friends, family, followers, or a local network to sell to' },
  { Icon: Clock, label: 'A little time', detail: 'Enough to curate catalogues and follow up on orders' },
  { Icon: Award, label: 'Genuine intent', detail: 'Committed to representing the catalogue honestly' },
]

function RequirementsSection() {
  return (
    <section className="py-14 lg:py-20 bg-surface border-y border-border-warm">
      <div className="max-w-7xl mx-auto px-6 lg:px-16">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          <div>
            <div className="inline-flex items-center gap-2 mb-4">
              <span className="w-8 h-px bg-accent flex-shrink-0" />
              <p className="font-public-sans text-[11px] font-[700] text-accent uppercase tracking-[0.12em]">
                Who can apply
              </p>
            </div>
            <h2 className="font-playfair text-[34px] sm:text-[44px] font-[500] text-primary leading-[1.1] mb-5">
              Anyone with a customer base can become an agent
            </h2>
            <p className="font-public-sans text-[15px] text-muted-text leading-[1.7]">
              The Solomon Bharat agent programme is designed for independent resellers — no
              storefront, no inventory, and no prior experience required. If you have people to
              sell to, we give you the catalogue, the pricing, and the fulfilment.
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
                <p className="font-public-sans text-[14px] font-[600] text-primary">{label}</p>
                <p className="font-public-sans text-[12.5px] text-muted-text leading-[1.5]">{detail}</p>
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
    q: 'How long does approval take?',
    a: 'Our team manually reviews every application within 24–48 business hours. You\'ll receive an email confirming whether your application is approved.',
  },
  {
    q: 'Are there any fees to join?',
    a: 'No. There are no listing fees, no monthly subscriptions, and no setup costs, and we never take a commission out of the margin you build in.',
  },
  {
    q: 'How do I earn as an agent?',
    a: 'Every product carries a special agent price visible only to you. You decide what to charge your customer — the difference between the agent price and what you charge is yours to keep.',
  },
  {
    q: 'Do I need to hold inventory or ship anything myself?',
    a: 'No. Once you place an order on behalf of a customer, Solomon Bharat handles sourcing, fulfilment, and shipping — you never touch stock or manage logistics.',
  },
  {
    q: 'How do I share products with customers?',
    a: 'Use your agent portal to build a PDF catalogue from any selection of products, then share it — or individual product links — over WhatsApp, Instagram, or any channel you like.',
  },
  {
    q: 'What do I need to apply?',
    a: 'Just your business name, a contact name, email, phone number, business address, and country. No documents are required to submit an application.',
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
            <p className="font-public-sans text-[11px] font-[700] text-accent uppercase tracking-[0.12em]">FAQ</p>
            <span className="w-10 h-px bg-accent" />
          </div>
          <h2 className="font-playfair text-[34px] sm:text-[44px] font-[500] text-primary leading-[1.1]">
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
                <span className="font-public-sans text-[15px] font-[600] text-primary leading-[1.4] group-hover:text-accent transition-colors duration-200">
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
                <p className="font-public-sans text-[14px] text-muted-text leading-[1.75] pb-6 pr-10">
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
          <span className="font-public-sans text-[11px] font-[600] text-accent uppercase tracking-[0.1em]">
            Free to join · No contracts
          </span>
        </div>

        <h2 className="font-playfair text-[38px] sm:text-[50px] font-[600] text-primary leading-[1.05] mb-5">
          Ready to start<br />
          <span className="text-accent">reselling?</span>
        </h2>
        <p className="font-public-sans text-[15px] text-muted-text leading-[1.75] max-w-[480px] mx-auto mb-10">
          Join the Solomon Bharat agent programme, browse the catalogue at your special agent
          price, and start building customer catalogues today. Apply in 10 minutes.
        </p>

        <Link
          href="/apply-agent"
          className="inline-flex items-center gap-2 rounded bg-primary text-white font-[600] font-public-sans text-[14px] px-8 py-3.5 hover:bg-[#2a2a2a] transition-colors"
        >
          Apply now — it&apos;s free
          <ArrowRight size={14} aria-hidden />
        </Link>

        <p className="mt-6 font-public-sans text-[13px] text-muted-text">
          Already have an account?{' '}
          <button
            type="button"
            onClick={() => openAuthModal('login')}
            className="text-primary font-[600] underline underline-offset-2 hover:text-accent transition-colors"
          >
            Log in
          </button>
        </p>
      </div>
    </section>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BecomeAgentPage() {
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
