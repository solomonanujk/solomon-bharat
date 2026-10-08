'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { NavBar } from '@/components/shared/NavBar'
import { Footer } from '@/components/shared/Footer'
import { HeroSection } from '@/components/homepage/HeroSection'
import { CategorySection } from '@/components/homepage/CategorySection'
import { RetailerHighlightSection } from '@/components/homepage/RetailerHighlightSection'
import { HowItWorksSection } from '@/components/homepage/HowItWorksSection'
import { TrustBar } from '@/components/homepage/TrustBar'
import { BestsellersSection } from '@/components/homepage/BestsellersSection'
import { BenefitsSection } from '@/components/homepage/BenefitsSection'
import { SellerAndFinalCtaSection } from '@/components/homepage/SellerAndFinalCtaSection'
import { BuyerHomeFeed } from '@/components/homepage/BuyerHomeFeed'

// ─── Homepage ─────────────────────────────────────────────────────────────────
// Guest (or not-yet-hydrated): the marketing homepage per prd.md §6.2.
// Signed-in BUYER or AGENT: a personalized feed (BuyerHomeFeed) replaces it
// entirely — an agent is just a buyer with the extra ability to build a
// catalogue, so they get the exact same homepage/marketplace.
// Signed-in SELLER/SUPER_ADMIN: redirected straight to their own dashboard —
// "/" is never a real landing page for them.

function dashboardPathForRole(role: string): string | null {
  if (role === 'SUPER_ADMIN') return '/admin'
  if (role === 'SELLER') return '/portal'
  return null
}

export default function HomePage() {
  const router = useRouter()
  const hasHydrated = useAuthStore((s) => s._hasHydrated)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const user = useAuthStore((s) => s.user)

  const dashboardPath = user ? dashboardPathForRole(user.role) : null

  useEffect(() => {
    if (!hasHydrated || !isAuthenticated || !dashboardPath) return
    router.replace(dashboardPath)
  }, [hasHydrated, isAuthenticated, dashboardPath, router])

  // Avoid flashing the marketing homepage right before redirecting a seller/admin
  if (hasHydrated && isAuthenticated && dashboardPath) return null

  const isBuyer = hasHydrated && isAuthenticated && (user?.role === 'BUYER' || user?.role === 'AGENT')

  return (
    <div className="min-h-screen bg-ivory flex flex-col">
      <NavBar />

      <main className="flex-1">
        {isBuyer ? (
          <BuyerHomeFeed />
        ) : (
          // Order per redesign spec §5.2. The reviews band is deliberately omitted
          // until there are real, permissioned buyer quotes.
          <>
            <HeroSection />
            <TrustBar />
            <CategorySection />
            <BestsellersSection />
            <RetailerHighlightSection />
            <HowItWorksSection />
            <BenefitsSection />
            <SellerAndFinalCtaSection />
          </>
        )}
      </main>

      <Footer />
    </div>
  )
}
