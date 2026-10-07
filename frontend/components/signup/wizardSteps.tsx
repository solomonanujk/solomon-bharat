'use client'

import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { COUNTRIES } from '@/lib/countries'
import { LANGUAGES } from '@/lib/languages'

// ─── Faire-style buyer onboarding wizard — shared steps ────────────────────────
// Step 1 (email capture, "Unlock wholesale pricing") lives in the auth modal
// (components/shared/SignupEmailGate.tsx) since that's the gate that opens it.
// Steps 2–7 live on a full page (app/signup/page.tsx), matching Faire's own
// flow: only the initial email gate is a modal, everything after is a real
// page with its own URL. Both share the types/constants/step components here.
//
// Only email/password/name/country map to real, pre-existing account fields —
// everything from "business type" onward (businessType, businessOpenedYear,
// website, hearAboutUs, preferredLanguage, marketingOptOut) is a Faire-parity
// field added specifically for this wizard (BuyerProfile, see prisma schema).
// "I'm just shopping for myself" and "I don't have a website" skip the
// business-specific steps rather than blocking on them.

export const BUSINESS_TYPES = [
  { value: 'brick_and_mortar', label: 'Brick and mortar store', hint: 'A permanent retail location' },
  { value: 'online', label: 'Online', hint: 'My website or social channel' },
  { value: 'pop_up', label: 'Pop-up shop', hint: 'A temporary retail location' },
  { value: 'somewhere_else', label: 'Somewhere else', hint: '' },
] as const

const CURRENT_YEAR = new Date().getFullYear()
export const YEAR_OPTIONS = [
  'Opening soon',
  String(CURRENT_YEAR),
  String(CURRENT_YEAR - 1),
  String(CURRENT_YEAR - 2),
  String(CURRENT_YEAR - 3),
  String(CURRENT_YEAR - 4),
  String(CURRENT_YEAR - 5),
  `Before ${CURRENT_YEAR - 5}`,
]

export const HEAR_ABOUT_OPTIONS = [
  'Word of mouth', 'Instagram, Facebook', 'Search', 'Audio, podcast', 'Trade show', 'Blog, news article', 'Other',
]

/** Steps 2–7 on the full page — step 1 (email) is the modal, not counted here. */
export const TOTAL_PAGE_STEPS = 6

export interface WizardState {
  email: string
  password: string
  firstName: string
  lastName: string
  country: string
  language: string
  marketingOptOut: boolean
  businessType: string
  businessOpenedYear: string
  businessName: string
  website: string
  hearAboutUs: string[]
}

export function initialWizardState(email = ''): WizardState {
  return {
    email, password: '', firstName: '', lastName: '', country: '', language: 'English (US)',
    marketingOptOut: false, businessType: '', businessOpenedYear: '', businessName: '', website: '',
    hearAboutUs: [],
  }
}

export const INPUT_CLS =
  'w-full h-11 px-3.5 rounded-lg border border-border-warm bg-surface text-[14px] font-sans text-primary placeholder:text-muted-text/50 focus:outline-none focus:border-accent transition-colors disabled:opacity-50'
export const LABEL_CLS = 'block text-[13px] font-[500] font-sans text-primary mb-1.5'

// ─── Step 2 — name, password, country, language ────────────────────────────────

export function Step2Welcome({ data, patch, onNext, error }: {
  data: WizardState
  patch: (f: Partial<WizardState>) => void
  onNext: () => void
  error: string | null
}) {
  const [showPassword, setShowPassword] = useState(false)

  return (
    <div className="flex flex-col flex-1">
      <h2 className="text-[22px] font-[600] font-display text-primary mb-1">Welcome! Let&apos;s get started</h2>
      <p className="text-[13.5px] font-sans text-muted-text mb-6">Tell us a bit about yourself.</p>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <label htmlFor="wizard-first-name" className={LABEL_CLS}>First name</label>
          <input id="wizard-first-name" type="text" autoComplete="given-name" value={data.firstName}
            onChange={(e) => patch({ firstName: e.target.value })} className={INPUT_CLS} />
        </div>
        <div>
          <label htmlFor="wizard-last-name" className={LABEL_CLS}>Last name</label>
          <input id="wizard-last-name" type="text" autoComplete="family-name" value={data.lastName}
            onChange={(e) => patch({ lastName: e.target.value })} className={INPUT_CLS} />
        </div>
      </div>

      <div className="mb-1">
        <label htmlFor="wizard-password" className={LABEL_CLS}>Password</label>
        <div className="relative">
          <input
            id="wizard-password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            value={data.password}
            onChange={(e) => patch({ password: e.target.value })}
            className={cn(INPUT_CLS, 'pr-10')}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-text hover:text-primary transition-colors"
          >
            {showPassword ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
          </button>
        </div>
      </div>
      <p className="text-[11.5px] font-sans text-muted-text mb-4">8 characters minimum</p>

      <div className="mb-4">
        <label htmlFor="wizard-country" className={LABEL_CLS}>Country/Region</label>
        <select id="wizard-country" value={data.country} onChange={(e) => patch({ country: e.target.value })} className={INPUT_CLS}>
          <option value="">Select a country…</option>
          {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div className="mb-4">
        <label htmlFor="wizard-language" className={LABEL_CLS}>Language</label>
        <select id="wizard-language" value={data.language} onChange={(e) => patch({ language: e.target.value })} className={INPUT_CLS}>
          {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
      </div>

      <label className="flex items-start gap-2.5 mb-4 cursor-pointer">
        <input
          type="checkbox"
          checked={data.marketingOptOut}
          onChange={(e) => patch({ marketingOptOut: e.target.checked })}
          className="w-4 h-4 mt-0.5 rounded border-border-warm accent-primary flex-shrink-0"
        />
        <span className="text-[12.5px] font-sans text-muted-text leading-[1.4]">
          Opt out of emails with the latest from Solomon Bharat. You can change your preferences anytime.
        </span>
      </label>

      {error && <p className="text-[12.5px] font-sans text-error mb-3">{error}</p>}

      <button
        type="button"
        onClick={onNext}
        className="w-full h-11 rounded-lg bg-primary text-white text-[14px] font-[600] font-sans hover:bg-primary/90 transition-colors mt-1"
      >
        Next
      </button>
    </div>
  )
}

// ─── Step 3 — business type ────────────────────────────────────────────────────

export function Step3BusinessType({ data, patch, onNext, onShoppingForMyself }: {
  data: WizardState
  patch: (f: Partial<WizardState>) => void
  onNext: () => void
  onShoppingForMyself: () => void
}) {
  return (
    <div className="flex flex-col flex-1">
      <h2 className="text-[22px] font-[600] font-display text-primary mb-6 leading-tight">
        Which best describes your business?
      </h2>

      <div className="flex flex-col gap-3 mb-6">
        {BUSINESS_TYPES.map((t) => {
          const selected = data.businessType === t.value
          return (
            <button
              key={t.value}
              type="button"
              onClick={() => patch({ businessType: t.value })}
              className={cn(
                'flex items-center justify-between gap-3 text-left px-4 py-3.5 rounded-lg border transition-colors',
                selected ? 'border-primary bg-muted-bg' : 'border-border-warm hover:border-primary/40'
              )}
            >
              <span>
                <span className="block text-[14px] font-[500] font-sans text-primary">{t.label}</span>
                {t.hint && <span className="block text-[12.5px] font-sans text-muted-text mt-0.5">{t.hint}</span>}
              </span>
              <span className={cn(
                'w-5 h-5 rounded flex items-center justify-center border flex-shrink-0',
                selected ? 'bg-primary border-primary text-white' : 'border-border-warm'
              )}>
                {selected && '✓'}
              </span>
            </button>
          )
        })}
      </div>

      <button
        type="button"
        onClick={onNext}
        disabled={!data.businessType}
        className="w-full h-11 rounded-lg bg-primary text-white text-[14px] font-[600] font-sans hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Next
      </button>

      <button
        type="button"
        onClick={onShoppingForMyself}
        className="text-[13px] font-sans text-muted-text underline hover:text-primary transition-colors text-center mt-4"
      >
        I&apos;m just shopping for myself
      </button>
    </div>
  )
}

// ─── Step 4 — when did the business open ───────────────────────────────────────

export function Step4OpenedYear({ data, patch, onNext }: {
  data: WizardState
  patch: (f: Partial<WizardState>) => void
  onNext: () => void
}) {
  return (
    <div className="flex flex-col flex-1">
      <h2 className="text-[22px] font-[600] font-display text-primary mb-6">When did your business open?</h2>

      <div className="grid grid-cols-2 gap-2.5 mb-6">
        {YEAR_OPTIONS.map((y) => {
          const selected = data.businessOpenedYear === y
          return (
            <button
              key={y}
              type="button"
              onClick={() => patch({ businessOpenedYear: y })}
              className={cn(
                'h-11 px-3 rounded-lg border text-[14px] font-sans text-primary transition-colors',
                selected ? 'border-primary bg-muted-bg font-[600]' : 'border-border-warm hover:border-primary/40'
              )}
            >
              {y}
            </button>
          )
        })}
      </div>

      <button
        type="button"
        onClick={onNext}
        disabled={!data.businessOpenedYear}
        className="w-full h-11 rounded-lg bg-primary text-white text-[14px] font-[600] font-sans hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Next
      </button>
    </div>
  )
}

// ─── Step 5 — business name ─────────────────────────────────────────────────────

export function Step5BusinessName({ data, patch, onNext, error }: {
  data: WizardState
  patch: (f: Partial<WizardState>) => void
  onNext: () => void
  error: string | null
}) {
  return (
    <div className="flex flex-col flex-1">
      <h2 className="text-[22px] font-[600] font-display text-primary mb-1">What&apos;s your business name?</h2>
      <p className="text-[13.5px] font-sans text-muted-text mb-6">We&apos;ll use your business info to build your profile.</p>

      <div className="mb-1">
        <label htmlFor="wizard-business-name" className={LABEL_CLS}>Business name</label>
        <input
          id="wizard-business-name"
          type="text"
          placeholder="Enter the business name"
          value={data.businessName}
          onChange={(e) => patch({ businessName: e.target.value })}
          className={INPUT_CLS}
        />
      </div>
      {error && <p className="text-[12.5px] font-sans text-error mb-3 mt-2">{error}</p>}

      <button
        type="button"
        onClick={onNext}
        disabled={!data.businessName.trim()}
        className="w-full h-11 rounded-lg bg-primary text-white text-[14px] font-[600] font-sans hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed mt-4"
      >
        Next
      </button>
    </div>
  )
}

// ─── Step 6 — website ───────────────────────────────────────────────────────────

export function Step6Website({ data, patch, onNext, onNoWebsite }: {
  data: WizardState
  patch: (f: Partial<WizardState>) => void
  onNext: () => void
  onNoWebsite: () => void
}) {
  return (
    <div className="flex flex-col flex-1">
      <h2 className="text-[22px] font-[600] font-display text-primary mb-1">What&apos;s your website?</h2>
      <p className="text-[13.5px] font-sans text-muted-text mb-6">This helps us learn more about your business.</p>

      <div className="mb-1">
        <label htmlFor="wizard-website" className={LABEL_CLS}>Your website</label>
        <input
          id="wizard-website"
          type="text"
          placeholder="https://www.yourstore.com/"
          value={data.website}
          onChange={(e) => patch({ website: e.target.value })}
          className={INPUT_CLS}
        />
        <p className="text-[11.5px] font-sans text-muted-text mt-1">Enter your full domain (e.g., mystore.com)</p>
      </div>

      <button
        type="button"
        onClick={onNext}
        className="w-full h-11 rounded-lg bg-primary text-white text-[14px] font-[600] font-sans hover:bg-primary/90 transition-colors mt-4"
      >
        Next
      </button>

      <button
        type="button"
        onClick={onNoWebsite}
        className="text-[13px] font-sans text-muted-text underline hover:text-primary transition-colors text-center mt-4"
      >
        I don&apos;t have a website
      </button>
    </div>
  )
}

// ─── Step 7 — how did you hear about us, then submit ───────────────────────────

export function Step7HearAboutUs({ data, patch, onSubmit, loading, error }: {
  data: WizardState
  patch: (f: Partial<WizardState>) => void
  onSubmit: (hearAboutUs: string[]) => void
  loading: boolean
  error: string | null
}) {
  function toggle(option: string) {
    const next = data.hearAboutUs.includes(option)
      ? data.hearAboutUs.filter((o) => o !== option)
      : [...data.hearAboutUs, option]
    patch({ hearAboutUs: next })
  }

  return (
    <div className="flex flex-col flex-1">
      <h2 className="text-[22px] font-[600] font-display text-primary mb-6 leading-tight">
        One last thing — how did you hear about Solomon Bharat?
      </h2>

      <div className="flex flex-col gap-2.5 mb-6">
        {HEAR_ABOUT_OPTIONS.map((option) => {
          const checked = data.hearAboutUs.includes(option)
          return (
            <button
              key={option}
              type="button"
              onClick={() => toggle(option)}
              className={cn(
                'flex items-center justify-between gap-3 text-left px-4 py-3 rounded-lg border transition-colors',
                checked ? 'border-primary' : 'border-border-warm hover:border-primary/40'
              )}
            >
              <span className="text-[14px] font-sans text-primary">{option}</span>
              <span className={cn(
                'w-5 h-5 rounded flex items-center justify-center border flex-shrink-0',
                checked ? 'bg-primary border-primary text-white' : 'border-border-warm'
              )}>
                {checked && '✓'}
              </span>
            </button>
          )
        })}
      </div>

      {error && <p className="text-[12.5px] font-sans text-error mb-3">{error}</p>}

      <button
        type="button"
        onClick={() => onSubmit(data.hearAboutUs)}
        disabled={loading}
        className="w-full h-11 rounded-lg bg-primary text-white text-[14px] font-[600] font-sans hover:bg-primary/90 transition-colors disabled:opacity-60"
      >
        {loading ? 'Creating account…' : 'Start buying'}
      </button>
    </div>
  )
}
