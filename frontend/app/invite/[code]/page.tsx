'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useMutation, useQuery } from '@tanstack/react-query'
import { NavBar } from '@/components/shared/NavBar'
import { Footer } from '@/components/shared/Footer'
import { Button } from '@/components/ui/button'
import api from '@/lib/api'
import { getApiError } from '@/lib/getApiError'
import { useAuthStore } from '@/lib/store/useAuthStore'

interface InvitePreview {
  name: string
  slug: string
  logoUrl: string | null
}

interface AcceptResult {
  brand: { name: string; slug: string }
  linked: boolean
  reason?: string
}

// A brand's personal invite link. Buyers who accept are recorded as the brand's own
// customers, so the brand pays no commission on their orders.
export default function InvitePage() {
  const { code } = useParams<{ code: string }>()
  const user = useAuthStore((s) => s.user)
  const openAuthModal = useAuthStore((s) => s.openAuthModal)
  const [result, setResult] = useState<AcceptResult | null>(null)

  const { data: brand, isLoading, isError } = useQuery<InvitePreview>({
    queryKey: ['brand-invite', code],
    queryFn: async () => (await api.get(`/brands/invites/${code}`)).data.data,
    retry: false,
  })

  const accept = useMutation<AcceptResult, Error>({
    mutationFn: async () => (await api.post(`/brands/invites/${code}/accept`)).data.data,
    onSuccess: setResult,
  })

  const isBuyer = user?.role === 'BUYER'

  return (
    <div className="min-h-screen bg-ivory flex flex-col">
      <NavBar />
      <main className="flex-1">
        <div className="sb-container sb-section">
          <div className="max-w-[520px] mx-auto bg-white border border-line rounded-xl p-8 text-center">
            {isLoading && <div className="h-24 bg-ivory rounded animate-pulse" />}
            {isError && (
              <>
                <h1 className="type-h2 text-ink">Invite link not valid</h1>
                <p className="type-body text-muted mt-3">Ask the brand for a new link, or browse the marketplace.</p>
                <Link href="/" className="inline-block mt-6 underline underline-offset-4">Go to Solomon Bharat</Link>
              </>
            )}
            {brand && (
              <>
                {brand.logoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={brand.logoUrl} alt="" className="w-20 h-20 rounded-full object-cover mx-auto mb-4 border border-line" />
                )}
                <h1 className="type-h2 text-ink">{brand.name} invited you to order wholesale</h1>
                <p className="type-body text-muted mt-3">
                  Join Solomon Bharat to see {brand.name}&apos;s wholesale prices and order in your own currency.
                </p>

                {result ? (
                  <div className="mt-6">
                    <p className="type-body text-ink">
                      {result.linked ? `You're connected to ${result.brand.name}.` : result.reason}
                    </p>
                    <Link href={`/brands/${result.brand.slug}`} className="inline-block mt-4">
                      <Button variant="primary" size="md">Shop {result.brand.name}</Button>
                    </Link>
                  </div>
                ) : !user ? (
                  <div className="mt-6 flex flex-col sm:flex-row gap-2 justify-center">
                    <Button variant="primary" size="md" onClick={() => openAuthModal('signup')}>Sign up to accept</Button>
                    <Button variant="ghost" size="md" onClick={() => openAuthModal('login')}>Log in</Button>
                  </div>
                ) : isBuyer ? (
                  <div className="mt-6">
                    <Button variant="primary" size="md" onClick={() => accept.mutate()} disabled={accept.isPending}>
                      {accept.isPending ? 'Accepting…' : 'Accept invite'}
                    </Button>
                    {accept.isError && <p className="text-[13px] text-error mt-3">{getApiError(accept.error)}</p>}
                  </div>
                ) : (
                  <p className="type-body text-muted mt-6">Invite links are for buyer accounts.</p>
                )}
              </>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
