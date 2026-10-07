'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { useCheckEmail } from '@/hooks/queries/useAuth'
import { getApiError } from '@/lib/getApiError'
import { INPUT_CLS, LABEL_CLS } from '@/components/signup/wizardSteps'

// ─── The signup modal's only step ──────────────────────────────────────────────
// Matches Faire: only the initial email gate ("Unlock wholesale pricing") is a
// modal. Submitting it closes the modal and sends the browser to a real page
// (/signup) for the rest of the onboarding wizard — see app/signup/page.tsx,
// which shares its step components with this file via components/signup/wizardSteps.tsx.
// Before that handoff, it checks whether the email is already registered — if
// so, there's no point walking someone through six more screens just to hit a
// conflict at the end; switch them to sign in instead, email pre-filled.

interface SignupEmailGateProps {
  productImage?: string | null
  onSwitchToLogin: (email: string) => void
}

export function SignupEmailGate({ productImage, onSwitchToLogin }: SignupEmailGateProps) {
  const router = useRouter()
  const closeAuthModal = useAuthStore((s) => s.closeAuthModal)
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const checkEmail = useCheckEmail()

  function handleNext() {
    const trimmed = email.trim()
    if (!trimmed || !trimmed.includes('@')) {
      setError('Please enter a valid email address')
      return
    }
    setError(null)
    checkEmail.mutate(trimmed, {
      onSuccess: ({ exists }) => {
        if (exists) {
          onSwitchToLogin(trimmed)
        } else {
          closeAuthModal()
          router.push(`/signup?email=${encodeURIComponent(trimmed)}`)
        }
      },
      onError: (err) => setError(getApiError(err)),
    })
  }

  return (
    <div className="flex flex-col flex-1">
      {productImage && (
        <div className="relative w-28 h-28 mx-auto mb-5 rounded-lg overflow-hidden bg-muted-bg border border-border-warm flex-shrink-0">
          <Image src={productImage} alt="" fill sizes="112px" className="object-contain" />
        </div>
      )}

      <h2 className="text-[24px] font-[600] font-display text-primary text-center leading-tight mb-6">
        Unlock wholesale pricing
      </h2>

      <div className="mb-1">
        <label htmlFor="gate-email" className={LABEL_CLS}>Business email</label>
        <input
          id="gate-email"
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleNext()}
          className={cn(INPUT_CLS, error && 'border-error')}
        />
      </div>
      {error && <p className="text-[12.5px] font-sans text-error mb-3">{error}</p>}

      <button
        type="button"
        onClick={handleNext}
        disabled={checkEmail.isPending}
        className="w-full h-11 rounded-lg bg-primary text-white text-[14px] font-[600] font-sans hover:bg-primary/90 transition-colors mt-4 disabled:opacity-60"
      >
        {checkEmail.isPending ? 'Checking…' : 'Sign up for free'}
      </button>

      <p className="text-[12px] leading-[1.4] font-sans text-muted-text text-center mt-4">
        By proceeding, you agree to our{' '}
        <a href="/terms" className="underline hover:text-primary transition-colors">Terms</a>{' '}
        and{' '}
        <a href="/privacy" className="underline hover:text-primary transition-colors">Privacy Policy</a>.
      </p>

      <div className="mt-auto pt-6 space-y-2 text-center">
        <p className="text-[13px] font-sans text-muted-text">
          Are you a brand? <a href="/sell" className="font-[600] text-primary underline">Sign up to sell</a>
        </p>
        <p className="text-[13px] font-sans text-muted-text">
          Already have an account?{' '}
          <button type="button" onClick={() => onSwitchToLogin(email.trim())} className="font-[600] text-primary underline">
            Sign in
          </button>
        </p>
      </div>
    </div>
  )
}
