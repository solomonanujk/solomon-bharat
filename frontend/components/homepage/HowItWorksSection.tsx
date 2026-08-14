import Link from 'next/link'
import { LayoutGrid, ShoppingCart, PackageCheck, ArrowRight } from 'lucide-react'

const STEPS = [
  {
    number: '01',
    Icon: LayoutGrid,
    heading: 'Browse Categories & Collections',
    description:
      'Explore Solomon Bharat\'s curated catalog of Indian artisan goods, organized by category or discover editorial collections built around themes and seasons.',
  },
  {
    number: '02',
    Icon: ShoppingCart,
    heading: 'Add to Cart & Checkout',
    description:
      'Add products to your cart at the listed price and MOQ. Check out securely with PayPal — Solomon Bharat is your merchant of record on every order.',
  },
  {
    number: '03',
    Icon: PackageCheck,
    heading: 'Track & Receive Your Order',
    description:
      'Follow your order status from your account, with tracking and export documentation provided as your order ships.',
  },
]

export function HowItWorksSection() {
  return (
    <section className="py-16 lg:py-24 bg-surface">
      <div className="max-w-7xl mx-auto px-6 lg:px-16">
        <div className="flex flex-col lg:flex-row">

          {/* Header panel */}
          <div className="lg:w-[300px] xl:w-[340px] flex-shrink-0 lg:pr-12 pb-12 lg:pb-0 flex flex-col justify-between">
            <div>
              <p className="font-public-sans text-[12px] font-[600] text-accent uppercase tracking-[0.08em] mb-4">
                Simple Process
              </p>
              <h2 className="font-playfair font-[500] text-primary leading-[1.15] text-[28px] lg:text-[36px]">
                From Discovery<br /> to Delivery in<br /> Three Steps
              </h2>
            </div>
            <Link
              href="/categories"
              className="hidden lg:inline-flex items-center gap-1.5 font-public-sans text-[13px] font-[600] text-primary hover:text-accent transition-colors mt-10"
            >
              Start browsing <ArrowRight size={13} aria-hidden="true" />
            </Link>
          </div>

          {/* Steps */}
          {STEPS.map(({ number, Icon, heading, description }) => (
            <div
              key={number}
              className="flex-1 border-t lg:border-t-0 lg:border-l border-border-warm pt-10 lg:pt-0 lg:pl-10 xl:pl-12 pb-10 lg:pb-0 last:pb-0"
            >
              {/* Step number */}
              <span className="font-playfair text-[52px] lg:text-[64px] font-[500] leading-none text-primary/[0.08] select-none block mb-3">
                {number}
              </span>

              {/* Icon badge */}
              <div className="w-11 h-11 rounded bg-accent/10 flex items-center justify-center text-accent flex-shrink-0 mb-6">
                <Icon size={19} aria-hidden="true" />
              </div>

              <h3 className="font-playfair font-[500] text-[19px] text-primary mb-3 leading-snug">
                {heading}
              </h3>
              <p className="font-public-sans text-[13px] font-[400] leading-[1.8] text-muted-text">
                {description}
              </p>
            </div>
          ))}

        </div>
      </div>
    </section>
  )
}
