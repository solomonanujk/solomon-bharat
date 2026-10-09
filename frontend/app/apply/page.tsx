'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useApplyAsSeller } from '@/hooks/queries/useSellers'
import { getApiError } from '@/lib/getApiError'
import { MARKETPLACE_COMMISSION_TERMS_VERSION } from '@/lib/sellerCommission'
import { ApplySidebar } from '@/components/apply/ApplySidebar'
import { StepSellerType } from '@/components/apply/StepSellerType'
import { Step1Seller } from '@/components/apply/Step1Seller'
import { Step2Products } from '@/components/apply/Step2Products'
import { Step3ExportReadiness } from '@/components/apply/Step3ExportReadiness'
import { Step4FinalDetails } from '@/components/apply/Step4FinalDetails'
import {
  MarketplaceStepBrand,
  MarketplaceStepBusiness,
  MarketplaceStepReview,
  MarketplaceStepTerms,
} from '@/components/apply/MarketplaceSteps'
import {
  INITIAL_APPLY_WIZARD_STATE,
  type ApplyWizardState,
  type FieldErrors,
} from '@/components/apply/types'
import type { SellerApplyInput } from '@/types'

const TOTAL_STEPS = 4

function buildCuratedPayload(data: ApplyWizardState): SellerApplyInput {
  return {
    sellerType: 'CURATED',
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

function buildMarketplacePayload(data: ApplyWizardState): SellerApplyInput {
  return {
    sellerType: 'MARKETPLACE',
    brandName: data.brandName.trim(),
    brandLogoUrl: data.brandLogoUrl.trim() || undefined,
    brandStory: data.brandStory.trim() || undefined,
    brandWebsite: data.brandWebsite.trim() || undefined,
    minOrderValueInr: Number(data.minOrderValueInr),
    commissionTermsVersion: MARKETPLACE_COMMISSION_TERMS_VERSION,
    agreedToCommissionTerms: data.agreedToCommissionTerms,
    businessName: data.businessName.trim(),
    contactName: data.contactName.trim(),
    email: data.email.trim(),
    phone: data.phone.trim(),
    city: data.city.trim(),
    country: data.country,
    businessType: data.businessType,
    craftCategories: data.craftCategories.length > 0 ? data.craftCategories : undefined,
  }
}

function validateCuratedStep(step: number, data: ApplyWizardState): string | null {
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

function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

function validateMarketplaceStep(step: number, data: ApplyWizardState): FieldErrors {
  const e: FieldErrors = {}
  if (step === 1) {
    const name = data.brandName.trim()
    if (name.length < 2 || name.length > 60) e.brandName = 'Enter your brand name (2 to 60 characters).'
    const min = data.minOrderValueInr.trim()
    if (!min || !Number.isFinite(Number(min)) || Number(min) < 0) {
      e.minOrderValueInr = 'Enter a minimum order value in INR (0 or more).'
    }
    if (data.brandStory.trim().length > 1000) e.brandStory = 'Keep your story under 1000 characters.'
    if (data.brandWebsite.trim() && !isHttpUrl(data.brandWebsite.trim())) {
      e.brandWebsite = 'Enter a full link starting with https://'
    }
    if (data.brandLogoUrl.trim() && !isHttpUrl(data.brandLogoUrl.trim())) {
      e.brandLogoUrl = 'Enter a full link starting with https://, or leave this empty.'
    }
  }
  if (step === 2) {
    if (!data.businessName.trim()) e.businessName = 'Enter your business or legal name.'
    if (!data.contactName.trim()) e.contactName = 'Enter a contact name.'
    if (!data.email.trim() || !/^\S+@\S+\.\S+$/.test(data.email.trim())) e.email = 'Enter a valid email address.'
    if (!data.phone.trim()) e.phone = 'Enter a WhatsApp / phone number.'
    if (!data.city.trim()) e.city = 'Enter your city.'
    if (!data.country.trim()) e.country = 'Select your country.'
    if (!data.businessType) e.businessType = 'Select what best describes you.'
  }
  if (step === 3) {
    if (!data.agreedToCommissionTerms) e.agreedToCommissionTerms = 'Agree to the commission terms to continue.'
  }
  return e
}

export default function ApplyPage() {
  const router = useRouter()
  // 0 = "How do you want to sell?"; 1..TOTAL_STEPS = the path's steps.
  const [step, setStep] = useState(0)
  const [data, setData] = useState<ApplyWizardState>(INITIAL_APPLY_WIZARD_STATE)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const applyAsSeller = useApplyAsSeller()
  const panelRef = useRef<HTMLDivElement>(null)
  const firstRender = useRef(true)

  const isMarketplace = data.sellerType === 'MARKETPLACE'

  // Move focus to the new step's panel on step change (not on first paint).
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return }
    panelRef.current?.focus()
  }, [step])

  function patch(fields: Partial<ApplyWizardState>) {
    setData((d) => ({ ...d, ...fields }))
    if (error) setError(null)
    const keys = Object.keys(fields).filter((k) => fieldErrors[k])
    if (keys.length > 0) {
      setFieldErrors((prev) => {
        const next = { ...prev }
        for (const k of keys) delete next[k]
        return next
      })
    }
  }

  function focusField(id: string) {
    setTimeout(() => document.getElementById(id)?.focus(), 0)
  }

  function submit() {
    applyAsSeller.mutate(isMarketplace ? buildMarketplacePayload(data) : buildCuratedPayload(data))
  }

  function goNext() {
    if (step === 0) {
      if (!data.sellerType) { setError('Choose how you want to sell to continue.'); focusField('sellerType-group'); return }
      setError(null)
      setStep(1)
      return
    }

    if (isMarketplace) {
      const errs = validateMarketplaceStep(step, data)
      // The review step re-checks everything so a skipped/edited step can't slip through.
      if (step === TOTAL_STEPS) {
        for (const s of [1, 2, 3]) {
          const stepErrs = validateMarketplaceStep(s, data)
          if (Object.keys(stepErrs).length > 0) {
            setFieldErrors(stepErrs)
            setError('Some details need fixing before you can submit.')
            setStep(s)
            return
          }
        }
        setFieldErrors({})
        setError(null)
        submit()
        return
      }
      const first = Object.keys(errs)[0]
      if (first) {
        setFieldErrors(errs)
        setError(`Please fix ${Object.keys(errs).length === 1 ? 'the highlighted field' : 'the highlighted fields'} to continue.`)
        focusField(first)
        return
      }
      setFieldErrors({})
      setError(null)
      setStep((s) => s + 1)
      return
    }

    const validationError = validateCuratedStep(step, data)
    if (validationError) { setError(validationError); return }
    setError(null)
    if (step === TOTAL_STEPS) {
      submit()
      return
    }
    setStep((s) => s + 1)
  }

  function goBack() {
    setError(null)
    setFieldErrors({})
    setStep((s) => Math.max(0, s - 1))
  }

  function switchType() {
    setError(null)
    setFieldErrors({})
    setStep(0)
  }

  const apiError = applyAsSeller.error ? getApiError(applyAsSeller.error) : null
  const displayError = error ?? apiError

  return (
    <div className="bg-bg min-h-screen py-10 sm:py-14 px-4">
      <div className="max-w-[900px] mx-auto">
        {!applyAsSeller.isSuccess && (
          <div className="text-center mb-8">
            <p className="text-[11px] font-[700] font-sans uppercase tracking-[0.12em] mb-3 text-brass-dark">
              {isMarketplace ? 'Brand application' : 'Onboarding interest form'}
            </p>
            <h1 className="font-display font-[700] text-primary text-[28px] sm:text-[36px] leading-[1.1]">
              {isMarketplace ? 'Apply to sell your brand' : 'Apply to sell your product'}
            </h1>
            <p className="font-sans text-[14px] text-muted-text mt-3 max-w-[520px] mx-auto">
              Takes 4–5 minutes · Confidential · We review within 48 hours
              {!isMarketplace && (
                <>
                  {' '}· Selected sellers get invited to our <strong className="text-primary font-[600]">launch event</strong>
                </>
              )}
              .
            </p>
          </div>
        )}

        <div className="rounded-2xl overflow-hidden shadow-xl shadow-black/5 border border-border-warm bg-surface flex">
          <ApplySidebar step={step} sellerType={data.sellerType} />

          <div className="flex-1 flex flex-col min-w-0">
            {applyAsSeller.isSuccess ? (
              <div className="flex flex-col items-center text-center gap-4 py-16 px-6 sm:px-8" role="status">
                <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                  <Check size={24} className="text-emerald-600" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-[20px] font-[700] font-sans text-primary leading-tight">Application received</p>
                  {isMarketplace ? (
                    <p className="text-[14px] font-sans text-muted-text mt-2 leading-[1.65] max-w-[400px]">
                      Thanks for applying to sell {data.brandName.trim() ? `${data.brandName.trim()} ` : 'your brand '}
                      on Solomon Bharat. Our team will review your application and email you a decision within 48
                      hours. Your brand account is only created if your application is approved.
                    </p>
                  ) : (
                    <p className="text-[14px] font-sans text-muted-text mt-2 leading-[1.65] max-w-[360px]">
                      Thanks for applying to Solomon Bharat. We&apos;ll review your application and follow up by email
                      within 48 hours.
                    </p>
                  )}
                </div>
                <Button size="md" onClick={() => router.push('/')} className="mt-2">
                  Back to home
                </Button>
              </div>
            ) : (
              <>
                <div className="h-[3px] bg-muted-bg flex-shrink-0" aria-hidden="true">
                  <div
                    className="h-full bg-accent transition-all duration-300"
                    style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
                  />
                </div>

                <div ref={panelRef} tabIndex={-1} className="flex-1 p-5 sm:p-9 outline-none">
                  {step === 0 && (
                    <div id="sellerType-group" tabIndex={-1} className="outline-none">
                      <StepSellerType data={data} patch={patch} />
                    </div>
                  )}

                  {step > 0 && (
                    <p className="mb-5 font-sans text-[13px] text-muted-text">
                      {isMarketplace ? 'Selling on the marketplace.' : 'Curated by Solomon Bharat.'}{' '}
                      <button
                        type="button"
                        onClick={switchType}
                        className="inline-flex min-h-11 items-center font-[600] text-forest underline underline-offset-4 hover:text-forest-hover"
                      >
                        {isMarketplace ? 'Switch to curated' : 'Switch to marketplace'}
                      </button>
                    </p>
                  )}

                  {isMarketplace ? (
                    <>
                      {step === 1 && <MarketplaceStepBrand data={data} patch={patch} errors={fieldErrors} />}
                      {step === 2 && <MarketplaceStepBusiness data={data} patch={patch} errors={fieldErrors} />}
                      {step === 3 && <MarketplaceStepTerms data={data} patch={patch} errors={fieldErrors} />}
                      {step === 4 && <MarketplaceStepReview data={data} patch={patch} onEdit={setStep} />}
                    </>
                  ) : (
                    data.sellerType === 'CURATED' && (
                      <>
                        {step === 1 && <Step1Seller data={data} patch={patch} />}
                        {step === 2 && <Step2Products data={data} patch={patch} />}
                        {step === 3 && <Step3ExportReadiness data={data} patch={patch} />}
                        {step === 4 && <Step4FinalDetails data={data} patch={patch} />}
                      </>
                    )
                  )}

                  {displayError && (
                    <p className="text-[13px] font-sans text-error mt-5" role="alert">{displayError}</p>
                  )}
                </div>

                <div className="border-t border-border-warm px-5 sm:px-9 py-4 flex items-center justify-between gap-3 flex-shrink-0">
                  {step > 0 ? (
                    <button
                      type="button"
                      onClick={goBack}
                      disabled={applyAsSeller.isPending}
                      className="min-h-11 px-1 text-[13.5px] font-[600] font-sans text-muted-text hover:text-primary transition-colors disabled:opacity-50"
                    >
                      ← Back
                    </button>
                  ) : (
                    <Link href="/sell" className="inline-flex min-h-11 items-center px-1 text-[13.5px] font-[600] font-sans text-muted-text hover:text-primary transition-colors">
                      ← Back
                    </Link>
                  )}
                  {step > 0 && <span className="font-sans text-[12.5px] text-muted-text">{step} / {TOTAL_STEPS}</span>}
                  <button
                    type="button"
                    onClick={goNext}
                    disabled={applyAsSeller.isPending}
                    className="h-12 px-6 rounded-full text-[13.5px] font-[700] font-sans text-white bg-forest hover:bg-forest-hover transition-colors disabled:opacity-50"
                  >
                    {applyAsSeller.isPending
                      ? 'Submitting…'
                      : step === TOTAL_STEPS
                        ? 'Submit application'
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
