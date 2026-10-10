'use client'

import { BUSINESS_TYPE_OPTIONS, HEAR_ABOUT_US_OPTIONS } from '@/lib/sellerApplicationOptions'
import { CURATED_COMMISSION } from '@/lib/sellerCommission'
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
        <p className="font-sans text-[13.5px] font-[700] text-primary mb-1.5">Commission structure — please read</p>
        <p className="font-sans text-[13px] leading-[1.6] text-muted-text">
          Solomon Bharat charges <strong className="text-primary">{CURATED_COMMISSION.first}% on the FIRST order</strong> from any new
          international buyer we introduce. Every <strong className="text-primary">REPEAT order</strong> from the
          same buyer is <strong className="text-primary">{CURATED_COMMISSION.repeat}%</strong>. No listing fees. No monthly fees. You pay
          only when you earn.
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
          I agree to the commission structure. I understand this is an expression of interest, not a guaranteed
          listing.
        </span>
      </label>
    </div>
  )
}
