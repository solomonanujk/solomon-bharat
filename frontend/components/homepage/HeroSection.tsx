import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, Store, Globe2, LayoutGrid, ShieldCheck } from 'lucide-react'

// ─── Data ─────────────────────────────────────────────────────────────────────

const STATS = [
  { Icon: LayoutGrid,  value: 'Curated',  label: 'Product Catalog'      },
  { Icon: Globe2,      value: '40+',      label: 'Countries Served'     },
  { Icon: ShieldCheck, value: 'Verified', label: 'Indian Suppliers'     },
  { Icon: Store,       value: 'PayPal',   label: 'Secure Payments'      },
]

const TRUST_AVATARS = [
  'https://picsum.photos/seed/buyer-a/40/40',
  'https://picsum.photos/seed/buyer-b/40/40',
  'https://picsum.photos/seed/buyer-c/40/40',
]

// ─── Component ────────────────────────────────────────────────────────────────

export function HeroSection() {
  return (
    <section className="relative overflow-hidden min-h-[580px] h-[90vh]">

      {/* Full-bleed background image — no overlay */}
      <Image
        src="https://res.cloudinary.com/dxnqyvcdl/image/upload/v1781188595/heroSection_lzdtky.png"
        alt="Indian artisan home décor products"
        fill
        sizes="100vw"
        className="object-cover object-right"
        priority
      />

      {/* Left-side fade — stronger on mobile for text readability */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'linear-gradient(to right, rgba(249,247,242,0.95) 0%, rgba(249,247,242,0.80) 55%, rgba(249,247,242,0.30) 75%, rgba(249,247,242,0) 100%)' }}
        aria-hidden="true"
      />

      {/* Content overlaid on the left */}
      <div className="relative z-10 flex items-center h-full absolute inset-0">
        <div className="w-full px-5 sm:px-8 md:px-10 lg:px-16 py-12 sm:py-16 lg:py-20">
          <div className="max-w-[520px]">

            {/* Eyebrow pill */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-border-warm bg-white/60 backdrop-blur-sm mb-7">
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
                <path d="M6.5 1L8.2 5.1H12.5L9.2 7.6L10.4 11.8L6.5 9.3L2.6 11.8L3.8 7.6L0.5 5.1H4.8L6.5 1Z" fill="#A68B67"/>
              </svg>
              <span className="font-public-sans text-[11px] font-[600] text-accent uppercase tracking-[0.1em]">
                B2B Wholesale Marketplace
              </span>
            </div>

            {/* Headline */}
            <h1 className="font-playfair font-[600] text-primary leading-[1.05] tracking-[-0.01em] text-[26px] sm:text-[34px] lg:text-[44px]">
              India&apos;s Finest<br />
              <span className="text-accent">Artisan Goods</span><br />
              Sourced Wholesale
            </h1>

            {/* Body */}
            <p className="font-public-sans text-[14px] sm:text-[15px] font-[400] leading-[1.65] text-muted-text mt-4 sm:mt-6 max-w-[400px]">
              Solomon Bharat curates verified, export-ready goods from across India —
              browse by category or explore our editorial collections.
            </p>

            {/* CTAs */}
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/categories"
                className="inline-flex items-center gap-2 rounded bg-primary text-white font-[600] font-public-sans text-[14px] px-6 py-3 hover:bg-[#2a2a2a] transition-colors"
              >
                Browse Categories
                <ArrowRight size={14} aria-hidden="true" />
              </Link>
              <Link
                href="/collections"
                className="inline-flex items-center gap-2 rounded border border-border-warm bg-white/50 backdrop-blur-sm text-primary font-[600] font-public-sans text-[14px] px-5 py-3 hover:bg-white/80 transition-colors"
              >
                Explore Collections
              </Link>
            </div>

            <Link
              href="/sell"
              className="inline-flex items-center gap-1.5 mt-4 font-public-sans text-[13px] font-[600] text-muted-text hover:text-primary transition-colors"
            >
              <Store size={13} aria-hidden="true" />
              Apply as a Seller
            </Link>

            {/* Stats */}
            <div className="mt-8 sm:mt-10 grid grid-cols-2 sm:flex sm:flex-wrap gap-x-5 gap-y-3 sm:gap-x-6 sm:gap-y-4">
              {STATS.map(({ Icon, value, label }) => (
                <div key={label} className="flex items-center gap-2">
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/70 border border-border-warm flex items-center justify-center flex-shrink-0">
                    <Icon size={13} className="text-accent" aria-hidden="true" />
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

      {/* Floating trust card — hidden on mobile to avoid overlapping content */}
      <div className="hidden sm:flex absolute top-8 left-[52%] lg:left-[50%] bg-white border border-border-warm rounded-lg px-4 py-3 shadow-[0_4px_24px_rgba(26,26,26,0.10)] items-center gap-3 z-10">
        <div className="flex -space-x-1.5 flex-shrink-0">
          {TRUST_AVATARS.map((src, i) => (
            <img
              key={i}
              src={src}
              alt=""
              aria-hidden="true"
              className="w-8 h-8 rounded-full border-2 border-white object-cover"
            />
          ))}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-public-sans text-[13px] font-[600] text-primary leading-tight">Trusted by buyers</p>
          <p className="font-public-sans text-[11px] text-muted-text">from 40+ countries</p>
        </div>
        <Globe2 size={17} className="text-accent flex-shrink-0 ml-2" aria-hidden="true" />
      </div>

    </section>
  )
}
