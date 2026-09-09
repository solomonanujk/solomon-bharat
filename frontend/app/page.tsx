'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { NavBar } from '@/components/shared/NavBar'
import { Footer } from '@/components/shared/Footer'
import { HeroSection } from '@/components/homepage/HeroSection'
import { CategorySection } from '@/components/homepage/CategorySection'
import { FeaturedCollectionsSection } from '@/components/homepage/FeaturedCollectionsSection'
import { RetailerHighlightSection } from '@/components/homepage/RetailerHighlightSection'
import { HowItWorksSection } from '@/components/homepage/HowItWorksSection'
import { TestimonialsSection } from '@/components/homepage/TestimonialsSection'
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
    <div className="min-h-screen bg-bg flex flex-col">
      <NavBar />

      <main className="flex-1">
        {isBuyer ? (
          <BuyerHomeFeed />
        ) : (
          <>
            <HeroSection />
            <CategorySection />
            <FeaturedCollectionsSection />
            <RetailerHighlightSection />
            <HowItWorksSection />
            <TestimonialsSection />
          </>
        )}
      </main>

      <Footer />
    </div>
  )
}
