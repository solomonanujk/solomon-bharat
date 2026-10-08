import { Check } from 'lucide-react'
import { TRUST_BAR_PROMISES } from '@/components/homepage/homepageContent'

/** Forest strip directly under the hero: four equal promises, 2x2 on mobile. */
export function TrustBar() {
  return (
    <section className="on-forest bg-forest border-t border-white/10" aria-label="Why buy from Solomon Bharat">
      <ul className="sb-container py-5 grid grid-cols-2 lg:grid-cols-4 gap-4">
        {TRUST_BAR_PROMISES.map((promise) => (
          <li key={promise} className="flex items-start gap-2 text-brass text-[14px] leading-[20px] font-[500]">
            <Check size={16} className="flex-shrink-0 mt-0.5" aria-hidden="true" />
            <span className="min-w-0">{promise}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
