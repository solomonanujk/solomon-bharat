'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { SELLER_STRIP } from '@/components/homepage/homepageContent'

// ─── Seller strip + final CTA ─────────────────────────────────────────────────
// Two forest bands back to back, separated by a fine rule: a compact seller
// strip (48px padding) then a centred buyer sign-up CTA (72px padding).

export function SellerAndFinalCtaSection() {
  const openAuthModal = useAuthStore((s) => s.openAuthModal)

  return (
    <div className="on-forest bg-forest">
      <section className="sb-container py-12" aria-label="Sell on Solomon Bharat">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <p className="type-h3 text-white max-w-[700px]">
            {SELLER_STRIP.lead} <span className="text-brass">{SELLER_STRIP.accent}</span> {SELLER_STRIP.tail}
          </p>
          <Button asChild variant="outlineOnForest" size="lg" className="w-full sm:w-auto flex-shrink-0">
            <Link href="/sell">Apply as a seller</Link>
          </Button>
        </div>
      </section>

      <section className="border-t border-white/15 py-12 lg:py-[72px]" aria-labelledby="home-final-cta-heading">
        <div className="sb-container text-center flex flex-col items-center">
          <h2 id="home-final-cta-heading" className="type-h2 text-white max-w-[700px]">
            Ready to source for your store?
          </h2>
          <p className="type-body text-light-text mt-4 max-w-[560px]">
            Sign up to unlock wholesale pricing.
          </p>
          <Button
            type="button"
            variant="onForestIvory"
            size="lg"
            className="mt-8 w-full sm:w-auto"
            onClick={() => openAuthModal('signup')}
          >
            Sign up to buy
          </Button>
        </div>
      </section>
    </div>
  )
}
