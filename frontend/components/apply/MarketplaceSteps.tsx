'use client'

import { BUSINESS_TYPE_OPTIONS, COUNTRY_OPTIONS, CRAFT_CATEGORIES } from '@/lib/sellerApplicationOptions'
import {
  MARKETPLACE_COMMISSION,
  MARKETPLACE_COMMISSION_TERMS_VERSION,
  MARKETPLACE_EXAMPLE_ORDER_INR,
} from '@/lib/sellerCommission'
import {
  APPLY_INPUT_LG_CLS,
  APPLY_SELECT_LG_CLS,
  APPLY_TEXTAREA_CLS,
  ChoicePill,
  FormField,
  RequiredMark,
  StepHeader,
  fieldA11y,
} from './shared'
import type { MarketplaceStepProps, StepProps } from './types'

function toggle(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
}

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`

// ─── Step 1 — Brand ──────────────────────────────────────────────────────────

export function MarketplaceStepBrand({ data, patch, errors }: MarketplaceStepProps) {
  return (
    <div>
      <StepHeader step={1} title="Your brand" subtitle="This is what buyers see on your products and storefront" />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <FormField id="brandName" label="Brand name" required error={errors.brandName}>
          <input
            {...fieldA11y('brandName', errors.brandName)}
            type="text"
            value={data.brandName}
            maxLength={60}
            autoComplete="organization"
            onChange={(e) => patch({ brandName: e.target.value })}
            placeholder="e.g. Indigo Root Textiles"
            className={APPLY_INPUT_LG_CLS}
          />
        </FormField>

        <FormField
          id="minOrderValueInr"
          label="Minimum order value (INR)"
          required
          error={errors.minOrderValueInr}
          hint="The least a buyer must spend on your brand in one checkout. Enforced for every order; you can change it later in your brand portal."
        >
          <input
            {...fieldA11y('minOrderValueInr', errors.minOrderValueInr, 'hint')}
            type="number"
            inputMode="numeric"
            min={0}
            value={data.minOrderValueInr}
            onChange={(e) => patch({ minOrderValueInr: e.target.value })}
            placeholder="e.g. 15000"
            className={APPLY_INPUT_LG_CLS}
          />
        </FormField>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5">
        <FormField
          id="brandStory"
          label="Short brand story (optional)"
          error={errors.brandStory}
          hint="Up to 1000 characters. Shown on your public brand page."
        >
          <textarea
            {...fieldA11y('brandStory', errors.brandStory, 'hint')}
            value={data.brandStory}
            maxLength={1000}
            rows={4}
            onChange={(e) => patch({ brandStory: e.target.value })}
            placeholder="Who makes your products, where, and what makes them special…"
            className={APPLY_TEXTAREA_CLS}
          />
        </FormField>

        <FormField id="brandWebsite" label="Website (optional)" error={errors.brandWebsite}>
          <input
            {...fieldA11y('brandWebsite', errors.brandWebsite)}
            type="url"
            inputMode="url"
            value={data.brandWebsite}
            onChange={(e) => patch({ brandWebsite: e.target.value })}
            placeholder="https://yourbrand.com"
            className={APPLY_INPUT_LG_CLS}
          />
        </FormField>

        <FormField
          id="brandLogoUrl"
          label="Brand logo link (optional)"
          error={errors.brandLogoUrl}
          hint="Paste a link to your logo image. Prefer to skip? You can upload a logo from your brand portal after approval."
        >
          <input
            {...fieldA11y('brandLogoUrl', errors.brandLogoUrl, 'hint')}
            type="url"
            inputMode="url"
            value={data.brandLogoUrl}
            onChange={(e) => patch({ brandLogoUrl: e.target.value })}
            placeholder="https://…/logo.png"
            className={APPLY_INPUT_LG_CLS}
          />
        </FormField>
      </div>
    </div>
  )
}

// ─── Step 2 — Business (contact details + categories) ────────────────────────

export function MarketplaceStepBusiness({ data, patch, errors }: MarketplaceStepProps) {
  return (
    <div>
      <StepHeader step={2} title="Your business" subtitle="Private. Used for verification and to contact you" />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <FormField id="businessName" label="Business / legal name" required error={errors.businessName}>
          <input
            {...fieldA11y('businessName', errors.businessName)}
            type="text"
            value={data.businessName}
            autoComplete="organization"
            onChange={(e) => patch({ businessName: e.target.value })}
            placeholder="e.g. Indigo Root Textiles Pvt Ltd"
            className={APPLY_INPUT_LG_CLS}
          />
        </FormField>
        <FormField id="contactName" label="Contact name" required error={errors.contactName}>
          <input
            {...fieldA11y('contactName', errors.contactName)}
            type="text"
            value={data.contactName}
            autoComplete="name"
            onChange={(e) => patch({ contactName: e.target.value })}
            placeholder="Your full name"
            className={APPLY_INPUT_LG_CLS}
          />
        </FormField>
        <FormField id="email" label="Email address" required error={errors.email}>
          <input
            {...fieldA11y('email', errors.email)}
            type="email"
            value={data.email}
            autoComplete="email"
            onChange={(e) => patch({ email: e.target.value })}
            placeholder="you@yourbusiness.com"
            className={APPLY_INPUT_LG_CLS}
          />
        </FormField>
        <FormField id="phone" label="WhatsApp / phone" required error={errors.phone}>
          <input
            {...fieldA11y('phone', errors.phone)}
            type="tel"
            value={data.phone}
            autoComplete="tel"
            onChange={(e) => patch({ phone: e.target.value })}
            placeholder="+91 98765 43210"
            className={APPLY_INPUT_LG_CLS}
          />
        </FormField>
        <FormField id="city" label="City" required error={errors.city}>
          <input
            {...fieldA11y('city', errors.city)}
            type="text"
            value={data.city}
            autoComplete="address-level2"
            onChange={(e) => patch({ city: e.target.value })}
            placeholder="e.g. Jaipur"
            className={APPLY_INPUT_LG_CLS}
          />
        </FormField>
        <FormField id="country" label="Country" required error={errors.country}>
          <select
            {...fieldA11y('country', errors.country)}
            value={data.country}
            onChange={(e) => patch({ country: e.target.value })}
            className={APPLY_SELECT_LG_CLS}
          >
            {COUNTRY_OPTIONS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </FormField>
      </div>

      <div className="mt-6" role="group" aria-labelledby="businessType-label">
        <p id="businessType-label" className="text-[13.5px] font-[600] font-sans text-primary mb-2.5">
          Are you a…
          <RequiredMark />
        </p>
        <div
          id="businessType"
          tabIndex={-1}
          aria-invalid={errors.businessType ? true : undefined}
          aria-describedby={errors.businessType ? 'businessType-error' : undefined}
          className="flex flex-wrap gap-2.5"
        >
          {BUSINESS_TYPE_OPTIONS.map((o) => (
            <ChoicePill key={o} label={o} selected={data.businessType === o} onClick={() => patch({ businessType: o })} />
          ))}
        </div>
        {errors.businessType && (
          <p id="businessType-error" className="font-sans text-[13px] text-error mt-1.5">
            <span aria-hidden="true" className="font-[700]">! </span>
            {errors.businessType}
          </p>
        )}
      </div>

      <div className="mt-6">
        <p className="text-[13.5px] font-[600] font-sans text-primary mb-2.5">
          What categories do you sell in? (optional, select all that apply)
        </p>
        <div className="flex flex-wrap gap-2.5">
          {CRAFT_CATEGORIES.map((c) => (
            <ChoicePill
              key={c}
              label={c}
              selected={data.craftCategories.includes(c)}
              onClick={() => patch({ craftCategories: toggle(data.craftCategories, c) })}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Step 3 — Terms ──────────────────────────────────────────────────────────

export function MarketplaceStepTerms({ data, patch, errors }: MarketplaceStepProps) {
  const { first, repeat } = MARKETPLACE_COMMISSION
  const order = MARKETPLACE_EXAMPLE_ORDER_INR
  const firstFee = (order * first) / 100
  const repeatFee = (order * repeat) / 100

  return (
    <div className="flex flex-col gap-6">
      <StepHeader step={3} title="Selling terms" subtitle="How Solomon Bharat earns when you earn" />

      {/* CONFIRM: owner / legal to approve this wording and the figures before launch. */}
      <div className="rounded-[6px] p-4 bg-muted-bg border border-border-warm">
        <p className="font-sans text-[13.5px] font-[700] text-primary mb-1.5">Commission: please read</p>
        <p className="font-sans text-[13px] leading-[1.6] text-muted-text">
          Solomon Bharat collects the buyer&apos;s payment and keeps a commission of{' '}
          <strong className="text-primary">{first}% on your first paid order</strong> and{' '}
          <strong className="text-primary">{repeat}% on every paid order after that</strong>. We pay you the
          remainder. There are no listing fees or monthly fees. Unpaid or cancelled orders never count as your first
          order. All sales are final: Solomon does not run returns, refunds or disputes, but you can publish your own
          return policy on your brand page.
        </p>
      </div>

      <div className="rounded-[6px] p-4 bg-white border border-line">
        <p className="font-sans text-[13.5px] font-[700] text-primary mb-2">Worked example: a {inr(order)} order</p>
        <ul className="font-sans text-[13px] leading-[1.6] text-muted-text flex flex-col gap-1.5">
          <li>
            First paid order: commission {first}% = {inr(firstFee)}. You receive{' '}
            <strong className="text-primary">{inr(order - firstFee)}</strong>.
          </li>
          <li>
            Any later order of the same size: commission {repeat}% = {inr(repeatFee)}. You receive{' '}
            <strong className="text-primary">{inr(order - repeatFee)}</strong>.
          </li>
        </ul>
        <p className="font-sans text-[12px] text-muted-text mt-2">
          Illustrative only. Your actual payout is calculated on each order.
        </p>
      </div>

      <div>
        <label className="flex items-start gap-3 cursor-pointer min-h-11">
          <input
            {...fieldA11y('agreedToCommissionTerms', errors.agreedToCommissionTerms)}
            type="checkbox"
            checked={data.agreedToCommissionTerms}
            onChange={(e) => patch({ agreedToCommissionTerms: e.target.checked })}
            className="mt-0.5 w-5 h-5 rounded border-border-warm accent-primary flex-shrink-0"
          />
          <span className="font-sans text-[13px] text-primary leading-[1.5]">
            I have read and agree to the commission terms above (version {MARKETPLACE_COMMISSION_TERMS_VERSION}). I
            understand this application is an expression of interest and does not guarantee approval.
          </span>
        </label>
        {errors.agreedToCommissionTerms && (
          <p id="agreedToCommissionTerms-error" className="font-sans text-[13px] text-error mt-1.5">
            <span aria-hidden="true" className="font-[700]">! </span>
            {errors.agreedToCommissionTerms}
          </p>
        )}
      </div>
    </div>
  )
}

// ─── Step 4 — Review ─────────────────────────────────────────────────────────

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-x-4 gap-y-0.5 py-2.5">
      <dt className="font-sans text-[12.5px] font-[600] text-muted-text">{label}</dt>
      <dd className="font-sans text-[14px] text-ink break-words">{value || 'Not provided'}</dd>
    </div>
  )
}

export function MarketplaceStepReview({ data, onEdit }: StepProps & { onEdit: (step: number) => void }) {
  const minOrder = Number(data.minOrderValueInr)
  return (
    <div className="flex flex-col gap-6">
      <StepHeader step={4} title="Review your application" subtitle="Check everything, then submit for review" />

      <section aria-labelledby="review-brand">
        <div className="flex items-center justify-between">
          <h3 id="review-brand" className="font-sans text-[14px] font-[700] text-primary">Brand</h3>
          <button type="button" onClick={() => onEdit(1)} className="min-h-11 px-2 font-sans text-[13px] font-[600] text-forest underline underline-offset-4">
            Edit<span className="sr-only"> brand details</span>
          </button>
        </div>
        <dl className="divide-y divide-line border-y border-line">
          <ReviewRow label="Brand name" value={data.brandName} />
          <ReviewRow label="Minimum order" value={Number.isFinite(minOrder) ? inr(minOrder) : ''} />
          <ReviewRow label="Story" value={data.brandStory} />
          <ReviewRow label="Website" value={data.brandWebsite} />
          <ReviewRow label="Logo link" value={data.brandLogoUrl} />
        </dl>
      </section>

      <section aria-labelledby="review-business">
        <div className="flex items-center justify-between">
          <h3 id="review-business" className="font-sans text-[14px] font-[700] text-primary">Business</h3>
          <button type="button" onClick={() => onEdit(2)} className="min-h-11 px-2 font-sans text-[13px] font-[600] text-forest underline underline-offset-4">
            Edit<span className="sr-only"> business details</span>
          </button>
        </div>
        <dl className="divide-y divide-line border-y border-line">
          <ReviewRow label="Legal name" value={data.businessName} />
          <ReviewRow label="Contact" value={data.contactName} />
          <ReviewRow label="Email" value={data.email} />
          <ReviewRow label="Phone" value={data.phone} />
          <ReviewRow label="Location" value={[data.city, data.country].filter(Boolean).join(', ')} />
          <ReviewRow label="Business type" value={data.businessType} />
          <ReviewRow label="Categories" value={data.craftCategories.join(', ')} />
        </dl>
      </section>

      <p className="font-sans text-[13px] text-muted-text">
        Commission terms version {MARKETPLACE_COMMISSION_TERMS_VERSION} accepted: {MARKETPLACE_COMMISSION.first}% on
        your first paid order, {MARKETPLACE_COMMISSION.repeat}% after.
      </p>
    </div>
  )
}
