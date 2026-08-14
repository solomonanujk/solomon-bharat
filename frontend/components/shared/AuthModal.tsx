'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { Dialog, DialogContent, DialogClose } from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { useLogin, useSignup, useForgotPassword } from '@/hooks/queries/useAuth'

function roleDestination(role: string): string | null {
  if (role === 'SUPER_ADMIN') return '/admin'
  if (role === 'SELLER') return '/portal'
  return null // buyers stay on the current page
}

interface SignupForm {
  email: string
  password: string
  contactName: string
  country: string
  companyName: string
  phone: string
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
  const closeAuthModal = useAuthStore((s) => s.closeAuthModal)
  const openAuthModal = useAuthStore((s) => s.openAuthModal)

  const login = useLogin()
  const signup = useSignup()
  const forgotPassword = useForgotPassword()

  const [forgotView, setForgotView] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotSent, setForgotSent] = useState(false)

  const [signupForm, setSignupForm] = useState<SignupForm>({
    email: '', password: '', contactName: '', country: '', companyName: '', phone: '',
  })
  const [loginForm, setLoginForm] = useState<LoginForm>({ email: '', password: '' })
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (isAuthModalOpen) {
      setFormError(null)
      setForgotView(false)
      setForgotSent(false)
    }
  }, [isAuthModalOpen])

  // Route on a successful sign-in/sign-up from THIS modal instance's own mutation
  // calls only — the store already closes the modal via setUser(), and gating on
  // mutation.isSuccess (rather than the persisted `user`/`isAuthenticated` state)
  // avoids re-firing a redirect for an already-logged-in user on every mount.
  useEffect(() => {
    if (!login.isSuccess || !login.data) return
    const dest = roleDestination(login.data.user.role)
    if (dest) router.push(dest)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [login.isSuccess])

  useEffect(() => {
    if (!signup.isSuccess || !signup.data) return
    const dest = roleDestination(signup.data.user.role)
    if (dest) router.push(dest)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signup.isSuccess])

  function handleTabChange(tab: string) {
    setFormError(null)
    setForgotView(false)
    openAuthModal(tab as 'login' | 'signup')
  }

  function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!signupForm.email.trim()) return setFormError('Email is required.')
    if (signupForm.password.length < 8) return setFormError('Password must be at least 8 characters.')
    if (!signupForm.contactName.trim()) return setFormError('Contact name is required.')
    if (!signupForm.country.trim()) return setFormError('Country is required.')

    signup.mutate({
      email: signupForm.email.trim(),
      password: signupForm.password,
      contactName: signupForm.contactName.trim(),
      country: signupForm.country.trim(),
      companyName: signupForm.companyName.trim() || undefined,
      phone: signupForm.phone.trim() || undefined,
    })
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

  const loading = login.isPending || signup.isPending
  const apiError = login.error || signup.error
    ? 'Something went wrong. Please check your details and try again.'
    : null

  return (
    <Dialog open={isAuthModalOpen} onOpenChange={(open) => !open && closeAuthModal()}>
      <DialogContent className="w-full max-w-[800px] max-h-[640px] p-0 overflow-hidden flex flex-row" showClose={false}>
        {/* Left editorial panel (desktop only) */}
        <div
          className="hidden md:flex flex-col items-center justify-center w-1/2 flex-shrink-0 bg-gradient-to-br from-muted-bg to-border-warm relative overflow-hidden"
          aria-hidden="true"
        >
          <svg className="absolute inset-0 w-full h-full opacity-[0.07]" viewBox="0 0 400 560" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="200" cy="280" r="160" stroke="#1A1A1A" strokeWidth="1" />
            <circle cx="200" cy="280" r="110" stroke="#1A1A1A" strokeWidth="1" />
            <circle cx="200" cy="280" r="60" stroke="#1A1A1A" strokeWidth="1" />
            <line x1="40" y1="280" x2="360" y2="280" stroke="#1A1A1A" strokeWidth="1" />
            <line x1="200" y1="120" x2="200" y2="440" stroke="#1A1A1A" strokeWidth="1" />
          </svg>
          <div className="relative z-10 text-center px-8">
            <p className="font-playfair text-[28px] font-[500] text-primary leading-[1.2]">
              Indian Craft &amp;
              <br />
              Export Marketplace
            </p>
            <p className="mt-3 text-[14px] font-public-sans text-muted-text leading-[1.5]">
              Curated wholesale goods from India&apos;s finest artisan communities.
            </p>
          </div>
        </div>

        {/* Right form panel */}
        <div className="flex flex-col w-full md:w-1/2 p-8 overflow-y-auto relative">
          <DialogClose className="absolute top-4 right-4 text-muted-text hover:text-primary transition-colors">
            <X size={18} aria-hidden="true" />
            <span className="sr-only">Close</span>
          </DialogClose>

          <p className="font-playfair text-[20px] font-[600] text-primary mb-6">Solomon Bharat</p>

          {forgotView ? (
            <div className="flex-1">
              <button
                type="button"
                onClick={() => setForgotView(false)}
                className="text-[13px] font-[500] font-public-sans text-muted-text hover:text-primary transition-colors mb-6 flex items-center gap-1"
              >
                ← Back to log in
              </button>
              <h2 className="text-[20px] font-[500] font-playfair text-primary mb-1">Reset password</h2>
              <p className="text-[14px] font-public-sans text-muted-text mb-6">
                Enter your email and we&apos;ll send a reset link.
              </p>
              {forgotSent ? (
                <div className="rounded border border-success/30 bg-success/5 px-4 py-3">
                  <p className="text-[14px] font-[500] font-public-sans text-success">
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
          ) : (
            <Tabs value={authModalTab} onValueChange={handleTabChange} className="flex-1">
              <TabsList className="mb-6">
                <TabsTrigger value="signup">Create account</TabsTrigger>
                <TabsTrigger value="login">Log in</TabsTrigger>
              </TabsList>

              {/* Signup */}
              <TabsContent value="signup">
                <form onSubmit={handleSignup} className="flex flex-col gap-4" noValidate>
                  <div>
                    <Label htmlFor="signup-email">Email</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="you@company.com"
                      autoComplete="email"
                      value={signupForm.email}
                      onChange={(e) => setSignupForm((f) => ({ ...f, email: e.target.value }))}
                      disabled={loading}
                    />
                  </div>

                  <div>
                    <Label htmlFor="signup-password">Password</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      placeholder="Min 8 characters"
                      autoComplete="new-password"
                      value={signupForm.password}
                      onChange={(e) => setSignupForm((f) => ({ ...f, password: e.target.value }))}
                      disabled={loading}
                    />
                  </div>

                  <div>
                    <Label htmlFor="signup-contact-name">Contact name</Label>
                    <Input
                      id="signup-contact-name"
                      type="text"
                      placeholder="Your full name"
                      autoComplete="name"
                      value={signupForm.contactName}
                      onChange={(e) => setSignupForm((f) => ({ ...f, contactName: e.target.value }))}
                      disabled={loading}
                    />
                  </div>

                  <div>
                    <Label htmlFor="signup-country">Country</Label>
                    <Input
                      id="signup-country"
                      type="text"
                      placeholder="e.g. United States"
                      autoComplete="country-name"
                      value={signupForm.country}
                      onChange={(e) => setSignupForm((f) => ({ ...f, country: e.target.value }))}
                      disabled={loading}
                    />
                  </div>

                  <div>
                    <Label htmlFor="signup-company">
                      Company name <span className="text-muted-text font-[400]">(optional)</span>
                    </Label>
                    <Input
                      id="signup-company"
                      type="text"
                      placeholder="Your business name"
                      autoComplete="organization"
                      value={signupForm.companyName}
                      onChange={(e) => setSignupForm((f) => ({ ...f, companyName: e.target.value }))}
                      disabled={loading}
                    />
                  </div>

                  <div>
                    <Label htmlFor="signup-phone">
                      Phone <span className="text-muted-text font-[400]">(optional)</span>
                    </Label>
                    <Input
                      id="signup-phone"
                      type="tel"
                      placeholder="+1 555 123 4567"
                      autoComplete="tel"
                      value={signupForm.phone}
                      onChange={(e) => setSignupForm((f) => ({ ...f, phone: e.target.value }))}
                      disabled={loading}
                    />
                  </div>

                  {(formError || apiError) && (
                    <p className="text-[12px] font-public-sans text-error" role="alert">
                      {formError ?? apiError}
                    </p>
                  )}

                  <Button type="submit" variant="primary" className="w-full mt-1" disabled={loading}>
                    {signup.isPending ? 'Creating account…' : 'Create account'}
                  </Button>

                  <p className="text-[12px] leading-[1.3] font-[400] font-public-sans text-muted-text text-center">
                    By signing up you agree to our{' '}
                    <a href="/terms" className="underline hover:text-primary transition-colors">Terms of Service</a>{' '}
                    and{' '}
                    <a href="/privacy" className="underline hover:text-primary transition-colors">Privacy Policy</a>.
                  </p>
                </form>
              </TabsContent>

              {/* Login */}
              <TabsContent value="login">
                <form onSubmit={handleLogin} className="flex flex-col gap-4" noValidate>
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
                    <p className="text-[12px] font-public-sans text-error" role="alert">
                      {formError ?? apiError}
                    </p>
                  )}

                  <Button type="submit" variant="primary" className="w-full mt-1" disabled={loading}>
                    {login.isPending ? 'Logging in…' : 'Log in'}
                  </Button>

                  <div className="flex justify-center">
                    <button
                      type="button"
                      className={cn('text-[13px] font-public-sans text-muted-text hover:text-primary transition-colors underline')}
                      onClick={() => setForgotView(true)}
                    >
                      Forgot password?
                    </button>
                  </div>
                </form>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
