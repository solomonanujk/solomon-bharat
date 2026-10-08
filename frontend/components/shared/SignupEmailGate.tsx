'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { useCheckEmail } from '@/hooks/queries/useAuth'
import { getApiError } from '@/lib/getApiError'
import { Button } from '@/components/ui/button'
import { safeNextPath } from '@/lib/safeNextPath'
import { FieldError, INPUT_CLS, LABEL_CLS, STEP_HEADING_CLS } from '@/components/signup/wizardSteps'

// ─── Signup step 1: email capture ──────────────────────────────────────────────
// Used two ways:
//  - In the AuthModal (shortcut): submitting closes the modal and sends the
//    browser to /signup?email=…&next=<current page> for the rest of the wizard.
//  - Inline on /signup (direct visit): `onContinue` is passed and the page
//    advances to step 2 itself.
// Before either handoff it checks whether the email is already registered — if
// so, the person is switched to sign in instead, email pre-filled.

interface SignupEmailGateProps {
  productImage?: string | null
  onSwitchToLogin: (email: string) => void
  /** When set (inline on /signup), called instead of navigating to /signup. */
  onContinue?: (email: string) => void
  /** Heading text (rendered as an h2). */
  heading?: string
}

function currentRelativePath(): string | null {
  if (typeof window === 'undefined') return null
  return safeNextPath(`${window.location.pathname}${window.location.search}`)
}

export function SignupEmailGate({ productImage, onSwitchToLogin, onContinue, heading = 'Unlock wholesale pricing' }: SignupEmailGateProps) {
  const router = useRouter()
  const closeAuthModal = useAuthStore((s) => s.closeAuthModal)
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const checkEmail = useCheckEmail()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = email.trim()
    if (!trimmed || !trimmed.includes('@')) {
      setError('Enter a valid email address, like you@company.com.')
      return
    }
    setError(null)
    checkEmail.mutate(trimmed, {
      onSuccess: ({ exists }) => {
        if (exists) {
          onSwitchToLogin(trimmed)
          return
        }
        if (onContinue) {
          onContinue(trimmed)
          return
        }
        closeAuthModal()
        const params = new URLSearchParams({ email: trimmed })
        const next = currentRelativePath()
        if (next) params.set('next', next)
        router.push(`/signup?${params.toString()}`)
      },
      onError: (err) => setError(getApiError(err)),
    })
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="flex flex-col">
      {productImage && (
        <div className="relative w-28 h-28 mx-auto mb-6 rounded-[6px] overflow-hidden bg-ivory border border-line flex-shrink-0">
          <Image src={productImage} alt="" fill sizes="112px" className="object-contain" />
        </div>
      )}

      <h2 className={STEP_HEADING_CLS}>{heading}</h2>
      <p className="type-body text-muted mt-2">
        Create a free buyer account to see wholesale prices and order from our catalogue.
      </p>

      <div className="mt-6">
        <label htmlFor="gate-email" className={LABEL_CLS}>Business email</label>
        <input
          id="gate-email"
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          value={email}
          aria-invalid={!!error || undefined}
          aria-describedby={error ? 'gate-email-error' : undefined}
          onChange={(e) => setEmail(e.target.value)}
          className={INPUT_CLS}
        />
        <FieldError id="gate-email-error" message={error} />
      </div>

      <Button type="submit" variant="primary" size="lg" className="w-full mt-6" loading={checkEmail.isPending}>
        Continue
      </Button>

      <p className="type-caption text-muted mt-4">
        By continuing, you agree to our{' '}
        <Link href="/terms" className="text-forest underline underline-offset-2 hover:text-forest-hover">Terms</Link>{' '}
        and{' '}
        <Link href="/privacy" className="text-forest underline underline-offset-2 hover:text-forest-hover">Privacy Policy</Link>.
      </p>

      <div className="mt-6 border-t border-line pt-4 flex flex-col gap-1">
        <p className="font-sans text-[14px] leading-[20px] text-muted">
          Already have an account?{' '}
          <button
            type="button"
            onClick={() => onSwitchToLogin(email.trim())}
            className="inline-flex min-h-11 items-center font-[600] text-forest underline underline-offset-4 hover:text-forest-hover transition-colors"
          >
            Sign in
          </button>
        </p>
        <p className="font-sans text-[14px] leading-[20px] text-muted">
          Are you a maker or supplier?{' '}
          <Link
            href="/sell"
            onClick={() => closeAuthModal()}
            className="inline-flex min-h-11 items-center font-[600] text-forest underline underline-offset-4 hover:text-forest-hover transition-colors"
          >
            Sign up to sell
          </Link>
        </p>
      </div>
    </form>
  )
}
