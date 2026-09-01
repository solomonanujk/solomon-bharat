import Image from 'next/image'
import { Star } from 'lucide-react'

const FEATURED = {
  name: 'Sarah Mitchell',
  company: 'Artisan Home Boutique',
  country: 'United Kingdom',
  avatar: 'https://randomuser.me/api/portraits/women/44.jpg',
  review:
    'Solomon Bharat transformed our sourcing entirely. We found incredible Indian artisan products at factory-direct prices — the quality exceeded expectations and our customers love the authenticity.',
  rating: 5,
}

const OTHERS = [
  {
    name: 'Marco Ferretti',
    company: 'Casa Mediterranea',
    country: 'Italy',
    avatar: 'https://randomuser.me/api/portraits/men/54.jpg',
    review:
      "We've been importing Indian textiles for years, but Solomon Bharat gave us true direct access to manufacturers. MOQs are reasonable and supplier verification gives real confidence.",
    rating: 5,
  },
  {
    name: 'Emily Chen',
    company: 'Jade & Jasmine Imports',
    country: 'United States',
    avatar: 'https://randomuser.me/api/portraits/women/68.jpg',
    review:
      'Finding authentic Indian products at wholesale prices was my biggest sourcing challenge. Solomon Bharat solved that completely — and the platform makes managing global orders easy.',
    rating: 5,
  },
]

function Stars({ count }: { count: number }) {
  return (
    <div className="flex items-center gap-1" aria-label={`${count} out of 5 stars`}>
      {Array.from({ length: count }).map((_, i) => (
        <Star key={i} size={14} className="text-accent fill-accent" aria-hidden="true" />
      ))}
    </div>
  )
}

export function TestimonialsSection() {
  return (
    <section className="py-16 lg:py-24 bg-bg">
      <div className="max-w-7xl mx-auto px-6 lg:px-16">

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-10 lg:gap-16 items-start">

          {/* Featured quote — left */}
          <div>
            <p className="font-public-sans text-[12px] font-[600] text-accent uppercase tracking-[0.08em] mb-8">
              Buyer Reviews
            </p>

            {/* Big decorative quote mark */}
            <div
              className="font-playfair text-[80px] sm:text-[120px] lg:text-[160px] leading-[0.7] text-primary/[0.07] select-none mb-4"
              aria-hidden="true"
            >
              &ldquo;
            </div>

            <Stars count={FEATURED.rating} />

            <blockquote className="font-playfair font-[400] text-[18px] sm:text-[22px] lg:text-[28px] text-primary leading-[1.45] mt-5">
              {FEATURED.review}
            </blockquote>

            <div className="flex items-center gap-3 mt-8">
              <Image
                src={FEATURED.avatar}
                alt={FEATURED.name}
                width={44}
                height={44}
                className="w-11 h-11 rounded-full object-cover flex-shrink-0"
              />
              <div>
                <p className="font-playfair font-[500] text-[15px] text-primary">{FEATURED.name}</p>
                <p className="font-public-sans text-[12px] text-muted-text mt-0.5">
                  {FEATURED.company} &middot; {FEATURED.country}
                </p>
              </div>
            </div>
          </div>

          {/* Side cards — right */}
          <div className="flex flex-col gap-4">
            {OTHERS.map((t) => (
              <div key={t.name} className="bg-surface border border-border-warm rounded p-5">
                <Stars count={t.rating} />
                <p className="font-public-sans text-[13px] leading-[1.75] text-muted-text mt-3 mb-4">
                  &ldquo;{t.review}&rdquo;
                </p>
                <div className="flex items-center gap-2.5 pt-4 border-t border-border-warm">
                  <Image
                    src={t.avatar}
                    alt={t.name}
                    width={32}
                    height={32}
                    className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="font-playfair font-[500] text-[13px] text-primary truncate">{t.name}</p>
                    <p className="font-public-sans text-[11px] text-muted-text truncate">
                      {t.company} &middot; {t.country}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>
    </section>
  )
}
