'use client'

import { useState } from 'react'
import { X, Check } from 'lucide-react'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useApplyAsSeller } from '@/hooks/queries/useSellers'
import type { SellerApplyInput } from '@/types'

const EMPTY_FORM: SellerApplyInput = {
  businessName: '',
  contactName: '',
  email: '',
  phone: '',
  businessAddress: '',
  message: '',
}

const INPUT_CLS =
  'w-full h-10 px-3.5 rounded-lg border border-[#E5E1D8] bg-[#F9F7F2] text-[14px] font-sans text-[#1A1A1A] placeholder:text-[#C4BDB4] focus:outline-none focus:border-[#A68B67] transition-colors'

const TEXTAREA_CLS =
  'w-full px-3.5 py-2.5 rounded-lg border border-[#E5E1D8] bg-[#F9F7F2] text-[14px] font-sans text-[#1A1A1A] placeholder:text-[#C4BDB4] focus:outline-none focus:border-[#A68B67] transition-colors resize-none'

const LABEL_CLS =
  'block text-[11.5px] font-[700] font-sans text-[#6B6460] uppercase tracking-[0.07em] mb-1.5'

export function ApplyModal() {
  const isOpen = useAuthStore((s) => s.isApplyModalOpen)
  const closeApplyModal = useAuthStore((s) => s.closeApplyModal)

  const [form, setForm] = useState<SellerApplyInput>(EMPTY_FORM)
  const [validationError, setValidationError] = useState<string | null>(null)
  const applyAsSeller = useApplyAsSeller()

  function set<K extends keyof SellerApplyInput>(key: K, value: SellerApplyInput[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function handleClose() {
    if (applyAsSeller.isPending) return
    closeApplyModal()
    // Reset after close animation
    setTimeout(() => {
      setForm(EMPTY_FORM)
      setValidationError(null)
      applyAsSeller.reset()
    }, 200)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setValidationError(null)

    if (!form.businessName.trim()) return setValidationError('Business name is required.')
    if (!form.contactName.trim()) return setValidationError('Contact name is required.')
    if (!form.email.trim()) return setValidationError('Email is required.')
    if (!form.phone.trim()) return setValidationError('Phone number is required.')
    if (!form.businessAddress.trim()) return setValidationError('Business address is required.')

    applyAsSeller.mutate({
      businessName: form.businessName.trim(),
      contactName: form.contactName.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      businessAddress: form.businessAddress.trim(),
      message: form.message?.trim() || undefined,
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose() }}>
      <DialogContent className="max-w-[520px] w-full p-0 gap-0 overflow-hidden rounded-2xl border border-[#E5E1D8] shadow-2xl shadow-black/10">

        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-5 border-b border-[#E5E1D8]">
          <div>
            <h2 className="text-[20px] font-[700] font-sans text-[#1A1A1A] leading-tight">
              Apply as a Seller
            </h2>
            <p className="text-[13px] font-sans text-[#6B6460] mt-1">
              We review every application and follow up by email within 24–48 hours.
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={applyAsSeller.isPending}
            aria-label="Close"
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-[#E5E1D8] text-[#C4BDB4] hover:text-[#1A1A1A] hover:bg-[#F5F0E8] transition-colors shrink-0 ml-4 mt-0.5 disabled:opacity-40"
          >
            <X size={15} aria-hidden />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {applyAsSeller.isSuccess ? (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                <Check size={22} className="text-emerald-600" aria-hidden />
              </div>
              <div>
                <p className="text-[18px] font-[700] font-sans text-[#1A1A1A] leading-tight">
                  Application submitted
                </p>
                <p className="text-[13.5px] font-sans text-[#6B6460] mt-2 leading-[1.65] max-w-[320px]">
                  Thanks for applying. We&apos;ll review it and get back to you by email within two business days.
                </p>
              </div>
              <Button size="md" onClick={handleClose} className="mt-2">
                Done
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="apply-businessName" className={LABEL_CLS}>Business Name</label>
                  <input
                    id="apply-businessName"
                    type="text"
                    placeholder="e.g. Artisan Weaves Co."
                    value={form.businessName}
                    onChange={(e) => set('businessName', e.target.value)}
                    disabled={applyAsSeller.isPending}
                    className={INPUT_CLS}
                  />
                </div>
                <div>
                  <label htmlFor="apply-contactName" className={LABEL_CLS}>Contact Name</label>
                  <input
                    id="apply-contactName"
                    type="text"
                    placeholder="Your full name"
                    value={form.contactName}
                    onChange={(e) => set('contactName', e.target.value)}
                    disabled={applyAsSeller.isPending}
                    className={INPUT_CLS}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="apply-email" className={LABEL_CLS}>Email</label>
                  <input
                    id="apply-email"
                    type="email"
                    placeholder="you@yourbusiness.com"
                    value={form.email}
                    onChange={(e) => set('email', e.target.value)}
                    disabled={applyAsSeller.isPending}
                    className={INPUT_CLS}
                  />
                </div>
                <div>
                  <label htmlFor="apply-phone" className={LABEL_CLS}>Phone Number</label>
                  <input
                    id="apply-phone"
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={form.phone}
                    onChange={(e) => set('phone', e.target.value)}
                    disabled={applyAsSeller.isPending}
                    className={INPUT_CLS}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="apply-businessAddress" className={LABEL_CLS}>Business Address</label>
                <textarea
                  id="apply-businessAddress"
                  placeholder="Street, city, state, PIN code"
                  value={form.businessAddress}
                  onChange={(e) => set('businessAddress', e.target.value)}
                  disabled={applyAsSeller.isPending}
                  rows={2}
                  className={TEXTAREA_CLS}
                />
              </div>

              <div>
                <label htmlFor="apply-message" className={LABEL_CLS}>
                  About your products{' '}
                  <span className="text-[#9CA3AF] normal-case font-[500] tracking-normal">(optional)</span>
                </label>
                <textarea
                  id="apply-message"
                  placeholder="Tell us a bit about what you make and sell"
                  value={form.message}
                  onChange={(e) => set('message', e.target.value)}
                  disabled={applyAsSeller.isPending}
                  rows={3}
                  className={TEXTAREA_CLS}
                />
              </div>

              {validationError && (
                <p className="text-[13px] font-sans text-red-500" role="alert">
                  {validationError}
                </p>
              )}

              {applyAsSeller.isError && (
                <p className="text-[13px] font-sans text-red-500" role="alert">
                  Something went wrong — please try again.
                </p>
              )}

              <Button
                type="submit"
                size="md"
                disabled={applyAsSeller.isPending}
                className="w-full mt-1"
              >
                {applyAsSeller.isPending ? 'Submitting…' : 'Submit application'}
              </Button>

              <p className="text-[12px] font-sans text-[#9CA3AF] text-center -mt-1">
                Free to apply · No documents required · We&apos;ll follow up by email
              </p>
            </form>
          )}
        </div>

      </DialogContent>
    </Dialog>
  )
}
