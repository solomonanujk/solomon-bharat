'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { Dialog, DialogContent, DialogClose } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { useLogin, useForgotPassword } from '@/hooks/queries/useAuth'
import { SignupEmailGate } from '@/components/shared/SignupEmailGate'

function roleDestination(role: string): string | null {
  if (role === 'SUPER_ADMIN') return '/admin'
  if (role === 'SELLER') return '/portal'
  return null // buyers and agents stay on the current page
}

interface LoginForm {
  email: string
  password: string
}

// ─── Component ────────────────────────────────────────────────────────────────
// Email/password only — no Google OAuth or any other third-party provider,
// per AGENTS.md. Login uses useLogin, signup uses useSignup (buyer self-signup
// only — sellers arrive exclusively through /apply → admin approval).

export function AuthModal() {
  const router = useRouter()
  const isAuthModalOpen = useAuthStore((s) => s.isAuthModalOpen)
  const authModalTab = useAuthStore((s) => s.authModalTab)
  const authModalProductImage = useAuthStore((s) => s.authModalProductImage)
  const closeAuthModal = useAuthStore((s) => s.closeAuthModal)
  const openAuthModal = useAuthStore((s) => s.openAuthModal)

  const login = useLogin()
  const forgotPassword = useForgotPassword()

  const [forgotView, setForgotView] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotSent, setForgotSent] = useState(false)

  const [loginForm, setLoginForm] = useState<LoginForm>({ email: '', password: '' })
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (isAuthModalOpen) {
      setFormError(null)
      setForgotView(false)
      setForgotSent(false)
    }
  }, [isAuthModalOpen])

  // Route on a successful sign-in from THIS modal instance's own mutation calls
  // only — the store already closes the modal via setUser(), and gating on
  // mutation.isSuccess (rather than the persisted `user`/`isAuthenticated` state)
  // avoids re-firing a redirect for an already-logged-in user on every mount.
  // Signup's own redirect runs via SignupWizard's onSuccess callback below —
  // buyer self-signup always creates a BUYER account, so it's a no-op in
  // practice (roleDestination returns null), but kept symmetric with login.
  useEffect(() => {
    if (!login.isSuccess || !login.data) return
    const dest = roleDestination(login.data.user.role)
    if (dest) router.push(dest)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [login.isSuccess])

  function handleTabChange(tab: string, prefillEmail?: string) {
    setFormError(null)
    setForgotView(false)
    if (prefillEmail) setLoginForm((f) => ({ ...f, email: prefillEmail }))
    openAuthModal(tab as 'login' | 'signup')
  }

  function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!loginForm.email.trim()) return setFormError('Email is required.')
    if (!loginForm.password) return setFormError('Password is required.')
    login.mutate({ email: loginForm.email.trim(), password: loginForm.password })
  }

  function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault()
    if (!forgotEmail.trim()) return
    forgotPassword.mutate({ email: forgotEmail.trim() }, { onSuccess: () => setForgotSent(true) })
  }

  const loading = login.isPending
  const apiError = login.error ? 'Something went wrong. Please check your details and try again.' : null

  return (
    <Dialog open={isAuthModalOpen} onOpenChange={(open) => !open && closeAuthModal()}>
      {/* Faire's own auth modal: a single narrow centered card, no decorative
          side panel — the whole card scrolls as one unit. */}
      <DialogContent className="w-full max-w-[460px] p-0" showClose={false}>
        <div className="flex flex-col w-full p-8 relative">
          <DialogClose className="absolute top-4 right-4 text-muted-text hover:text-primary transition-colors">
            <X size={18} aria-hidden="true" />
            <span className="sr-only">Close</span>
          </DialogClose>

          <img
            src="/branding/solomon-bharat-logo.png"
            alt="Solomon Bharat"
            className="h-11 w-auto object-contain mb-6 mx-auto"
          />

          {forgotView ? (
            <div className="flex-1">
              <button
                type="button"
                onClick={() => setForgotView(false)}
                className="text-[13px] font-[600] font-sans text-muted-text hover:text-primary transition-colors mb-6 flex items-center gap-1"
              >
                ← Back to log in
              </button>
              <h2 className="text-[20px] font-[600] font-display text-primary mb-1">Reset password</h2>
              <p className="text-[14px] font-sans text-muted-text mb-6">
                Enter your email and we&apos;ll send a reset link.
              </p>
              {forgotSent ? (
                <div className="rounded border border-success/30 bg-success/5 px-4 py-3">
                  <p className="text-[14px] font-[600] font-sans text-success">
                    If an account exists for {forgotEmail}, you&apos;ll receive a reset link shortly.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div>
                    <Label htmlFor="forgot-email">Email address</Label>
                    <Input
                      id="forgot-email"
                      type="email"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="you@company.com"
                      required
                      className="mt-1"
                    />
                  </div>
                  <Button type="submit" variant="primary" className="w-full" disabled={forgotPassword.isPending}>
                    {forgotPassword.isPending ? 'Sending…' : 'Send reset link'}
                  </Button>
                </form>
              )}
            </div>
          ) : authModalTab === 'signup' ? (
            /* Signup — only the email gate is a modal; "Sign up for free" sends
               the browser to /signup for the rest of the flow (steps 2–7). */
            <SignupEmailGate
              productImage={authModalProductImage}
              onSwitchToLogin={(email) => handleTabChange('login', email)}
            />
          ) : (
            <form onSubmit={handleLogin} className="flex flex-col gap-4" noValidate>
              <h2 className="text-[22px] font-[600] font-display text-primary text-center mb-1">Log in</h2>

              <div>
                <Label htmlFor="login-email">Email</Label>
                <Input
                  id="login-email"
                  type="email"
                  placeholder="you@company.com"
                  autoComplete="email"
                  value={loginForm.email}
                  onChange={(e) => setLoginForm((f) => ({ ...f, email: e.target.value }))}
                  disabled={loading}
                />
              </div>

              <div>
                <Label htmlFor="login-password">Password</Label>
                <Input
                  id="login-password"
                  type="password"
                  placeholder="Your password"
                  autoComplete="current-password"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm((f) => ({ ...f, password: e.target.value }))}
                  disabled={loading}
                />
              </div>

              {(formError || apiError) && (
                <p className="text-[12px] font-sans text-error" role="alert">
                  {formError ?? apiError}
                </p>
              )}

              <Button type="submit" variant="primary" className="w-full mt-1" disabled={loading}>
                {login.isPending ? 'Logging in…' : 'Log in'}
              </Button>

              <div className="flex justify-center">
                <button
                  type="button"
                  className={cn('text-[13px] font-sans text-muted-text hover:text-primary transition-colors underline')}
                  onClick={() => setForgotView(true)}
                >
                  Forgot password?
                </button>
              </div>

              <p className="text-[13px] font-sans text-muted-text text-center mt-2">
                Don&apos;t have an account?{' '}
                <button type="button" onClick={() => handleTabChange('signup')} className="font-[600] text-primary underline">
                  Sign up
                </button>
              </p>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
