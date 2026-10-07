'use client'

import {
  AMAZON_SELLING_OPTIONS,
  COMPANY_INCORPORATION_OPTIONS,
  EXPORT_ORDER_RANGE_OPTIONS,
  GST_REGISTRATION_OPTIONS,
  IEC_STATUS_OPTIONS,
  OTHER_PLATFORM_OPTIONS,
} from '@/lib/sellerApplicationOptions'
import { APPLY_INPUT_CLS, APPLY_SELECT_CLS, ChoicePill, StepField, StepHeader } from './shared'
import type { StepProps } from './types'

function toggle(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
}

function ChoiceRow({ label, options, value, onChange }: { label: string; options: readonly string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <p className="text-[13.5px] font-[600] font-sans text-primary mb-2.5">{label}</p>
      <div className="flex flex-wrap gap-2.5">
        {options.map((o) => (
          <ChoicePill key={o} label={o} selected={value === o} onClick={() => onChange(o)} />
        ))}
      </div>
    </div>
  )
}

export function Step3ExportReadiness({ data, patch }: StepProps) {
  return (
    <div className="flex flex-col gap-6">
      <StepHeader step={3} title="Export readiness" subtitle="Compliance & history" />

      <div>
        <p className="text-[13.5px] font-[600] font-sans text-primary mb-2.5">Have you shipped internationally before?</p>
        <div className="flex flex-wrap gap-2.5">
          <ChoicePill label="Yes" selected={data.shippedInternationally === true} onClick={() => patch({ shippedInternationally: true })} />
          <ChoicePill label="No" selected={data.shippedInternationally === false} onClick={() => patch({ shippedInternationally: false })} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <StepField label="Approx. how many orders?">
          <select
            value={data.approxExportOrders}
            onChange={(e) => patch({ approxExportOrders: e.target.value })}
            className={APPLY_SELECT_CLS}
          >
            <option value="">Select</option>
            {EXPORT_ORDER_RANGE_OPTIONS.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </StepField>
        <StepField label="Which countries?">
          <input
            type="text"
            value={data.exportCountries}
            onChange={(e) => patch({ exportCountries: e.target.value })}
            placeholder="e.g. UK, USA, UAE"
            className={APPLY_INPUT_CLS}
          />
        </StepField>
      </div>

      <ChoiceRow
        label="Selling on Amazon?"
        options={AMAZON_SELLING_OPTIONS}
        value={data.sellingOnAmazon}
        onChange={(v) => patch({ sellingOnAmazon: v })}
      />

      <div>
        <p className="text-[13.5px] font-[600] font-sans text-primary mb-2.5">Other platforms (optional)</p>
        <div className="flex flex-wrap gap-2.5">
          {OTHER_PLATFORM_OPTIONS.map((p) => (
            <ChoicePill
              key={p}
              label={p}
              selected={data.otherPlatforms.includes(p)}
              onClick={() => patch({ otherPlatforms: toggle(data.otherPlatforms, p) })}
            />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-6">
        <ChoiceRow
          label="GST registration"
          options={GST_REGISTRATION_OPTIONS}
          value={data.gstRegistration}
          onChange={(v) => patch({ gstRegistration: v })}
        />
        <ChoiceRow
          label="Company incorporated?"
          options={COMPANY_INCORPORATION_OPTIONS}
          value={data.companyIncorporation}
          onChange={(v) => patch({ companyIncorporation: v })}
        />
      </div>

      <div>
        <p className="text-[13.5px] font-[600] font-sans text-primary mb-2.5">IEC (Import Export Code)</p>
        <div className="flex flex-wrap gap-2.5">
          {IEC_STATUS_OPTIONS.map((o) => (
            <ChoicePill key={o} label={o} selected={data.iecStatus === o} onClick={() => patch({ iecStatus: o })} />
          ))}
        </div>
        <p className="text-[12px] font-sans text-muted-text mt-2">If not, we will help you get one.</p>
      </div>
    </div>
  )
}
