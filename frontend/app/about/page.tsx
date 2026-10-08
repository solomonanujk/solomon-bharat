import Image from 'next/image'
import Link from 'next/link'
import { NavBar } from '@/components/shared/NavBar'
import { Footer } from '@/components/shared/Footer'
import { Button } from '@/components/ui/button'

// Illustrative photo — reused from the homepage retailer section. Swap for a
// real Solomon Bharat photo when one is available.
const ABOUT_PHOTO =
  'https://res.cloudinary.com/dxnqyvcdl/image/upload/v1788845176/homepage/1788845110281-retailer-storefront.png'

// CONFIRM: each value statement below restates an AGENTS.md business rule
// (Solomon Bharat is the merchant of record; every product is reviewed and
// priced by our team before publishing; collections are curated in-house).
// Owner to confirm the public wording.
const VALUES = [
  {
    title: 'One merchant, one contract',
    body: 'When you place an order, your contract is with Solomon Bharat. We buy from our Indian suppliers and sell to you, so you deal with one business from order to delivery.',
  },
  {
    title: 'Every product is reviewed',
    body: 'Nothing appears in the catalogue until our team has reviewed it and set its wholesale price. Products that need changes go back to the supplier before they are published.',
  },
  {
    title: 'Curated, not crowded',
    body: 'Our team groups the catalogue into categories and editorial collections, so you can browse a focused range instead of an endless list.',
  },
]

// CONFIRM: process steps follow the order flow in AGENTS.md (supplier
// submission → admin approval and pricing → buyer order → procurement).
const STEPS = [
  {
    title: 'Suppliers apply and submit products',
    body: 'Indian makers and suppliers apply to work with us, then submit products with photos and details through their seller portal.',
  },
  {
    title: 'We review and price each product',
    body: 'Our team checks every submission and sets the wholesale price before the product is published to the catalogue.',
  },
  {
    title: 'You order from Solomon Bharat',
    body: 'You browse, order and pay Solomon Bharat directly. Once your order is placed, we procure it from the supplier.',
  },
]

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-ivory flex flex-col">
      <NavBar />

      <main className="flex-1">
        {/* ─── Intro ─────────────────────────────────────────────────────── */}
        <section className="bg-ivory sb-section">
          <div className="sb-container grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-14 items-center">
            <div className="max-w-[560px]">
              <p className="type-eyebrow text-brass-dark">About us</p>
              <h1 className="type-h1 text-ink mt-3">About Solomon Bharat</h1>
              <p className="type-body text-muted mt-6">
                Solomon Bharat connects India&apos;s finest artisan goods with wholesale buyers around the world.
                We work directly with verified Indian suppliers to bring a curated, export-ready catalog to
                international retailers.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <Button asChild variant="primary" size="lg" className="w-full sm:w-auto">
                  <Link href="/collections">Browse products</Link>
                </Button>
                <Button asChild variant="secondary" size="lg" className="w-full sm:w-auto">
                  <Link href="/sell">Apply as a seller</Link>
                </Button>
              </div>
            </div>

            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[6px] border border-line bg-white">
              <Image
                src={ABOUT_PHOTO}
                alt="Illustrative retail storefront displaying handmade Indian homeware"
                fill
                sizes="(min-width: 1024px) 50vw, 100vw"
                className="object-cover"
                priority
              />
            </div>
          </div>
        </section>

        {/* ─── Values band ───────────────────────────────────────────────── */}
        <section className="on-forest bg-forest sb-section">
          <div className="sb-container">
            <p className="type-eyebrow text-brass">What we stand for</p>
            <h2 className="type-h2 text-white mt-3 max-w-[700px]">How we work with buyers and makers</h2>
            <div className="mt-6 lg:mt-8 grid grid-cols-1 md:grid-cols-3 gap-8">
              {VALUES.map(({ title, body }) => (
                <div key={title} className="border-t border-white/20 pt-6">
                  <h3 className="type-h3 text-white">{title}</h3>
                  <p className="type-body text-light-text mt-3">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── Process ───────────────────────────────────────────────────── */}
        <section className="bg-ivory sb-section">
          <div className="sb-container">
            <p className="type-eyebrow text-brass-dark">How it works</p>
            <h2 className="type-h2 text-ink mt-3 max-w-[700px]">From the maker&apos;s workshop to your shelves</h2>
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
      </main>

      <Footer />
    </div>
  )
}
