'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Check } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { NavBar } from '@/components/shared/NavBar'
import { Footer } from '@/components/shared/Footer'
import { useApplyAsAgent } from '@/hooks/queries/useAgents'
import type { AgentApplyInput } from '@/types'

const EMPTY_FORM: AgentApplyInput = {
  businessName: '',
  contactName: '',
  email: '',
  phone: '',
  businessAddress: '',
  country: '',
  message: '',
}

// ─── Page ──────────────────────────────────────────────────────────────────────
// The backend's AGENT application only accepts these seven fields — no GST,
// documents, or category selection (there are no columns for them). A single
// simple form is sufficient; a multi-step wizard is unnecessary here.

export default function ApplyAgentPage() {
  const [form, setForm] = useState<AgentApplyInput>(EMPTY_FORM)
  const [validationError, setValidationError] = useState<string | null>(null)
  const applyAsAgent = useApplyAsAgent()

  function set<K extends keyof AgentApplyInput>(key: K, value: AgentApplyInput[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setValidationError(null)

    if (!form.businessName.trim()) return setValidationError('Business name is required.')
    if (!form.contactName.trim()) return setValidationError('Contact name is required.')
    if (!form.email.trim()) return setValidationError('Email is required.')
    if (!form.phone.trim()) return setValidationError('Phone number is required.')
    if (!form.businessAddress.trim()) return setValidationError('Business address is required.')
    if (!form.country.trim()) return setValidationError('Country is required.')

    applyAsAgent.mutate({
      businessName: form.businessName.trim(),
      contactName: form.contactName.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      businessAddress: form.businessAddress.trim(),
      country: form.country.trim(),
      message: form.message?.trim() || undefined,
    })
  }

  if (applyAsAgent.isSuccess) {
    return (
      <div className="min-h-screen bg-bg flex flex-col">
        <NavBar />
        <main className="flex-1 flex items-center justify-center px-4 py-16">
          <div className="max-w-[480px] w-full text-center flex flex-col items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-success/10 flex items-center justify-center">
              <Check size={24} className="text-success" />
            </div>
            <h1 className="font-playfair text-[28px] font-[500] text-primary leading-tight">
              Application submitted
            </h1>
            <p className="font-public-sans text-[14px] text-muted-text leading-[1.7]">
              Thanks for applying to become a Solomon Bharat agent. Our team will review your
              application and get back to you by email.
            </p>
            <Link
              href="/"
              className="mt-2 inline-flex items-center justify-center h-11 px-8 bg-primary text-white text-[14px] font-[600] font-public-sans rounded hover:bg-primary/90 transition-colors"
            >
              Return to home
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <NavBar />

      <main className="flex-1">
        <div className="max-w-[560px] mx-auto w-full px-4 py-14 sm:py-20">
          <h1 className="font-playfair text-[32px] sm:text-[40px] font-[500] text-primary leading-[1.1] mb-3">
            Apply as an Agent
          </h1>
          <p className="font-public-sans text-[15px] text-muted-text leading-[1.7] mb-10">
            Tell us about your business. Our team reviews every application and will follow up by email.
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
            <div>
              <Label htmlFor="businessName">Business name</Label>
              <Input
                id="businessName"
                type="text"
                placeholder="e.g. Artisan Weaves Co."
                value={form.businessName}
                onChange={(e) => set('businessName', e.target.value)}
                disabled={applyAsAgent.isPending}
                className="mt-1.5"
              />
            </div>

            <div>
              <Label htmlFor="contactName">Contact name</Label>
              <Input
                id="contactName"
                type="text"
                placeholder="Your full name"
                value={form.contactName}
                onChange={(e) => set('contactName', e.target.value)}
                disabled={applyAsAgent.isPending}
                className="mt-1.5"
              />
            </div>

            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@yourbusiness.com"
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
                disabled={applyAsAgent.isPending}
                className="mt-1.5"
              />
            </div>

            <div>
              <Label htmlFor="phone">Phone number</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+91 98765 43210"
                value={form.phone}
                onChange={(e) => set('phone', e.target.value)}
                disabled={applyAsAgent.isPending}
                className="mt-1.5"
              />
            </div>

            <div>
              <Label htmlFor="businessAddress">Business address</Label>
              <textarea
                id="businessAddress"
                placeholder="Street, city, state, PIN code"
                value={form.businessAddress}
                onChange={(e) => set('businessAddress', e.target.value)}
                disabled={applyAsAgent.isPending}
                rows={3}
                className="mt-1.5 w-full rounded border border-border-warm bg-surface px-3 py-2 text-[14px] font-public-sans text-primary placeholder:text-muted-text/50 outline-none focus:border-accent transition-colors resize-none"
              />
            </div>

            <div>
              <Label htmlFor="country">Country</Label>
              <Input
                id="country"
                type="text"
                placeholder="e.g. India"
                value={form.country}
                onChange={(e) => set('country', e.target.value)}
                disabled={applyAsAgent.isPending}
                className="mt-1.5"
              />
            </div>

            <div>
              <Label htmlFor="message">
                Message <span className="text-muted-text font-[400]">(optional)</span>
              </Label>
              <textarea
                id="message"
                placeholder="Tell us a bit about your customer base and how you plan to resell"
                value={form.message}
                onChange={(e) => set('message', e.target.value)}
                disabled={applyAsAgent.isPending}
                rows={4}
                className="mt-1.5 w-full rounded border border-border-warm bg-surface px-3 py-2 text-[14px] font-public-sans text-primary placeholder:text-muted-text/50 outline-none focus:border-accent transition-colors resize-none"
              />
            </div>

            {validationError && (
              <p className="text-[13px] font-public-sans text-error" role="alert">{validationError}</p>
            )}

            <Button type="submit" variant="primary" size="lg" disabled={applyAsAgent.isPending} className="w-full mt-2">
              {applyAsAgent.isPending ? 'Submitting…' : 'Submit application'}
            </Button>
          </form>
        </div>
      </main>

      <Footer />
    </div>
  )
}
