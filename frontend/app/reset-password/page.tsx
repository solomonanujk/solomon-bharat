'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { useLogin, useResetPassword } from '@/hooks/queries/useAuth'

// ─── Inner page (needs useSearchParams) ──────────────────────────────────────
// The reset link emailed to the user already carries `id` + `token` — this
// page just collects the new password and confirms it against the backend.
// `welcome=1` marks the one-time link from an account-approval email: same flow,
// friendlier copy, and on success we sign the user straight in.

function roleDestination(role: string): string {
  if (role === 'SUPER_ADMIN') return '/admin'
  if (role === 'SELLER') return '/portal'
  return '/'
}

function ResetPasswordInner() {
  const router = useRouter()
  const params = useSearchParams()
  const id = params.get('id')
  const token = params.get('token')
  const welcome = params.get('welcome') === '1'
  const openAuthModal = useAuthStore((s) => s.openAuthModal)
  const resetPassword = useResetPassword()
  const login = useLogin()
  const [autoLoginFailed, setAutoLoginFailed] = useState(false)

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
      {
        onSuccess: (data) => {
          setDone(true)
          if (!data?.email) {
            setAutoLoginFailed(true)
            return
          }
          // Sign in with the password just chosen, then go to the right home.
          login.mutate(
            { email: data.email, password },
            {
              onSuccess: (res) => router.replace(roleDestination(res.user.role)),
              onError: () => setAutoLoginFailed(true),
            }
          )
        },
      }
    )
  }

  function handleSignIn() {
    router.push('/')
    openAuthModal('login')
  }

  return (
    <div className="bg-bg min-h-screen flex items-center justify-center px-4 py-12">
      <div className="bg-surface border border-border-warm rounded p-8 w-full max-w-[420px]">
        <Link href="/" className="font-display text-[22px] font-[700] text-primary leading-none block mb-8 text-center">
          Solomon Bharat
        </Link>

        {linkMissing ? (
          <div className="text-center">
            <h1 className="text-[22px] font-[600] font-display text-primary mb-2">Reset link invalid</h1>
            <p className="text-[14px] font-sans text-muted-text leading-[1.5] mb-6">
              This link is missing its reset details. Please use the link from your email exactly as sent.
            </p>
            <Link
              href="/"
              className="text-[13px] font-sans text-muted-text hover:text-primary transition-colors underline underline-offset-2"
            >
              Back to homepage
            </Link>
          </div>
        ) : done ? (
          <div className="text-center">
            <h1 className="text-[22px] font-[600] font-display text-primary mb-2">
              {welcome ? 'Your password is set' : 'Password reset'}
            </h1>
            {autoLoginFailed ? (
              <>
                <p className="text-[14px] font-sans text-muted-text leading-[1.5] mb-6">
                  Your password has been saved. Sign in with your email and the password you just chose.
                </p>
                <Button variant="primary" size="lg" className="w-full" onClick={handleSignIn}>
                  Sign in
                </Button>
              </>
            ) : (
              <p className="text-[14px] font-sans text-muted-text leading-[1.5]" role="status">
                Signing you in…
              </p>
            )}
          </div>
        ) : (
          <>
            <h1 className="text-[22px] font-[600] font-display text-primary mb-1 text-center">
              {welcome ? 'Welcome to Solomon Bharat — choose your password' : 'Set a new password'}
            </h1>
            <p className="text-[14px] font-sans text-muted-text text-center mb-6">
              {welcome
                ? 'Your account is approved. Pick a password and we will sign you straight in.'
                : 'Choose a new password for your account.'}
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
                <p className="text-[13px] font-sans text-error" role="alert">{formError}</p>
              )}

              <Button type="submit" variant="primary" size="lg" className="w-full" disabled={resetPassword.isPending}>
                {resetPassword.isPending
                  ? 'Saving…'
                  : welcome
                    ? 'Set password and sign in'
                    : 'Reset password'}
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
