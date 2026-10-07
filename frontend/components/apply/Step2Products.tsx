'use client'

import { CRAFT_CATEGORIES, GI_TAGGED_OPTIONS, MONTHLY_SALES_VOLUME_OPTIONS } from '@/lib/sellerApplicationOptions'
import { APPLY_SELECT_CLS, APPLY_TEXTAREA_CLS, ChoicePill, StepField, StepHeader } from './shared'
import type { StepProps } from './types'

function toggle(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
}

export function Step2Products({ data, patch }: StepProps) {
  return (
    <div>
      <StepHeader step={2} title="Products" subtitle="What you make" />

      <div className="mb-6">
        <p className="text-[13.5px] font-[600] font-sans text-primary mb-2.5">
          What categories do you sell in? (select all that apply)
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

      <div className="mb-6">
        <StepField label="Describe your products">
          <textarea
            value={data.productDescription}
            onChange={(e) => patch({ productDescription: e.target.value })}
            placeholder="Materials, techniques, what makes them unique…"
            rows={4}
            className={APPLY_TEXTAREA_CLS}
          />
        </StepField>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <p className="text-[13.5px] font-[600] font-sans text-primary mb-2.5">Any GI-tagged products?</p>
          <div className="flex flex-wrap gap-2.5">
            {GI_TAGGED_OPTIONS.map((o) => (
              <ChoicePill
                key={o}
                label={o}
                selected={data.giTaggedProducts === o}
                onClick={() => patch({ giTaggedProducts: o })}
              />
            ))}
          </div>
        </div>

        <StepField label="Monthly sales volume">
          <select
            value={data.monthlySalesVolume}
            onChange={(e) => patch({ monthlySalesVolume: e.target.value })}
            className={APPLY_SELECT_CLS}
          >
            <option value="">Select range</option>
            {MONTHLY_SALES_VOLUME_OPTIONS.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </StepField>
      </div>
    </div>
  )
}
