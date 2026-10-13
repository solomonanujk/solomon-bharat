'use client'

import { BUSINESS_TYPE_OPTIONS, HEAR_ABOUT_US_OPTIONS } from '@/lib/sellerApplicationOptions'
import { MARKETPLACE_COMMISSION } from '@/lib/sellerCommission'
import { SELLER_AGREEMENT_VERSION } from '@/lib/legal/sellerAgreement'
import { APPLY_SELECT_CLS, APPLY_TEXTAREA_CLS, ChoicePill, RequiredMark, StepField, StepHeader } from './shared'
import type { StepProps } from './types'

export function Step4FinalDetails({ data, patch }: StepProps) {
  return (
    <div className="flex flex-col gap-6">
      <StepHeader step={4} title="Final details" subtitle="About you & commission" />

      <div>
        <p className="text-[13.5px] font-[600] font-sans text-primary mb-2.5">
          Are you a…
          <RequiredMark />
        </p>
        <div className="flex flex-wrap gap-2.5">
          {BUSINESS_TYPE_OPTIONS.map((o) => (
            <ChoicePill key={o} label={o} selected={data.businessType === o} onClick={() => patch({ businessType: o })} />
          ))}
        </div>
      </div>

      <StepField label="How did you hear about Solomon Bharat?">
        <select value={data.hearAboutUs} onChange={(e) => patch({ hearAboutUs: e.target.value })} className={APPLY_SELECT_CLS}>
          <option value="">Select</option>
          {HEAR_ABOUT_US_OPTIONS.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      </StepField>

      <StepField label="Tell us about your business (optional but helps)">
        <textarea
          value={data.message}
          onChange={(e) => patch({ message: e.target.value })}
          placeholder="Your story, artisan partnerships, certifications…"
          rows={4}
          className={APPLY_TEXTAREA_CLS}
        />
      </StepField>

      <div className="rounded-lg p-4 bg-muted-bg border border-border-warm">
        <p className="font-sans text-[13.5px] font-[700] text-primary mb-1.5">How selling works — please read</p>
        <p className="font-sans text-[13px] leading-[1.6] text-muted-text">
          After reviewing your application, our team assigns you one of two ways to sell.{' '}
          <strong className="text-primary">Curated by Solomon</strong>: we buy your products at your price and sell them
          under the Solomon name, with no commission. <strong className="text-primary">Marketplace brand</strong>: you sell
          under your own brand and set your prices; we charge {MARKETPLACE_COMMISSION.first}% on a buyer&apos;s first order
          with you and {MARKETPLACE_COMMISSION.repeat}% after, and 0% on buyers you bring yourself. No listing or monthly fees.
        </p>
      </div>

      <label className="flex items-start gap-2.5 cursor-pointer">
        <input
          type="checkbox"
          checked={data.agreedToCommissionTerms}
          onChange={(e) => patch({ agreedToCommissionTerms: e.target.checked })}
          className="mt-0.5 w-4 h-4 rounded border-border-warm accent-primary flex-shrink-0"
        />
        <span className="font-sans text-[13px] text-primary leading-[1.5]">
          I have read and accept the{' '}
          <a href="/seller-agreement" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
            Seller Agreement
          </a>{' '}
          (version {SELLER_AGREEMENT_VERSION}). I understand this application does not guarantee approval.
        </span>
      </label>
    </div>
  )
}
