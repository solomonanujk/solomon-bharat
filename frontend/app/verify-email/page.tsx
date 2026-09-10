'use client'

import { useEffect, useRef, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { useVerifyEmail } from '@/hooks/queries/useAuth'

// ─── Inner page (needs useSearchParams) ──────────────────────────────────────
// The verification link emailed to the user already carries `id` + `token` —
// this page just confirms it against the backend, no code entry required.

function VerifyEmailInner() {
  const router = useRouter()
  const params = useSearchParams()
  const id = params.get('id')
  const token = params.get('token')
  const next = params.get('next') ?? '/'
  const patchUser = useAuthStore((s) => s.patchUser)
  const verifyEmail = useVerifyEmail()
  const [status, setStatus] = useState<'verifying' | 'success' | 'error' | 'missing'>('verifying')
  const attempted = useRef(false)

  useEffect(() => {
    if (attempted.current) return
    attempted.current = true

    if (!id || !token) {
      setStatus('missing')
      return
    }

    verifyEmail.mutate(
      { id, token },
      {
        onSuccess: () => {
          patchUser({ emailVerifiedAt: new Date().toISOString() })
          setStatus('success')
        },
        onError: () => setStatus('error'),
      }
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, token])

  return (
    <div className="bg-bg min-h-screen flex items-center justify-center px-4 py-12">
      <div className="bg-surface border border-border-warm rounded p-8 w-full max-w-[420px] text-center">
        <Link href="/" className="font-playfair text-[22px] font-[700] text-primary leading-none block mb-8">
          Solomon Bharat
        </Link>

        {status === 'verifying' && (
          <>
            <h1 className="text-[22px] font-[600] font-playfair text-primary mb-1">Verifying your email…</h1>
            <p className="text-[14px] font-public-sans text-muted-text">One moment please.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <h1 className="text-[22px] font-[600] font-playfair text-primary mb-2">Email verified</h1>
            <p className="text-[14px] font-public-sans text-muted-text leading-[1.5] mb-6">
              Your address is confirmed — you're all set.
            </p>
            <Button variant="primary" size="lg" className="w-full" onClick={() => router.push(next)}>
              Continue
            </Button>
          </>
        )}

        {(status === 'error' || status === 'missing') && (
          <>
            <h1 className="text-[22px] font-[600] font-playfair text-primary mb-2">Verification link invalid</h1>
            <p className="text-[14px] font-public-sans text-muted-text leading-[1.5] mb-6">
              {status === 'missing'
                ? 'This link is missing its verification details. Please use the link from your email exactly as sent.'
                : "This link has expired or was already used. Check your inbox for the most recent verification email, or sign in and request a new one."}
            </p>
            <Link
              href="/"
              className="text-[13px] font-public-sans text-muted-text hover:text-primary transition-colors underline underline-offset-2"
            >
              Back to homepage
            </Link>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Page (Suspense wrapper for useSearchParams) ──────────────────────────────

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailInner />
    </Suspense>
  )
}
