'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { TradeRoutesArt } from '@/components/signup/TradeRoutesArt'
import { ChevronLeft } from 'lucide-react'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { useSignup } from '@/hooks/queries/useAuth'
import { getApiError } from '@/lib/getApiError'
import { safeNextPath } from '@/lib/safeNextPath'
import { NavBar } from '@/components/shared/NavBar'
import { Footer } from '@/components/shared/Footer'
import { SignupEmailGate } from '@/components/shared/SignupEmailGate'
import {
  type WizardState, type Step2Errors, initialWizardState, validateStep2, TOTAL_PAGE_STEPS,
  StepVerifyEmail, Step2Welcome, Step3BusinessType, Step4OpenedYear, Step5BusinessName, Step6Website, Step7HearAboutUs,
} from '@/components/signup/wizardSteps'

// ─── Buyer signup page ─────────────────────────────────────────────────────────
// Two equal columns on desktop (decorative trade-routes art left, form right, max 440px);
// form only on mobile. Step 1 (email) is shown inline when the page is visited
// directly; when arriving from the AuthModal shortcut the email is already in
// the URL (?email=) and the wizard starts at step 2.
// `?next=` (validated to a same-origin relative path) is where the buyer
// returns after creating an account or signing in.
// After the email, the buyer must enter a 6-digit code sent to it ('verify'
// step) before steps 2–7; from the AuthModal shortcut the page opens there.

type Step = number | 'verify'

function SignupPageInner() {
  const router = useRouter()
  const params = useSearchParams()
  const openAuthModal = useAuthStore((s) => s.openAuthModal)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const emailParam = params.get('email') ?? ''
  const next = safeNextPath(params.get('next')) ?? '/'
  const hasValidEmail = emailParam.includes('@')

  // 'verify' sits between step 1 (email) and step 2: the buyer must enter the
  // 6-digit code emailed to them before the rest of the wizard opens.
  const [step, setStep] = useState<Step>(hasValidEmail ? 'verify' : 1)
  const [data, setData] = useState<WizardState>(() => initialWizardState(hasValidEmail ? emailParam : ''))
  const [step2Errors, setStep2Errors] = useState<Step2Errors>({})
  const [error, setError] = useState<string | null>(null)
  // If the signup ticket expires mid-wizard, the buyer re-verifies and comes back here.
  const [resumeStep, setResumeStep] = useState<number | null>(null)
  const signup = useSignup()

  // Already signed in (e.g. switched to "Sign in" from this page and logged in
  // via the modal) — send them where they were heading.
  useEffect(() => {
    if (isAuthenticated && !signup.isPending) router.replace(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated])

  function patch(fields: Partial<WizardState>) {
    setData((d) => ({ ...d, ...fields }))
  }

  function goTo(n: Step) {
    setError(null)
    setStep(n)
    if (typeof window !== 'undefined') window.scrollTo({ top: 0 })
  }

  /** Back to the email screen — a new email needs verifying again. */
  function changeEmail() {
    patch({ signupToken: '' })
    setResumeStep(null)
    goTo(1)
  }

  function goBack() {
    if (step === 'verify' || step === 2) return changeEmail()
    if (step === 7 && data.businessType === 'individual') return goTo(3)
    if (typeof step === 'number') goTo(step - 1)
  }

  function submit(finalHearAboutUs: string[]) {
    setError(null)
    signup.mutate(
      {
        email: data.email.trim(),
        signupToken: data.signupToken,
        password: data.password,
        contactName: `${data.firstName.trim()} ${data.lastName.trim()}`.trim(),
        country: data.country,
        phone: data.phone.trim(),
        companyName: data.businessName.trim() || undefined,
        website: data.website.trim() || undefined,
        businessType: data.businessType || undefined,
        businessOpenedYear: data.businessOpenedYear || undefined,
        hearAboutUs: finalHearAboutUs.length > 0 ? finalHearAboutUs : undefined,
        marketingOptOut: data.marketingOptOut,
        preferredLanguage: data.language || undefined,
      },
      {
        onSuccess: () => router.push(next),
        onError: (err) => {
          // 400 here means the 2h signup ticket expired — re-verify, then resume.
          const status = (err as { response?: { status?: number } }).response?.status
          if (status === 400) {
            patch({ signupToken: '' })
            setResumeStep(7)
            goTo('verify')
          }
        },
      }
    )
  }

  const apiError = signup.error ? getApiError(signup.error) : null
  // Step 1 and email verification aren't part of the counted page steps; steps 2–7 map to 1–6.
  const progressStep = typeof step === 'number' ? Math.max(0, step - 1) : 0
  const canGoBack = step !== 1

  return (
    <div className="min-h-screen bg-ivory flex flex-col">
      <NavBar />

      <main className="flex-1 py-12 lg:py-16">
        <div className="sb-container grid grid-cols-1 lg:grid-cols-2 lg:gap-[72px] items-start">
          {/* Decorative photo panel — desktop only */}
          <div className="hidden lg:block relative w-full aspect-[4/5] overflow-hidden rounded-[6px] border border-line bg-forest">
            <TradeRoutesArt />
          </div>

          <div className="w-full max-w-[440px] mx-auto lg:mx-0">
            <h1 className="type-h1 text-ink">Create your buyer account</h1>
            <p className="type-body text-muted mt-4">
              Sign up to view wholesale prices and order from Solomon Bharat&apos;s catalogue. We&apos;ll email you a
              code to verify your address first.
            </p>

            {/* Progress */}
            <div className="mt-8 flex items-center justify-between gap-4">
              {canGoBack ? (
                <button
                  type="button"
                  onClick={goBack}
                  className="-ml-2 inline-flex min-h-11 items-center gap-1 px-2 font-sans text-[14px] leading-[20px] font-[600] text-forest underline underline-offset-4 hover:text-forest-hover transition-colors"
                >
                  <ChevronLeft size={16} aria-hidden="true" />
                  Back
                </button>
              ) : <span />}
              <span className="type-caption text-muted" aria-live="polite">
                {step === 1 ? 'Get started' : step === 'verify' ? 'Verify your email' : `Step ${progressStep} of ${TOTAL_PAGE_STEPS}`}
              </span>
            </div>
            <div
              className="mt-2 h-1 w-full bg-line rounded-full overflow-hidden"
              role="progressbar"
              aria-label="Signup progress"
              aria-valuemin={0}
              aria-valuemax={TOTAL_PAGE_STEPS}
              aria-valuenow={progressStep}
            >
              <div
                className="h-full bg-forest transition-[width] duration-150"
                style={{ width: `${(progressStep / TOTAL_PAGE_STEPS) * 100}%` }}
              />
            </div>

            <div className="mt-8 bg-white border border-line rounded-[6px] p-6">
              {step === 1 && (
                <SignupEmailGate
                  heading="Start with your email"
                  onContinue={(email) => { patch({ email, signupToken: '' }); goTo('verify') }}
                  onSwitchToLogin={() => openAuthModal('login')}
                />
              )}

              {step === 'verify' && (
                <StepVerifyEmail
                  key={data.email}
                  email={data.email}
                  onVerified={(signupToken) => {
                    patch({ signupToken })
                    const target = resumeStep ?? 2
                    setResumeStep(null)
                    goTo(target)
                  }}
                  onChangeEmail={changeEmail}
                  onSwitchToLogin={() => openAuthModal('login')}
                />
              )}

              {step === 2 && (
                <Step2Welcome
                  data={data}
                  patch={patch}
                  errors={step2Errors}
                  onNext={() => {
                    const errs = validateStep2(data)
                    setStep2Errors(errs)
                    if (Object.keys(errs).length === 0) goTo(3)
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
                    if (!data.businessName.trim()) return setError('Enter your business name.')
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
                  loading={signup.isPending}
                  error={error ?? apiError}
                  onSubmit={submit}
                />
              )}
            </div>
          </div>
        </div>
      </main>

      <Footer />
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
