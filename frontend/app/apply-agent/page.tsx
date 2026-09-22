'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Check, ArrowLeft, Shield, Clock, BadgeCheck } from 'lucide-react'
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
      <div className="min-h-screen bg-[#F9F7F2] flex flex-col">
        <NavBar />
        <main className="flex-1 flex items-center justify-center px-4 py-16">
          <div className="max-w-[480px] w-full text-center flex flex-col items-center gap-5">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
              <Check size={28} className="text-emerald-600" />
            </div>
            <div>
              <h1 className="font-sans text-[28px] font-[700] text-[#1A1A1A] leading-tight mb-2">
                Application submitted
              </h1>
              <p className="font-sans text-[14.5px] text-[#6B6460] leading-[1.7]">
                Thanks for applying to become a Solomon Bharat agent. Our team reviews every
                application and will get back to you by email within 3 business days.
              </p>
            </div>
            <div className="flex items-center gap-6 py-4 px-6 bg-white border border-[#E5E1D8] rounded-xl w-full">
              {[
                { icon: Clock, text: 'Response in 3 days' },
                { icon: Shield, text: 'Secure & confidential' },
                { icon: BadgeCheck, text: 'No fees required' },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex flex-col items-center gap-1.5 flex-1">
                  <Icon size={16} className="text-[#A68B67]" aria-hidden="true" />
                  <span className="text-[11px] font-[500] font-sans text-[#6B6460] text-center">{text}</span>
                </div>
              ))}
            </div>
            <Link
              href="/"
              className="inline-flex items-center justify-center h-11 px-8 bg-[#1A1A1A] text-white text-[14px] font-[700] font-sans rounded-lg hover:bg-[#2E2A24] transition-colors"
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
    <div className="min-h-screen bg-[#F9F7F2] flex flex-col">
      <NavBar />

      <main className="flex-1">
        <div className="max-w-[640px] mx-auto w-full px-4 py-12 sm:py-16">

          {/* Back link */}
          <Link
            href="/become-agent"
            className="inline-flex items-center gap-2 text-[13px] font-[500] font-sans text-[#9CA3AF] hover:text-[#6B6460] transition-colors mb-8"
          >
            <ArrowLeft size={14} aria-hidden="true" />
            Back to agent overview
          </Link>

          {/* Progress indicator */}
          <div className="flex items-center gap-0 mb-8">
            {[
              { num: 1, label: 'Application', active: true },
              { num: 2, label: 'Review', active: false },
              { num: 3, label: 'Onboarding', active: false },
            ].map(({ num, label, active }, i, arr) => (
              <div key={num} className="flex items-center">
                <div className="flex flex-col items-center gap-1.5">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-[700] font-sans ${active ? 'bg-[#A68B67] text-white' : 'bg-[#E5E1D8] text-[#9CA3AF]'}`}>
                    {num}
                  </div>
                  <span className={`text-[11px] font-[600] font-sans ${active ? 'text-[#A68B67]' : 'text-[#9CA3AF]'}`}>
                    {label}
                  </span>
                </div>
                {i < arr.length - 1 && (
                  <div className="w-20 h-0.5 bg-[#E5E1D8] mx-3 mb-5" />
                )}
              </div>
            ))}
          </div>

          {/* Page header */}
          <div className="mb-8">
            <p className="text-[11px] font-[700] font-sans text-[#A68B67] tracking-[0.1em] uppercase mb-2">
              Agent Application
            </p>
            <h1 className="font-sans text-[28px] font-[700] text-[#1A1A1A] leading-tight mb-2">
              Tell us about yourself
            </h1>
            <p className="font-sans text-[14.5px] text-[#6B6460] leading-[1.6]">
              This takes under 5 minutes. We review applications within 3 business days.
            </p>
          </div>

          {/* Info notice */}
          <div className="flex gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3.5 mb-6">
            <Shield size={15} className="text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
            <p className="text-[13px] font-sans text-amber-800 leading-[1.5]">
              All fields marked with <strong>*</strong> are required. Your information is kept confidential and only used for evaluation.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-0" noValidate>
            <div className="bg-white border border-[#E5E1D8] rounded-xl p-6 space-y-5">

              {/* Section: Personal info */}
              <p className="text-[11px] font-[700] font-sans text-[#A68B67] uppercase tracking-[0.08em] pb-1 border-b border-[#F5F0E8]">
                Personal information
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="businessName">Business name <span className="text-red-500">*</span></Label>
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
                  <Label htmlFor="contactName">Contact name <span className="text-red-500">*</span></Label>
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
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="email">Email <span className="text-red-500">*</span></Label>
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
                  <Label htmlFor="phone">Phone number <span className="text-red-500">*</span></Label>
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
              </div>

              {/* Section divider */}
              <p className="text-[11px] font-[700] font-sans text-[#A68B67] uppercase tracking-[0.08em] pb-1 border-b border-[#F5F0E8] pt-1">
                Location
              </p>

              <div>
                <Label htmlFor="businessAddress">Business address <span className="text-red-500">*</span></Label>
                <textarea
                  id="businessAddress"
                  placeholder="Street, city, state, PIN code"
                  value={form.businessAddress}
                  onChange={(e) => set('businessAddress', e.target.value)}
                  disabled={applyAsAgent.isPending}
                  rows={2}
                  className="mt-1.5 w-full rounded-lg border border-[#E5E1D8] bg-[#F9F7F2] px-3 py-2.5 text-[14px] font-sans text-[#1A1A1A] placeholder:text-[#9CA3AF] outline-none focus:border-[#A68B67] transition-colors resize-none"
                />
              </div>

              <div className="max-w-[260px]">
                <Label htmlFor="country">Country <span className="text-red-500">*</span></Label>
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

              {/* Section divider */}
              <p className="text-[11px] font-[700] font-sans text-[#A68B67] uppercase tracking-[0.08em] pb-1 border-b border-[#F5F0E8] pt-1">
                About your application
              </p>

              <div>
                <Label htmlFor="message">
                  Why do you want to become an agent?{' '}
                  <span className="text-[#9CA3AF] font-[400]">(optional)</span>
                </Label>
                <textarea
                  id="message"
                  placeholder="Tell us about your experience in crafts, trade, or sales, and why you're excited about this opportunity…"
                  value={form.message}
                  onChange={(e) => set('message', e.target.value)}
                  disabled={applyAsAgent.isPending}
                  rows={4}
                  className="mt-1.5 w-full rounded-lg border border-[#E5E1D8] bg-[#F9F7F2] px-3 py-2.5 text-[14px] font-sans text-[#1A1A1A] placeholder:text-[#9CA3AF] outline-none focus:border-[#A68B67] transition-colors resize-none"
                />
                <p className="text-[11.5px] font-sans text-[#9CA3AF] mt-1.5">Helps us process your application faster. Max 500 characters.</p>
              </div>

            </div>

            {validationError && (
              <p className="text-[13px] font-sans text-red-600 mt-4" role="alert">{validationError}</p>
            )}

            <div className="flex items-center justify-between mt-5 gap-4 flex-wrap">
              <p className="text-[12px] font-sans text-[#9CA3AF] leading-[1.5]">
                By submitting you agree to our{' '}
                <Link href="/terms" className="text-[#A68B67] hover:underline">Terms of Service</Link>
                {' '}and{' '}
                <Link href="/agent-agreement" className="text-[#A68B67] hover:underline">Agent Agreement</Link>.
              </p>
              <Button
                type="submit"
                variant="primary"
                size="lg"
                disabled={applyAsAgent.isPending}
                className="shrink-0"
              >
                {applyAsAgent.isPending ? 'Submitting…' : 'Submit application →'}
              </Button>
            </div>

            {/* Trust strip */}
            <div className="flex items-center gap-6 mt-5 pt-5 border-t border-[#E5E1D8]">
              {[
                { icon: Shield, text: 'Your data is secure' },
                { icon: Clock, text: 'Response within 3 days' },
                { icon: BadgeCheck, text: 'No upfront fees' },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-2">
                  <Icon size={14} className="text-[#A68B67]" aria-hidden="true" />
                  <span className="text-[12px] font-sans text-[#6B6460]">{text}</span>
                </div>
              ))}
            </div>
          </form>
        </div>
      </main>

      <Footer />
    </div>
  )
}
