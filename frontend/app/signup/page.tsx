'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { useSignup } from '@/hooks/queries/useAuth'
import { getApiError } from '@/lib/getApiError'
import {
  type WizardState, initialWizardState, TOTAL_PAGE_STEPS,
  Step2Welcome, Step3BusinessType, Step4OpenedYear, Step5BusinessName, Step6Website, Step7HearAboutUs,
} from '@/components/signup/wizardSteps'

// ─── Full-page continuation of the signup wizard ───────────────────────────────
// Matches Faire: only the initial email gate is a modal (SignupEmailGate,
// opened from product cards / "Sign up to buy" / blurred prices). Once that's
// submitted, the browser lands here — a real page, not a dialog — for the rest
// of onboarding. Requires a valid `email` query param (set by the gate); a
// direct visit without one is sent back through the gate instead.

function SignupPageInner() {
  const router = useRouter()
  const params = useSearchParams()
  const openAuthModal = useAuthStore((s) => s.openAuthModal)
  const emailParam = params.get('email') ?? ''

  const [step, setStep] = useState(2)
  const [data, setData] = useState<WizardState>(() => initialWizardState(emailParam))
  const [error, setError] = useState<string | null>(null)
  const signup = useSignup()

  const hasValidEmail = emailParam.includes('@')

  useEffect(() => {
    if (!hasValidEmail) {
      router.replace('/')
      openAuthModal('signup')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasValidEmail])

  function patch(fields: Partial<WizardState>) {
    setData((d) => ({ ...d, ...fields }))
  }

  function goTo(n: number) {
    setError(null)
    setStep(n)
  }

  function submit(finalHearAboutUs: string[]) {
    setError(null)
    signup.mutate(
      {
        email: data.email.trim(),
        password: data.password,
        contactName: `${data.firstName.trim()} ${data.lastName.trim()}`.trim(),
        country: data.country,
        companyName: data.businessName.trim() || undefined,
        website: data.website.trim() || undefined,
        businessType: data.businessType || undefined,
        businessOpenedYear: data.businessOpenedYear || undefined,
        hearAboutUs: finalHearAboutUs.length > 0 ? finalHearAboutUs : undefined,
        marketingOptOut: data.marketingOptOut,
        preferredLanguage: data.language || undefined,
      },
      { onSuccess: () => router.push('/') }
    )
  }

  const apiError = signup.error ? getApiError(signup.error) : null
  const loading = signup.isPending

  if (!hasValidEmail) return null

  return (
    <div className="bg-bg min-h-screen flex flex-col items-center">
      {/* Header bar — full width, back arrow pinned to the far-left edge
          (not tied to the content column), logo centered. Matches Faire's own
          layout: back chevron top-left of the page, progress bar directly
          beneath the whole header, independent of where the content sits. */}
      <div className="w-full relative flex items-center justify-center h-16 px-4 flex-shrink-0">
        {step > 2 && (
          <button
            type="button"
            onClick={() => goTo(step === 7 && data.businessType === 'individual' ? 3 : step - 1)}
            aria-label="Back"
            className="absolute left-4 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-8 h-8 text-muted-text hover:text-primary transition-colors"
          >
            <ChevronLeft size={20} aria-hidden="true" />
          </button>
        )}
        <Link href="/">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/branding/solomon-bharat-logo.png" alt="Solomon Bharat" className="h-9 w-auto object-contain" />
        </Link>
      </div>

      <div className="w-full h-[3px] bg-muted-bg flex-shrink-0">
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${Math.min(100, ((step - 1) / TOTAL_PAGE_STEPS) * 100)}%` }}
        />
      </div>

      <div className="w-full max-w-[460px] px-4 py-10">
        {step === 2 && (
          <Step2Welcome
            data={data}
            patch={patch}
            error={error}
            onNext={() => {
              if (!data.firstName.trim() || !data.lastName.trim()) return setError('Enter your first and last name')
              if (data.password.length < 8) return setError('Password must be at least 8 characters')
              if (!data.country) return setError('Select your country')
              goTo(3)
            }}
          />
        )}

        {step === 3 && (
          <Step3BusinessType
            data={data}
            patch={patch}
            onNext={() => goTo(4)}
            onShoppingForMyself={() => { patch({ businessType: 'individual' }); goTo(7) }}
          />
        )}

        {step === 4 && <Step4OpenedYear data={data} patch={patch} onNext={() => goTo(5)} />}

        {step === 5 && (
          <Step5BusinessName
            data={data}
            patch={patch}
            error={error}
            onNext={() => {
              if (!data.businessName.trim()) return setError('Enter your business name')
              goTo(6)
            }}
          />
        )}

        {step === 6 && (
          <Step6Website
            data={data}
            patch={patch}
            onNext={() => goTo(7)}
            onNoWebsite={() => { patch({ website: '' }); goTo(7) }}
          />
        )}

        {step === 7 && (
          <Step7HearAboutUs
            data={data}
            patch={patch}
            loading={loading}
            error={error ?? apiError}
            onSubmit={submit}
          />
        )}
      </div>
    </div>
  )
}

export default function SignupPage() {
  return (
    <Suspense>
      <SignupPageInner />
    </Suspense>
  )
}
