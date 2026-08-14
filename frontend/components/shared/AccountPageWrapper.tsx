'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { NavBar } from '@/components/shared/NavBar'
import { Footer } from '@/components/shared/Footer'
import { useAuthStore } from '@/lib/store/useAuthStore'

interface AccountPageWrapperProps {
  children: React.ReactNode
  title?: React.ReactNode
  description?: React.ReactNode
}

export function AccountPageWrapper({ children, title, description }: AccountPageWrapperProps) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const hasHydrated = useAuthStore((s) => s._hasHydrated)
  const openAuthModal = useAuthStore((s) => s.openAuthModal)
  const router = useRouter()

  useEffect(() => {
    if (!hasHydrated) return
    if (!isAuthenticated) {
      router.replace('/')
      openAuthModal('login')
    }
  }, [hasHydrated, isAuthenticated, router, openAuthModal])

  if (!hasHydrated || !isAuthenticated) return null

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <NavBar />
      <main className="flex-1 max-w-[1120px] mx-auto w-full px-4 lg:px-8 py-8 lg:py-12">
        {title && (
          <div className="flex items-center gap-3 mb-6">
            <button
              type="button"
              onClick={() => router.back()}
              aria-label="Go back"
              className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded border border-border-warm text-muted-text hover:text-primary hover:bg-muted-bg transition-colors"
            >
              <ArrowLeft size={15} aria-hidden="true" />
            </button>
            <div>
              <h1 className="text-[24px] leading-[1.3] font-[500] font-playfair text-primary">
                {title}
              </h1>
              {description && (
                <p className="text-[12px] leading-[1.3] font-[400] font-public-sans text-muted-text mt-0.5">
                  {description}
                </p>
              )}
            </div>
          </div>
        )}
        {children}
      </main>
      <Footer />
    </div>
  )
}
