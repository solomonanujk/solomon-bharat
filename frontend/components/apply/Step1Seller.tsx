'use client'

import { COUNTRY_OPTIONS } from '@/lib/sellerApplicationOptions'
import { APPLY_INPUT_CLS, APPLY_SELECT_CLS, StepField, StepHeader } from './shared'
import type { StepProps } from './types'

export function Step1Seller({ data, patch }: StepProps) {
  return (
    <div>
      <StepHeader step={1} title="Seller" subtitle="Who you are" />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <StepField label="Seller name" required>
          <input
            type="text"
            value={data.businessName}
            onChange={(e) => patch({ businessName: e.target.value })}
            placeholder="e.g. Jaipur Handicrafts"
            className={APPLY_INPUT_CLS}
          />
        </StepField>
        <StepField label="Founder / owner name" required>
          <input
            type="text"
            value={data.contactName}
            onChange={(e) => patch({ contactName: e.target.value })}
            placeholder="Your full name"
            className={APPLY_INPUT_CLS}
          />
        </StepField>

        <StepField label="Email address" required>
          <input
            type="email"
            value={data.email}
            onChange={(e) => patch({ email: e.target.value })}
            placeholder="you@yourbusiness.com"
            className={APPLY_INPUT_CLS}
          />
        </StepField>
        <StepField label="WhatsApp / phone" required>
          <input
            type="tel"
            value={data.phone}
            onChange={(e) => patch({ phone: e.target.value })}
            placeholder="+91 98765 43210"
            className={APPLY_INPUT_CLS}
          />
        </StepField>

        <StepField label="City" required>
          <input
            type="text"
            value={data.city}
            onChange={(e) => patch({ city: e.target.value })}
            placeholder="e.g. Varanasi"
            className={APPLY_INPUT_CLS}
          />
        </StepField>
        <StepField label="Country" required>
          <select value={data.country} onChange={(e) => patch({ country: e.target.value })} className={APPLY_SELECT_CLS}>
            {COUNTRY_OPTIONS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </StepField>

        <StepField label="Instagram handle" required>
          <div className="flex items-center rounded-lg border border-border-warm bg-surface overflow-hidden focus-within:border-accent transition-colors">
            <span className="pl-3.5 pr-1 text-[14px] font-sans text-muted-text/50">@</span>
            <input
              type="text"
              value={data.instagramHandle}
              onChange={(e) => patch({ instagramHandle: e.target.value.replace(/^@/, '') })}
              placeholder="yourbusiness"
              className="flex-1 h-11 pr-3.5 text-[14px] font-sans text-primary placeholder:text-muted-text/50 focus:outline-none"
            />
          </div>
        </StepField>
        <StepField label="Instagram followers" required>
          <input
            type="number"
            min={0}
            value={data.instagramFollowers}
            onChange={(e) => patch({ instagramFollowers: e.target.value })}
            placeholder="e.g. 2500"
            className={APPLY_INPUT_CLS}
          />
        </StepField>
      </div>

      <div className="mt-5">
        <StepField label="Website / social link / catalogue (optional)">
          <input
            type="text"
            value={data.websiteOrSocialLink}
            onChange={(e) => patch({ websiteOrSocialLink: e.target.value })}
            placeholder="Anything that shows your work — website, Linktree, drive link, etc."
            className={APPLY_INPUT_CLS}
          />
        </StepField>
      </div>
    </div>
  )
}
