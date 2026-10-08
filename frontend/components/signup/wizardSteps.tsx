'use client'

import { useState, type InputHTMLAttributes } from 'react'
import { AlertCircle, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { COUNTRIES } from '@/lib/countries'
import { LANGUAGES } from '@/lib/languages'
import { Button } from '@/components/ui/button'

// ─── Buyer onboarding wizard — shared steps ────────────────────────────────────
// Step 1 (email capture) is SignupEmailGate — shown in the auth modal as a
// shortcut, or inline on /signup when the page is visited directly. Steps 2–7
// live on the full page (app/signup/page.tsx). Both share the types, form
// styles and step components here.
//
// Only email/password/name/country map to core account fields — everything
// from "business type" onward (businessType, businessOpenedYear, website,
// hearAboutUs, preferredLanguage, marketingOptOut) is optional BuyerProfile
// data (see backend auth.validation.ts signupBuyerSchema). "I'm just shopping
// for myself" and "I don't have a website" skip the business-specific steps.

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

/** Steps 2–7 on the full page — step 1 (email) is not counted here. */
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

// ─── Form styling (spec §4) ────────────────────────────────────────────────────
// Label 14/20/600 with 8px gap; input min-h 48px, 16/24, white, 1px line
// border, 4px radius; helper/error 6px below; errors #A32929 text + border.

export const INPUT_CLS =
  'w-full min-h-12 px-4 py-3 rounded-[4px] border border-line bg-white font-sans text-[16px] leading-[24px] text-ink placeholder:text-muted/70 transition-colors duration-150 focus:border-forest disabled:opacity-50 aria-[invalid=true]:border-error'
export const LABEL_CLS = 'block font-sans text-[14px] leading-[20px] font-[600] text-ink mb-2'
export const HELP_CLS = 'mt-[6px] font-sans text-[13px] leading-[20px] text-muted'
export const STEP_HEADING_CLS = 'type-h3 text-ink'

/** Field-linked error. Give it the id the input references via aria-describedby. */
export function FieldError({ id, message }: { id: string; message?: string | null }) {
  if (!message) return null
  return (
    <p id={id} role="alert" className="mt-[6px] flex items-start gap-1.5 font-sans text-[13px] leading-[20px] text-error">
      <AlertCircle size={14} className="mt-[3px] flex-shrink-0" aria-hidden="true" />
      {message}
    </p>
  )
}

/** Form-level error (API failures etc.), announced on submit. */
export function FormError({ message }: { message?: string | null }) {
  if (!message) return null
  return (
    <div role="alert" className="flex items-start gap-2 rounded-[4px] border border-error bg-white px-4 py-3 font-sans text-[14px] leading-[20px] text-error">
      <AlertCircle size={16} className="mt-[2px] flex-shrink-0" aria-hidden="true" />
      {message}
    </div>
  )
}

/** Password input with an explicit, labelled Show/Hide toggle (44px target). */
export function PasswordInput({
  id, invalid, describedBy, className, ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  id: string
  invalid?: boolean
  describedBy?: string
}) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input
        id={id}
        type={show ? 'text' : 'password'}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        className={cn(INPUT_CLS, 'pr-[72px]', className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        aria-controls={id}
        aria-pressed={show}
        aria-label={show ? 'Hide password' : 'Show password'}
        className="absolute right-1 top-1/2 -translate-y-1/2 min-h-11 min-w-11 px-3 rounded-[4px] font-sans text-[14px] leading-[20px] font-[600] text-forest underline underline-offset-4 hover:text-forest-hover transition-colors"
      >
        {show ? 'Hide' : 'Show'}
      </button>
    </div>
  )
}

/** Selectable option row (business type / hear-about-us). Forest + selected fill when chosen. */
function OptionRow({ selected, label, hint, onClick, role }: {
  selected: boolean
  label: string
  hint?: string
  onClick: () => void
  role: 'radio' | 'checkbox'
}) {
  return (
    <button
      type="button"
      role={role}
      aria-checked={selected}
      onClick={onClick}
      className={cn(
        'flex min-h-12 items-center justify-between gap-3 text-left px-4 py-3 rounded-[4px] border bg-white transition-colors duration-150',
        selected ? 'border-forest bg-selected' : 'border-line hover:border-forest'
      )}
    >
      <span>
        <span className={cn('block font-sans text-[16px] leading-[24px]', selected ? 'text-forest font-[600]' : 'text-ink')}>
          {label}
        </span>
        {hint && <span className="block font-sans text-[13px] leading-[20px] text-muted">{hint}</span>}
      </span>
      <span
        aria-hidden="true"
        className={cn(
          'w-[18px] h-[18px] flex items-center justify-center border flex-shrink-0',
          role === 'radio' ? 'rounded-full' : 'rounded-[2px]',
          selected ? 'bg-forest border-forest text-white' : 'border-muted bg-white'
        )}
      >
        {selected && <Check size={12} strokeWidth={3} />}
      </span>
    </button>
  )
}

// ─── Step 2 — name, password, country, language ────────────────────────────────

export type Step2Field = 'firstName' | 'lastName' | 'password' | 'country'
export type Step2Errors = Partial<Record<Step2Field, string>>

export function validateStep2(data: WizardState): Step2Errors {
  const errors: Step2Errors = {}
  if (!data.firstName.trim()) errors.firstName = 'Enter your first name.'
  if (!data.lastName.trim()) errors.lastName = 'Enter your last name.'
  if (data.password.length < 8) errors.password = 'Password must be at least 8 characters.'
  if (!data.country) errors.country = 'Select your country or region.'
  return errors
}

export function Step2Welcome({ data, patch, onNext, errors }: {
  data: WizardState
  patch: (f: Partial<WizardState>) => void
  onNext: () => void
  errors: Step2Errors
}) {
  const err = (f: Step2Field) => (errors[f] ? `wizard-${f}-error` : undefined)

  return (
    <form
      noValidate
      onSubmit={(e) => { e.preventDefault(); onNext() }}
      className="flex flex-col"
    >
      <h2 className={STEP_HEADING_CLS}>Tell us about yourself</h2>
      <p className="type-body text-muted mt-2">Signing up as {data.email}</p>

      <div className="mt-6 flex flex-col gap-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label htmlFor="wizard-firstName" className={LABEL_CLS}>First name</label>
            <input id="wizard-firstName" type="text" autoComplete="given-name" value={data.firstName}
              aria-invalid={!!errors.firstName || undefined} aria-describedby={err('firstName')}
              onChange={(e) => patch({ firstName: e.target.value })} className={INPUT_CLS} />
            <FieldError id="wizard-firstName-error" message={errors.firstName} />
          </div>
          <div>
            <label htmlFor="wizard-lastName" className={LABEL_CLS}>Last name</label>
            <input id="wizard-lastName" type="text" autoComplete="family-name" value={data.lastName}
              aria-invalid={!!errors.lastName || undefined} aria-describedby={err('lastName')}
              onChange={(e) => patch({ lastName: e.target.value })} className={INPUT_CLS} />
            <FieldError id="wizard-lastName-error" message={errors.lastName} />
          </div>
        </div>

        <div>
          <label htmlFor="wizard-password" className={LABEL_CLS}>Password</label>
          <PasswordInput
            id="wizard-password"
            autoComplete="new-password"
            value={data.password}
            invalid={!!errors.password}
            describedBy={errors.password ? 'wizard-password-error wizard-password-help' : 'wizard-password-help'}
            onChange={(e) => patch({ password: e.target.value })}
          />
          <p id="wizard-password-help" className={HELP_CLS}>8 characters minimum</p>
          <FieldError id="wizard-password-error" message={errors.password} />
        </div>

        <div>
          <label htmlFor="wizard-country" className={LABEL_CLS}>Country/Region</label>
          <select id="wizard-country" value={data.country} autoComplete="country-name"
            aria-invalid={!!errors.country || undefined} aria-describedby={err('country')}
            onChange={(e) => patch({ country: e.target.value })} className={INPUT_CLS}>
            <option value="">Select a country…</option>
            {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <FieldError id="wizard-country-error" message={errors.country} />
        </div>

        <div>
          <label htmlFor="wizard-language" className={LABEL_CLS}>Language</label>
          <select id="wizard-language" value={data.language} onChange={(e) => patch({ language: e.target.value })} className={INPUT_CLS}>
            {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>

        <label className="flex min-h-11 items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={data.marketingOptOut}
            onChange={(e) => patch({ marketingOptOut: e.target.checked })}
            className="w-[18px] h-[18px] mt-[3px] rounded-[2px] accent-forest flex-shrink-0"
          />
          <span className="font-sans text-[14px] leading-[20px] text-muted mt-[1px]">
            Opt out of emails with the latest from Solomon Bharat. You can change your preferences anytime.
          </span>
        </label>
      </div>

      <Button type="submit" variant="primary" size="lg" className="w-full mt-6">
        Continue
      </Button>
    </form>
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
    <div className="flex flex-col">
      <h2 id="wizard-business-type" className={STEP_HEADING_CLS}>Which best describes your business?</h2>

      <div role="radiogroup" aria-labelledby="wizard-business-type" className="mt-6 flex flex-col gap-3">
        {BUSINESS_TYPES.map((t) => (
          <OptionRow
            key={t.value}
            role="radio"
            selected={data.businessType === t.value}
            label={t.label}
            hint={t.hint}
            onClick={() => patch({ businessType: t.value })}
          />
        ))}
      </div>

      <Button type="button" variant="primary" size="lg" className="w-full mt-6" onClick={onNext} disabled={!data.businessType}>
        Continue
      </Button>

      <button
        type="button"
        onClick={onShoppingForMyself}
        className="mt-3 min-h-11 self-center font-sans text-[14px] leading-[20px] text-forest underline underline-offset-4 hover:text-forest-hover transition-colors"
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
    <div className="flex flex-col">
      <h2 id="wizard-opened-year" className={STEP_HEADING_CLS}>When did your business open?</h2>

      <div role="radiogroup" aria-labelledby="wizard-opened-year" className="mt-6 grid grid-cols-2 gap-3">
        {YEAR_OPTIONS.map((y) => {
          const selected = data.businessOpenedYear === y
          return (
            <button
              key={y}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => patch({ businessOpenedYear: y })}
              className={cn(
                'min-h-12 px-3 rounded-[4px] border bg-white font-sans text-[16px] leading-[24px] transition-colors duration-150',
                selected ? 'border-forest bg-selected text-forest font-[600]' : 'border-line text-ink hover:border-forest'
              )}
            >
              {y}
            </button>
          )
        })}
      </div>

      <Button type="button" variant="primary" size="lg" className="w-full mt-6" onClick={onNext} disabled={!data.businessOpenedYear}>
        Continue
      </Button>
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
    <form noValidate onSubmit={(e) => { e.preventDefault(); onNext() }} className="flex flex-col">
      <h2 className={STEP_HEADING_CLS}>What&apos;s your business name?</h2>
      <p className="type-body text-muted mt-2">We&apos;ll use your business info to build your profile.</p>

      <div className="mt-6">
        <label htmlFor="wizard-business-name" className={LABEL_CLS}>Business name</label>
        <input
          id="wizard-business-name"
          type="text"
          autoComplete="organization"
          value={data.businessName}
          aria-invalid={!!error || undefined}
          aria-describedby={error ? 'wizard-business-name-error' : undefined}
          onChange={(e) => patch({ businessName: e.target.value })}
          className={INPUT_CLS}
        />
        <FieldError id="wizard-business-name-error" message={error} />
      </div>

      <Button type="submit" variant="primary" size="lg" className="w-full mt-6">
        Continue
      </Button>
    </form>
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
    <form noValidate onSubmit={(e) => { e.preventDefault(); onNext() }} className="flex flex-col">
      <h2 className={STEP_HEADING_CLS}>What&apos;s your website?</h2>
      <p className="type-body text-muted mt-2">This helps us learn more about your business.</p>

      <div className="mt-6">
        <label htmlFor="wizard-website" className={LABEL_CLS}>Your website</label>
        <input
          id="wizard-website"
          type="text"
          inputMode="url"
          autoComplete="url"
          placeholder="https://www.yourstore.com/"
          value={data.website}
          aria-describedby="wizard-website-help"
          onChange={(e) => patch({ website: e.target.value })}
          className={INPUT_CLS}
        />
        <p id="wizard-website-help" className={HELP_CLS}>Enter your full domain (e.g., mystore.com)</p>
      </div>

      <Button type="submit" variant="primary" size="lg" className="w-full mt-6">
        Continue
      </Button>

      <button
        type="button"
        onClick={onNoWebsite}
        className="mt-3 min-h-11 self-center font-sans text-[14px] leading-[20px] text-forest underline underline-offset-4 hover:text-forest-hover transition-colors"
      >
        I don&apos;t have a website
      </button>
    </form>
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
    <div className="flex flex-col">
      <h2 id="wizard-hear-about" className={STEP_HEADING_CLS}>
        One last thing — how did you hear about Solomon Bharat?
      </h2>
      <p className="type-body text-muted mt-2">Optional. Choose any that apply.</p>

      <div role="group" aria-labelledby="wizard-hear-about" className="mt-6 flex flex-col gap-3">
        {HEAR_ABOUT_OPTIONS.map((option) => (
          <OptionRow
            key={option}
            role="checkbox"
            selected={data.hearAboutUs.includes(option)}
            label={option}
            onClick={() => toggle(option)}
          />
        ))}
      </div>

      {error && <div className="mt-6"><FormError message={error} /></div>}

      <Button
        type="button"
        variant="primary"
        size="lg"
        className="w-full mt-6"
        loading={loading}
        onClick={() => onSubmit(data.hearAboutUs)}
      >
        Create buyer account
      </Button>
    </div>
  )
}
