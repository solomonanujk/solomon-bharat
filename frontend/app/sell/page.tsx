'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { ChevronDown, ChevronRight, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { NavBar } from '@/components/shared/NavBar'
import { Footer } from '@/components/shared/Footer'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/lib/store/useAuthStore'

// The seller application itself lives at /apply (multi-step wizard). Every
// "Apply as a seller" CTA on this page links there.
const APPLY_HREF = '/apply'

// ─── Owner-confirmation constants ──────────────────────────────────────────────
// CONFIRM: country count shown in the hero and the countries list.
const COUNTRY_COUNT_LABEL = '40+'
// CONFIRM: application review turnaround (also stated in /apply).
const REVIEW_TIME_LABEL = '24–48 hours'
// CONFIRM: "free to apply / no listing fees" fee claim. The application form
// (components/apply/Step4FinalDetails.tsx) states a commission on orders, so
// this page no longer says "no commission" — only that applying and listing are free.
const FEE_LABEL = 'Free to apply and list'
// CONFIRM: payout timing after dispatch.
const PAYOUT_TIMING = 'within 15 days'
// CONFIRM: hide seller testimonials until real, permissioned quotes exist.
const SHOW_SELLER_TESTIMONIALS = false

// ─── Hero ─────────────────────────────────────────────────────────────────────

const HERO_FACTS = [
  { value: 'Selective', label: 'Not open to everyone' },
  { value: COUNTRY_COUNT_LABEL, label: 'Countries we sell to' }, // CONFIRM: country count
  { value: REVIEW_TIME_LABEL, label: 'Application review' }, // CONFIRM: review time
  { value: '₹0', label: 'To list and apply' }, // CONFIRM: fee claim
]

function Hero() {
  return (
    <section className="on-forest bg-forest py-12 lg:py-20">
      <div className="sb-container grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-14 items-center">
        <div className="max-w-[560px]">
          <p className="type-eyebrow text-brass">Sell on Solomon Bharat</p>
          <h1 className="type-hero text-white mt-4">
            Your craft. <span className="text-brass">Their shelves.</span>
          </h1>
          <p className="type-hero-body text-light-text mt-6">
            We help you sell your handmade products to wholesale buyers in {COUNTRY_COUNT_LABEL} countries. You make
            the product and set your price — we handle the buyers, the payments, and the international paperwork.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <Button asChild variant="onForestIvory" size="lg" className="w-full sm:w-auto">
              <Link href={APPLY_HREF}>Apply as a seller</Link>
            </Button>
            <Button asChild variant="outlineOnForest" size="lg" className="w-full sm:w-auto">
              <a href="#how-it-works">How it works</a>
            </Button>
          </div>

          <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-white/20 pt-6">
            {HERO_FACTS.map(({ value, label }) => (
              <div key={label}>
                <dt className="type-caption text-light-text">{label}</dt>
                <dd className="font-sans text-[16px] leading-[24px] font-[600] text-white">{value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="relative aspect-[4/3] lg:aspect-square w-full overflow-hidden rounded-[6px]">
          <Image
            src="https://res.cloudinary.com/dxnqyvcdl/image/upload/v1783429597/Gemini_Generated_Image_56ug4l56ug4l56ug_hvg3kn.png"
            alt="Illustrative scene of an Indian artisan crafting handmade products"
            fill
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="object-cover"
            priority
          />
        </div>
      </div>
    </section>
  )
}

// ─── Countries ────────────────────────────────────────────────────────────────

// CONFIRM: list of buyer countries.
const COUNTRIES = [
  'United Kingdom', 'United States', 'Germany', 'France', 'Netherlands',
  'Australia', 'Canada', 'UAE', 'Singapore', 'Italy', 'Spain', 'Sweden',
  'Denmark', 'Norway', 'Belgium', 'Switzerland', 'Japan', 'New Zealand',
]

function CountriesStrip() {
  return (
    <section className="bg-white border-b border-line py-8">
      <div className="sb-container">
        <p className="type-eyebrow text-brass-deep">Reaching buyers in</p>
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
          {COUNTRIES.map((country) => (
            <li key={country} className="font-sans text-[14px] leading-[20px] text-ink">
              {country}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

// ─── Process ──────────────────────────────────────────────────────────────────

const STEPS = [
  {
    title: 'Apply — takes about 10 minutes',
    body: 'Fill in your brand name, what you make, and your contact details. No documents upfront, no fees to apply.', // CONFIRM: fee claim
  },
  {
    title: 'We review your application',
    // CONFIRM: review time
    body: `A real person on our team looks at every application. We'll email you a decision within ${REVIEW_TIME_LABEL}.`,
  },
  {
    title: 'Add products, ship orders',
    // CONFIRM: payout timing
    body: `Once approved, submit products in your seller portal — each one is reviewed before it goes live. When orders come in, you ship them, mark them dispatched, and we process your payment ${PAYOUT_TIMING}.`,
  },
]

function ProcessBand() {
  return (
    <section id="how-it-works" className="bg-ivory sb-section scroll-mt-24">
      <div className="sb-container">
        <p className="type-eyebrow text-brass-dark">How it works</p>
        <h2 className="type-h2 text-ink mt-3 max-w-[700px]">What happens after you apply</h2>
        <ol className="mt-6 lg:mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          {STEPS.map(({ title, body }, i) => (
            <li key={title} className="bg-white border border-line rounded-[6px] p-6">
              <span className="type-step-number text-brass-dark block" aria-hidden="true">
                {String(i + 1).padStart(2, '0')}
              </span>
              <h3 className="type-h3 text-ink mt-4">
                <span className="sr-only">Step {i + 1}: </span>
                {title}
              </h3>
              <p className="type-body text-muted mt-3">{body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

// ─── Why Solomon Bharat ───────────────────────────────────────────────────────

const WHY_ITEMS = [
  {
    title: 'We find the buyers — you don\'t have to',
    // CONFIRM: country count / regions
    body: 'Solomon Bharat sells to wholesale buyers in the US, UK, Europe, Australia, UAE, and 35+ more countries. You never cold-pitch a retailer or chase an international lead.',
  },
  {
    title: 'You name your price',
    body: 'Set the price you want when you submit a product. If it\'s approved and someone orders it, we pay you that price for every unit ordered.',
  },
  {
    title: 'We\'re the ones selling internationally — not you',
    body: 'Solomon Bharat buys from you and sells to buyers under its own name. You don\'t deal with foreign invoices, customs paperwork, or chasing payment from an overseas retailer.',
  },
  {
    title: 'The application is short — no documents needed',
    body: 'Just your business details, contact details, and a description of what you make. We don\'t ask for GST certificates or export docs just to apply.',
  },
  {
    title: 'One place for your products, orders, and payouts',
    body: 'Submit products, see where each one is in the review process, and track your orders and payments — all from your seller dashboard.',
  },
  {
    title: 'You\'ll know when something happens',
    body: 'We notify you when a product is approved or rejected, and when an order comes in.',
  },
]

function WhySection() {
  return (
    <section className="bg-white sb-section">
      <div className="sb-container">
        <div className="max-w-[660px]">
          <p className="type-eyebrow text-brass-deep">Why Solomon Bharat</p>
          <h2 className="type-h2 text-ink mt-3">Built around how Indian brands actually work</h2>
          <p className="type-body text-muted mt-4">
            Most export platforms were built for large manufacturers. We built this for smaller Indian brands — the
            ones doing the actual craft work, not just the packaging.
          </p>
        </div>

        <div className="mt-6 lg:mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {WHY_ITEMS.map(({ title, body }) => (
            <div key={title} className="border border-line rounded-[6px] p-6 bg-white">
              <h3 className="font-sans text-[16px] leading-[24px] font-[600] text-ink">{title}</h3>
              <p className="type-body text-muted mt-3">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── How you get paid ─────────────────────────────────────────────────────────

// CONFIRM: fee claims in this list.
const PRICING_POINTS = [
  FEE_LABEL,
  'You set your price per product — no bidding, no negotiation',
  'We pay you your price for every unit ordered',
  'We handle the buyer, the invoice, and the international transfer',
]

function PricingSection() {
  return (
    <section className="bg-ivory sb-section">
      <div className="sb-container">
        <div className="max-w-[660px]">
          <p className="type-eyebrow text-brass-dark">How you get paid</p>
          <h2 className="type-h2 text-ink mt-3">You set the price. We pay it.</h2>
          {/* CONFIRM: fee claim — "no listing fees, no subscriptions". Commission
              terms are presented in step 4 of the application. */}
          <p className="type-body text-muted mt-4">
            There are no listing fees and no subscriptions. When you submit a product, you tell us what you want for it.
            If someone orders it, we pay you that amount — the international pricing is ours to manage, not yours to
            negotiate. Commission terms are set out in the application before you submit.
          </p>
          <ul className="mt-6 flex flex-col gap-3">
            {PRICING_POINTS.map((text) => (
              <li key={text} className="flex items-start gap-3">
                <CheckCircle2 size={18} className="text-forest flex-shrink-0 mt-[3px]" aria-hidden="true" />
                <span className="type-body text-ink">{text}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

// ─── Seller portal features ───────────────────────────────────────────────────

const PORTAL_FEATURES = [
  { title: 'Submit products', body: 'Add photos, pricing, and product details. We review each submission before it goes live on the platform.' },
  { title: 'See where each product stands', body: 'Pending, approved, or needs changes — you\'ll see the status for every submission, with a reason if something was rejected.' },
  { title: 'Notifications that matter', body: 'We tell you when a product gets approved, when something needs a fix, and when an order comes in for your products.' },
  { title: 'Orders and payout history', body: 'Every order for your products is listed here, along with your payout history as payments are processed.' },
]

function PortalSection() {
  return (
    <section className="bg-white sb-section">
      <div className="sb-container">
        <div className="max-w-[660px]">
          <p className="type-eyebrow text-brass-deep">Seller portal</p>
          <h2 className="type-h2 text-ink mt-3">Your seller portal isn&apos;t just for uploading products</h2>
          <p className="type-body text-muted mt-4">
            It&apos;s where you run the whole thing — submissions, approvals, orders, and payments, in one place.
          </p>
        </div>

        <div className="mt-6 lg:mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {PORTAL_FEATURES.map(({ title, body }) => (
            <div key={title} className="border border-line rounded-[6px] p-6 bg-white">
              <h3 className="font-sans text-[16px] leading-[24px] font-[600] text-ink">{title}</h3>
              <p className="type-body text-muted mt-3">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Seller testimonials (hidden until real) ──────────────────────────────────

// CONFIRM: these quotes must be real and permissioned before
// SHOW_SELLER_TESTIMONIALS is turned on.
const TESTIMONIALS = [
  {
    quote: "I honestly didn't expect the first order to come this quickly. Three months after applying, we had buyers reordering from the UK and Australia. I just had to ship.",
    name: 'Priya Mehta',
    brand: 'Indigo Root Textiles · Jaipur',
  },
  {
    quote: 'I run this by myself and international paperwork was always the thing stopping me. The application was straightforward and the portal is simple enough that I figured it out on my own.',
    name: 'Rajan Nair',
    brand: 'Canework & Clay · Thrissur',
  },
  {
    quote: 'A buyer in France placed a large order and kept reordering. We never spoke to them directly — Solomon Bharat managed all of that.',
    name: 'Anika Sharma',
    brand: 'Bagh Print House · Bhopal',
  },
]

function Testimonials() {
  if (!SHOW_SELLER_TESTIMONIALS) return null
  return (
    <section className="bg-review-ground sb-section">
      <div className="sb-container">
        <p className="type-eyebrow text-brass-dark">Seller stories</p>
        <h2 className="type-h2 text-ink mt-3">From the sellers already on the platform</h2>
        <div className="mt-6 lg:mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {TESTIMONIALS.map(({ quote, name, brand }) => (
            <figure key={name} className="bg-white border border-line rounded-[6px] p-6 flex flex-col gap-4">
              <blockquote className="type-body text-ink flex-1">&ldquo;{quote}&rdquo;</blockquote>
              <figcaption className="border-t border-line pt-4">
                <p className="font-sans text-[14px] leading-[20px] font-[600] text-ink">{name}</p>
                <p className="type-caption text-muted">{brand}</p>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── The person behind it ─────────────────────────────────────────────────────

// CONFIRM: every founder stat and highlight below. Note the bio paragraph
// previously said "over 7,000 people" while the stat said 16K+ — reconcile.
const FOUNDER_STATS = [
  { value: '16K+', label: 'Instagram community' },
  { value: '300+', label: 'Brands launched across 20+ countries' },
  { value: '₹7.5L', label: 'Grants raised for Solomon Bharat' },
  { value: '5', label: 'Countries personally exported to' },
]

const FOUNDER_HIGHLIGHTS = [
  "Mentor at Tetr College of Business & Masters' Union",
  "Incubated at Masters' Union",
  "Backed by Ashish Singhal (Founder, CoinSwitch) & Masters' Union",
  'Previously exported to UK, Australia, Canada, Bangkok & Qatar',
]

function FounderSection() {
  return (
    <section className="bg-ivory sb-section">
      <div className="sb-container grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-14 items-start">
        <div className="order-2 lg:order-1">
          <div className="relative aspect-[4/5] sm:aspect-[16/11] w-full overflow-hidden rounded-[6px] border border-line bg-white">
            <Image
              src="https://res.cloudinary.com/dxnqyvcdl/image/upload/v1784015077/founder-pranjal_u57boj.jpg"
              alt="Pranjal S Agrawal, Founder of Solomon Bharat"
              fill
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-cover"
            />
          </div>
          <dl className="grid grid-cols-2 gap-4 mt-6">
            {FOUNDER_STATS.map(({ value, label }) => (
              <div key={label} className="bg-white border border-line rounded-[6px] p-4 flex flex-col-reverse gap-1">
                <dt className="type-caption text-muted">{label}</dt>
                <dd className="font-display text-[24px] leading-[30px] font-[500] text-ink">{value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="order-1 lg:order-2 max-w-[560px]">
          <p className="type-eyebrow text-brass-dark">The person behind it</p>
          <h2 className="type-h2 text-ink mt-3">This was built by someone who has actually done this.</h2>
          <p className="type-body text-muted mt-4">
            <strong className="text-ink font-[600]">Pranjal S Agrawal</strong> started Solomon Bharat after years of
            personally exporting Indian goods and watching other brands struggle to find international buyers without a
            middleman. He&apos;s also a mentor, a content creator, and someone who&apos;s shipped to five countries
            himself.
          </p>

          <ul className="mt-6 flex flex-col gap-3">
            {FOUNDER_HIGHLIGHTS.map((text) => (
              <li key={text} className="flex items-start gap-2">
                <ChevronRight size={16} className="text-brass-dark flex-shrink-0 mt-[4px]" aria-hidden="true" />
                <span className="type-body text-ink">{text}</span>
              </li>
            ))}
          </ul>

          <p className="mt-6 type-body text-ink">
            <a
              href="https://instagram.com/pranjalsagrawal"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center font-[600] text-forest underline underline-offset-4 hover:text-forest-hover transition-colors"
            >
              Follow @pranjalsagrawal on Instagram
            </a>
          </p>

          <blockquote className="mt-6 bg-white border border-line rounded-[6px] p-6">
            <p className="font-display text-[18px] leading-[27px] text-ink">
              &ldquo;I&apos;ve done this myself. I know what the paperwork looks like, what it takes to find a real
              buyer, and what Indian makers actually need. That&apos;s what I built this for.&rdquo;
            </p>
            <footer className="type-caption text-muted mt-3">— Pranjal S Agrawal</footer>
          </blockquote>
        </div>
      </div>
    </section>
  )
}

// ─── Requirements ─────────────────────────────────────────────────────────────

const REQUIREMENTS = [
  { label: 'India-based', detail: 'Your products must be made or sourced in India' },
  { label: 'At least 10 wholesale styles', detail: 'We look for brands that have a real range to offer, not just one or two items' },
  { label: 'You can actually fulfil orders', detail: 'You need to be able to ship within the lead times you quote — buyers depend on it' },
  { label: 'Craft or design-led products', detail: 'Handmade, artisanal, or thoughtfully designed — not mass-produced generic goods' },
]

function RequirementsSection() {
  return (
    <section className="bg-white sb-section">
      <div className="sb-container grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-14 items-center">
        <div className="max-w-[560px]">
          <p className="type-eyebrow text-brass-deep">Who can apply</p>
          <h2 className="type-h2 text-ink mt-3">We&apos;re not looking for the biggest brands</h2>
          <p className="type-body text-muted mt-4">
            Most of our sellers are small independent makers. You don&apos;t need an export history or an
            import-export code to apply. You just need a genuine product and the ability to ship it reliably.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {REQUIREMENTS.map(({ label, detail }) => (
            <div key={label} className="border border-line rounded-[6px] p-6 bg-white">
              <p className="font-sans text-[16px] leading-[24px] font-[600] text-ink">{label}</p>
              <p className="font-sans text-[14px] leading-[20px] text-muted mt-2">{detail}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── FAQ ─────────────────────────────────────────────────────────────────────

const FAQS = [
  {
    q: 'How long does the review take?',
    // CONFIRM: review time
    a: `We look at every application ourselves — it's not automated. You'll get an email with a decision within ${REVIEW_TIME_LABEL} on business days.`,
  },
  {
    q: 'Is there any cost to join?',
    // CONFIRM: fee claim. Commission figures live in the application (step 4).
    a: 'Applying is free and listing is free. Commission terms are shown in the application, and you agree to them before you submit.',
  },
  {
    q: 'How does pricing work?',
    a: 'When you submit a product, you set the price you want to receive for it. If we approve it and an order comes in, we pay you that amount. We set the price buyers pay on our side when we sell internationally.',
  },
  {
    q: 'Do I have to talk to the buyers myself?',
    a: 'No. Solomon Bharat is the seller on record internationally. You never deal with a foreign buyer directly — no invoicing, no customs back-and-forth, no chasing payment from someone overseas.',
  },
  {
    q: 'Can I sell on other platforms at the same time?',
    // CONFIRM: non-exclusivity
    a: 'Yes. We don\'t ask for exclusivity. Sell through your own site, on Etsy, through other platforms — it\'s your business.',
  },
  {
    q: 'What do I need to apply?',
    a: 'Your business details, what you make, contact details, and your Instagram handle. We don\'t ask for GST certificates or IEC codes just to get started.',
  },
]

function FAQ() {
  const [open, setOpen] = useState<number | null>(null)

  return (
    <section className="bg-ivory sb-section">
      <div className="sb-container">
        <div className="max-w-[760px] mx-auto">
          <p className="type-eyebrow text-brass-dark">FAQ</p>
          <h2 className="type-h2 text-ink mt-3">Common questions</h2>

          <div className="mt-6 lg:mt-8 border-y border-line divide-y divide-line">
            {FAQS.map(({ q, a }, i) => {
              const isOpen = open === i
              const panelId = `sell-faq-panel-${i}`
              return (
                <div key={q}>
                  <h3>
                    <button
                      type="button"
                      onClick={() => setOpen(isOpen ? null : i)}
                      aria-expanded={isOpen}
                      aria-controls={panelId}
                      className="w-full min-h-11 flex items-center justify-between gap-4 py-4 text-left font-sans text-[16px] leading-[24px] font-[600] text-ink hover:text-forest transition-colors"
                    >
                      {q}
                      <ChevronDown
                        size={18}
                        className={cn('flex-shrink-0 text-muted', isOpen && 'rotate-180')}
                        aria-hidden="true"
                      />
                    </button>
                  </h3>
                  <div id={panelId} hidden={!isOpen} className="pb-6 pr-8">
                    <p className="type-body text-muted">{a}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Application ──────────────────────────────────────────────────────────────

function ApplicationSection() {
  const openAuthModal = useAuthStore((s) => s.openAuthModal)
  return (
    <section id="apply" className="bg-white sb-section">
      <div className="sb-container grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-14 items-start">
        <div className="max-w-[560px]">
          <p className="type-eyebrow text-brass-deep">Apply</p>
          <h2 className="type-h2 text-ink mt-3">If the product is good, let&apos;s talk.</h2>
          {/* CONFIRM: review time */}
          <p className="type-body text-muted mt-4">
            The application takes about 10 minutes. We review it ourselves, and you&apos;ll hear back by email within{' '}
            {REVIEW_TIME_LABEL}.
          </p>
        </div>

        <div className="border border-line rounded-[6px] p-6 bg-white">
          <h3 className="type-h3 text-ink">What happens when you submit</h3>
          <ul className="mt-4 flex flex-col gap-3">
            {[
              'You tell us about your business, your products, and your export readiness.',
              'Our team reviews your application — an application is an expression of interest, not a guaranteed listing.',
              'We email you our decision. If approved, you get access to the seller portal to submit products.',
            ].map((text) => (
              <li key={text} className="flex items-start gap-3">
                <CheckCircle2 size={18} className="text-forest flex-shrink-0 mt-[3px]" aria-hidden="true" />
                <span className="type-body text-ink">{text}</span>
              </li>
            ))}
          </ul>

          <Button asChild variant="primary" size="lg" className="w-full mt-6">
            <Link href={APPLY_HREF}>Apply as a seller</Link>
          </Button>

          <p className="mt-4 type-caption text-muted text-center">
            Already have an account?{' '}
            <button
              type="button"
              onClick={() => openAuthModal('login')}
              className="inline-flex min-h-11 items-center font-[600] text-forest underline underline-offset-4 hover:text-forest-hover transition-colors"
            >
              Sign in
            </button>
          </p>
        </div>
      </div>
    </section>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SellPage() {
  return (
    <div className="min-h-screen bg-ivory flex flex-col">
      <NavBar />

      <main className="flex-1">
        <Hero />
        <CountriesStrip />
        <ProcessBand />
        <WhySection />
        <PricingSection />
        <PortalSection />
        <Testimonials />
        <FounderSection />
        <RequirementsSection />
        <FAQ />
        <ApplicationSection />
      </main>

      <Footer />
    </div>
  )
}
