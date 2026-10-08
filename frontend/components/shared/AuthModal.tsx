'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { isAxiosError } from 'axios'
import { X } from 'lucide-react'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { Dialog, DialogContent, DialogClose } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useLogin, useForgotPassword } from '@/hooks/queries/useAuth'
import { SignupEmailGate } from '@/components/shared/SignupEmailGate'
import {
  FieldError, FormError, INPUT_CLS, LABEL_CLS, PasswordInput, STEP_HEADING_CLS,
} from '@/components/signup/wizardSteps'

function roleDestination(role: string): string | null {
  if (role === 'SUPER_ADMIN') return '/admin'
  if (role === 'SELLER') return '/portal'
  return null // buyers stay on the page they signed in from
}

interface LoginForm {
  email: string
  password: string
}

type LoginErrors = Partial<Record<keyof LoginForm, string>>

// Never reveal whether the email exists — one message for any 401/403/404/422.
const INVALID_LOGIN_MESSAGE = 'That email and password combination didn’t work. Check your details and try again.'
const GENERIC_ERROR_MESSAGE = 'We couldn’t sign you in right now. Please try again.'

function loginErrorMessage(err: unknown): string {
  if (isAxiosError(err)) {
    const status = err.response?.status
    if (status !== undefined && status >= 400 && status < 500) return INVALID_LOGIN_MESSAGE
  }
  return GENERIC_ERROR_MESSAGE
}

const LINK_BUTTON_CLS =
  'inline-flex min-h-11 items-center font-sans text-[14px] leading-[20px] font-[600] text-forest underline underline-offset-4 hover:text-forest-hover transition-colors'

// ─── Component ────────────────────────────────────────────────────────────────
// The dialog is an optional shortcut. Sign-in lives only here (there is no
// separate /login route); signup's email step is here too, and hands off to the
// full /signup page for the rest of the wizard. Email/password only — no
// third-party providers. Sellers arrive exclusively through /apply → approval.

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
  const [forgotError, setForgotError] = useState<string | null>(null)
  const [forgotSent, setForgotSent] = useState(false)

  const [loginForm, setLoginForm] = useState<LoginForm>({ email: '', password: '' })
  const [fieldErrors, setFieldErrors] = useState<LoginErrors>({})

  // Reset local view state each time the dialog opens (adjust-state-on-prop-change
  // pattern, rather than setState inside an effect).
  const [wasOpen, setWasOpen] = useState(isAuthModalOpen)
  if (isAuthModalOpen !== wasOpen) {
    setWasOpen(isAuthModalOpen)
    if (isAuthModalOpen) {
      setFieldErrors({})
      setForgotView(false)
      setForgotSent(false)
      setForgotError(null)
    }
  }

  // Clear a stale sign-in error from a previous attempt when the dialog reopens.
  useEffect(() => {
    if (isAuthModalOpen) login.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthModalOpen])

  // Route on a successful sign-in from THIS modal instance's own mutation only —
  // the store already closes the modal via setUser(). Buyers stay where they are.
  useEffect(() => {
    if (!login.isSuccess || !login.data) return
    const dest = roleDestination(login.data.user.role)
    if (dest) router.push(dest)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [login.isSuccess])

  function handleTabChange(tab: 'login' | 'signup', prefillEmail?: string) {
    setFieldErrors({})
    setForgotView(false)
    login.reset()
    if (prefillEmail) setLoginForm((f) => ({ ...f, email: prefillEmail }))
    openAuthModal(tab)
  }

  function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    const errors: LoginErrors = {}
    if (!loginForm.email.trim()) errors.email = 'Enter your email address.'
    if (!loginForm.password) errors.password = 'Enter your password.'
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return
    login.mutate({ email: loginForm.email.trim(), password: loginForm.password })
  }

  function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault()
    if (!forgotEmail.trim() || !forgotEmail.includes('@')) {
      setForgotError('Enter a valid email address.')
      return
    }
    setForgotError(null)
    forgotPassword.mutate({ email: forgotEmail.trim() }, { onSuccess: () => setForgotSent(true) })
  }

  const apiError = login.error ? loginErrorMessage(login.error) : null

  return (
    <Dialog open={isAuthModalOpen} onOpenChange={(open) => !open && closeAuthModal()}>
      <DialogContent
        className="mx-0 w-[calc(100%-32px)] max-w-[440px] rounded-[6px] border-line bg-white p-0"
        showClose={false}
        aria-label={forgotView ? 'Reset password' : authModalTab === 'signup' ? 'Create buyer account' : 'Sign in'}
      >
        <div className="relative flex w-full flex-col p-6 sm:p-8">
          <DialogClose className="absolute right-2 top-2 min-h-11 min-w-11 rounded-[4px] text-muted hover:text-ink transition-colors">
            <X size={20} aria-hidden="true" />
            <span className="sr-only">Close</span>
          </DialogClose>

          <p className="font-display text-[21px] leading-[26px] font-[500] text-forest mb-6 pr-10">Solomon Bharat</p>

          {forgotView ? (
            <div>
              <button type="button" onClick={() => setForgotView(false)} className={LINK_BUTTON_CLS}>
                ← Back to sign in
              </button>
              <h2 className={`${STEP_HEADING_CLS} mt-2`}>Reset your password</h2>
              <p className="type-body text-muted mt-2">
                Enter your email and we&apos;ll send you a link to choose a new password.
              </p>
              {forgotSent ? (
                <div role="status" className="mt-6 rounded-[4px] border border-line bg-selected px-4 py-3">
                  <p className="font-sans text-[14px] leading-[20px] text-forest">
                    If an account exists for {forgotEmail}, you&apos;ll receive a reset link shortly.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleForgotPassword} noValidate className="mt-6">
                  <label htmlFor="forgot-email" className={LABEL_CLS}>Email</label>
                  <input
                    id="forgot-email"
                    type="email"
                    autoComplete="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="you@company.com"
                    aria-invalid={!!forgotError || undefined}
                    aria-describedby={forgotError ? 'forgot-email-error' : undefined}
                    className={INPUT_CLS}
                  />
                  <FieldError id="forgot-email-error" message={forgotError} />
                  <Button type="submit" variant="primary" size="lg" className="w-full mt-6" loading={forgotPassword.isPending}>
                    Send reset link
                  </Button>
                </form>
              )}
            </div>
          ) : authModalTab === 'signup' ? (
            <SignupEmailGate
              productImage={authModalProductImage}
              onSwitchToLogin={(email) => handleTabChange('login', email)}
            />
          ) : (
            <form onSubmit={handleLogin} className="flex flex-col" noValidate>
              <h2 className={STEP_HEADING_CLS}>Sign in</h2>
              <p className="type-body text-muted mt-2">Welcome back. Sign in to see wholesale prices and your orders.</p>

              <div className="mt-6 flex flex-col gap-5">
                <div>
                  <label htmlFor="login-email" className={LABEL_CLS}>Email</label>
                  <input
                    id="login-email"
                    type="email"
                    placeholder="you@company.com"
                    autoComplete="email"
                    value={loginForm.email}
                    onChange={(e) => setLoginForm((f) => ({ ...f, email: e.target.value }))}
                    aria-invalid={!!fieldErrors.email || undefined}
                    aria-describedby={fieldErrors.email ? 'login-email-error' : undefined}
                    className={INPUT_CLS}
                  />
                  <FieldError id="login-email-error" message={fieldErrors.email} />
                </div>

                <div>
                  <label htmlFor="login-password" className={LABEL_CLS}>Password</label>
                  <PasswordInput
                    id="login-password"
                    autoComplete="current-password"
                    value={loginForm.password}
                    invalid={!!fieldErrors.password}
                    describedBy={fieldErrors.password ? 'login-password-error' : undefined}
                    onChange={(e) => setLoginForm((f) => ({ ...f, password: e.target.value }))}
                  />
                  <FieldError id="login-password-error" message={fieldErrors.password} />
                  <button
                    type="button"
                    className={`${LINK_BUTTON_CLS} mt-1`}
                    onClick={() => { setForgotEmail(loginForm.email.trim()); setForgotView(true) }}
                  >
                    Forgot your password? Reset it
                  </button>
                </div>
              </div>

              {apiError && <div className="mt-6"><FormError message={apiError} /></div>}

              <Button type="submit" variant="primary" size="lg" className="w-full mt-6" loading={login.isPending}>
                Sign in
              </Button>

              <p className="mt-6 border-t border-line pt-4 font-sans text-[14px] leading-[20px] text-muted">
                New to Solomon Bharat?{' '}
                <button type="button" onClick={() => handleTabChange('signup')} className={LINK_BUTTON_CLS}>
                  Create buyer account
                </button>
              </p>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
