'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useApplyAsSeller } from '@/hooks/queries/useSellers'
import { getApiError } from '@/lib/getApiError'
import { ApplySidebar } from '@/components/apply/ApplySidebar'
import { Step1Seller } from '@/components/apply/Step1Seller'
import { Step2Products } from '@/components/apply/Step2Products'
import { Step3ExportReadiness } from '@/components/apply/Step3ExportReadiness'
import { Step4FinalDetails } from '@/components/apply/Step4FinalDetails'
import { INITIAL_APPLY_WIZARD_STATE, type ApplyWizardState } from '@/components/apply/types'
import type { SellerApplyInput } from '@/types'

const TOTAL_STEPS = 4

function buildPayload(data: ApplyWizardState): SellerApplyInput {
  return {
    businessName: data.businessName.trim(),
    contactName: data.contactName.trim(),
    email: data.email.trim(),
    phone: data.phone.trim(),
    message: data.message.trim() || undefined,
    city: data.city.trim(),
    country: data.country,
    instagramHandle: data.instagramHandle.trim(),
    instagramFollowers: Number(data.instagramFollowers) || 0,
    websiteOrSocialLink: data.websiteOrSocialLink.trim() || undefined,
    craftCategories: data.craftCategories.length > 0 ? data.craftCategories : undefined,
    productDescription: data.productDescription.trim() || undefined,
    giTaggedProducts: data.giTaggedProducts || undefined,
    monthlySalesVolume: data.monthlySalesVolume || undefined,
    shippedInternationally: data.shippedInternationally ?? undefined,
    approxExportOrders: data.approxExportOrders || undefined,
    exportCountries: data.exportCountries.trim() || undefined,
    sellingOnAmazon: data.sellingOnAmazon || undefined,
    otherPlatforms: data.otherPlatforms.length > 0 ? data.otherPlatforms : undefined,
    gstRegistration: data.gstRegistration || undefined,
    companyIncorporation: data.companyIncorporation || undefined,
    iecStatus: data.iecStatus || undefined,
    businessType: data.businessType,
    hearAboutUs: data.hearAboutUs || undefined,
    agreedToCommissionTerms: data.agreedToCommissionTerms,
  }
}

function validateStep(step: number, data: ApplyWizardState): string | null {
  if (step === 1) {
    if (!data.businessName.trim()) return 'Enter your seller name.'
    if (!data.contactName.trim()) return 'Enter the founder / owner name.'
    if (!data.email.trim() || !data.email.includes('@')) return 'Enter a valid email address.'
    if (!data.phone.trim()) return 'Enter a WhatsApp / phone number.'
    if (!data.city.trim()) return 'Enter your city.'
    if (!data.country.trim()) return 'Select your country.'
    if (!data.instagramHandle.trim()) return 'Enter your Instagram handle.'
    if (!data.instagramFollowers.trim() || Number(data.instagramFollowers) < 0) return 'Enter your Instagram follower count.'
  }
  if (step === 4) {
    if (!data.businessType) return 'Select what best describes you.'
    if (!data.agreedToCommissionTerms) return 'Please agree to the commission structure to continue.'
  }
  return null
}

export default function ApplyPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [data, setData] = useState<ApplyWizardState>(INITIAL_APPLY_WIZARD_STATE)
  const [error, setError] = useState<string | null>(null)
  const applyAsSeller = useApplyAsSeller()

  function patch(fields: Partial<ApplyWizardState>) {
    setData((d) => ({ ...d, ...fields }))
  }

  function goNext() {
    const validationError = validateStep(step, data)
    if (validationError) { setError(validationError); return }
    setError(null)
    if (step === TOTAL_STEPS) {
      applyAsSeller.mutate(buildPayload(data))
      return
    }
    setStep((s) => s + 1)
  }

  function goBack() {
    setError(null)
    setStep((s) => Math.max(1, s - 1))
  }

  const apiError = applyAsSeller.error ? getApiError(applyAsSeller.error) : null
  const displayError = error ?? apiError

  return (
    <div className="bg-bg min-h-screen py-10 sm:py-14 px-4">
      <div className="max-w-[900px] mx-auto">
        {!applyAsSeller.isSuccess && (
          <div className="text-center mb-8">
            <p className="text-[11px] font-[700] font-sans uppercase tracking-[0.12em] mb-3 text-accent">
              Onboarding interest form
            </p>
            <h1 className="font-display font-[700] text-primary text-[28px] sm:text-[36px] leading-[1.1]">
              Apply to sell your product
            </h1>
            <p className="font-sans text-[14px] text-muted-text mt-3 max-w-[520px] mx-auto">
              Takes 4–5 minutes · Confidential · We review within 48 hours · Selected sellers get invited to our{' '}
              <strong className="text-primary font-[600]">launch event</strong>.
            </p>
          </div>
        )}

        <div className="rounded-2xl overflow-hidden shadow-xl shadow-black/5 border border-border-warm bg-surface flex">
          <ApplySidebar step={step} />

          <div className="flex-1 flex flex-col min-w-0">
            {applyAsSeller.isSuccess ? (
              <div className="flex flex-col items-center text-center gap-4 py-16 px-8">
                <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                  <Check size={24} className="text-emerald-600" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-[20px] font-[700] font-sans text-primary leading-tight">Application submitted</p>
                  <p className="text-[14px] font-sans text-muted-text mt-2 leading-[1.65] max-w-[360px]">
                    Thanks for applying to Solomon Bharat. We&apos;ll review your application and follow up by email
                    within 48 hours.
                  </p>
                </div>
                <Button size="md" onClick={() => router.push('/')} className="mt-2">
                  Back to home
                </Button>
              </div>
            ) : (
              <>
                <div className="h-[3px] bg-muted-bg flex-shrink-0">
                  <div
                    className="h-full bg-accent transition-all duration-300"
                    style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
                  />
                </div>

                <div className="flex-1 p-6 sm:p-9">
                  {step === 1 && <Step1Seller data={data} patch={patch} />}
                  {step === 2 && <Step2Products data={data} patch={patch} />}
                  {step === 3 && <Step3ExportReadiness data={data} patch={patch} />}
                  {step === 4 && <Step4FinalDetails data={data} patch={patch} />}

                  {displayError && (
                    <p className="text-[13px] font-sans text-red-600 mt-5" role="alert">{displayError}</p>
                  )}
                </div>

                <div className="border-t border-border-warm px-6 sm:px-9 py-4 flex items-center justify-between flex-shrink-0">
                  {step > 1 ? (
                    <button
                      type="button"
                      onClick={goBack}
                      disabled={applyAsSeller.isPending}
                      className="text-[13.5px] font-[600] font-sans text-muted-text hover:text-primary transition-colors disabled:opacity-50"
                    >
                      ← Back
                    </button>
                  ) : (
                    <Link href="/sell" className="text-[13.5px] font-[600] font-sans text-muted-text hover:text-primary transition-colors">
                      ← Back
                    </Link>
                  )}
                  <span className="font-sans text-[12.5px] text-muted-text">{step} / {TOTAL_STEPS}</span>
                  <button
                    type="button"
                    onClick={goNext}
                    disabled={applyAsSeller.isPending}
                    className="h-11 px-6 rounded-full text-[13.5px] font-[700] font-sans text-white bg-forest hover:bg-[#0F241D] transition-colors disabled:opacity-50"
                  >
                    {applyAsSeller.isPending
                      ? 'Submitting…'
                      : step === TOTAL_STEPS
                        ? 'Submit application 🚀'
                        : 'Continue →'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
