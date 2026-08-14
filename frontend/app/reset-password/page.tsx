'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { useResetPassword } from '@/hooks/queries/useAuth'

// ─── Inner page (needs useSearchParams) ──────────────────────────────────────
// The reset link emailed to the user already carries `id` + `token` — this
// page just collects the new password and confirms it against the backend.

function ResetPasswordInner() {
  const router = useRouter()
  const params = useSearchParams()
  const id = params.get('id')
  const token = params.get('token')
  const openAuthModal = useAuthStore((s) => s.openAuthModal)
  const resetPassword = useResetPassword()

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const linkMissing = !id || !token

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)

    if (password.length < 8) {
      setFormError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirmPassword) {
      setFormError('Passwords do not match.')
      return
    }

    resetPassword.mutate(
      { id: id!, token: token!, password },
      { onSuccess: () => setDone(true) }
    )
  }

  function handleSignIn() {
    router.push('/')
    openAuthModal('login')
  }

  return (
    <div className="bg-bg min-h-screen flex items-center justify-center px-4 py-12">
      <div className="bg-surface border border-border-warm rounded p-8 w-full max-w-[420px]">
        <Link href="/" className="font-playfair text-[22px] font-[600] text-primary leading-none block mb-8 text-center">
          Solomon Bharat
        </Link>

        {linkMissing ? (
          <div className="text-center">
            <h1 className="text-[22px] font-[500] font-playfair text-primary mb-2">Reset link invalid</h1>
            <p className="text-[14px] font-public-sans text-muted-text leading-[1.5] mb-6">
              This link is missing its reset details. Please use the link from your email exactly as sent.
            </p>
            <Link
              href="/"
              className="text-[13px] font-public-sans text-muted-text hover:text-primary transition-colors underline underline-offset-2"
            >
              Back to homepage
            </Link>
          </div>
        ) : done ? (
          <div className="text-center">
            <h1 className="text-[22px] font-[500] font-playfair text-primary mb-2">Password reset</h1>
            <p className="text-[14px] font-public-sans text-muted-text leading-[1.5] mb-6">
              Your password has been updated. You can now sign in with your new password.
            </p>
            <Button variant="primary" size="lg" className="w-full" onClick={handleSignIn}>
              Sign in
            </Button>
          </div>
        ) : (
          <>
            <h1 className="text-[22px] font-[500] font-playfair text-primary mb-1 text-center">Set a new password</h1>
            <p className="text-[14px] font-public-sans text-muted-text text-center mb-6">
              Choose a new password for your account.
            </p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <Label htmlFor="new-password">New password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
                  required
                />
              </div>
              <div>
                <Label htmlFor="confirm-password">Confirm password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your new password"
                  autoComplete="new-password"
                  required
                />
              </div>

              {formError && (
                <p className="text-[13px] font-public-sans text-error" role="alert">{formError}</p>
              )}

              <Button type="submit" variant="primary" size="lg" className="w-full" disabled={resetPassword.isPending}>
                {resetPassword.isPending ? 'Resetting…' : 'Reset password'}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Page (Suspense wrapper for useSearchParams) ──────────────────────────────

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordInner />
    </Suspense>
  )
}
