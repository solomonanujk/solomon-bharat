import { BadgeCheck, Building2, Boxes, ShieldCheck, type LucideIcon } from 'lucide-react'
import { BENEFITS } from '@/components/homepage/homepageContent'

// ─── Benefits ─────────────────────────────────────────────────────────────────
// Four white bordered cards, 2x2 desktop/tablet, 1 column on mobile.
// (The reviews band that follows in the spec is intentionally not rendered
// until there are real, permissioned buyer quotes.)

const ICONS: readonly LucideIcon[] = [Building2, BadgeCheck, Boxes, ShieldCheck]

export function BenefitsSection() {
  return (
    <section className="bg-white sb-section" aria-labelledby="home-benefits-heading">
      <div className="sb-container">
        <div className="mb-6 lg:mb-8 max-w-[660px]">
          <p className="type-eyebrow text-brass-deep">Why Solomon Bharat</p>
          <h2 id="home-benefits-heading" className="type-h2 text-ink mt-2">
            Wholesale buying, made simple
          </h2>
        </div>

        <ul className="grid grid-cols-1 md:grid-cols-2 gap-5 lg:gap-6">
          {BENEFITS.map((benefit, i) => {
            const Icon = ICONS[i % ICONS.length]
            return (
              <li key={benefit.title} className="bg-white border border-line rounded-[6px] p-6">
                <Icon size={24} strokeWidth={1.75} className="text-forest" aria-hidden="true" />
                <h3 className="type-h3 text-ink mt-4">{benefit.title}</h3>
                <p className="type-body text-muted mt-2">{benefit.body}</p>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
