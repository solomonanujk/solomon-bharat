'use client'

import { MARKETPLACE_COMMISSION } from '@/lib/sellerCommission'
import type { SellerType } from '@/types'
import type { StepProps } from './types'

const OPTIONS: { value: SellerType; title: string; body: string; points: string[] }[] = [
  {
    value: 'MARKETPLACE',
    title: 'Sell on the marketplace',
    body: 'You sell directly to buyers under your own brand.',
    points: [
      'Set your own prices and minimum order value',
      'Your brand name and storefront are shown to buyers',
      'You ship your orders yourself',
      `Solomon charges ${MARKETPLACE_COMMISSION.first}% on your first order and ${MARKETPLACE_COMMISSION.repeat}% on every order after`, // CONFIRM
    ],
  },
  {
    value: 'CURATED',
    title: 'Curated by Solomon Bharat',
    body: 'We review, price and sell your products. Your name is not shown to buyers.',
    points: [
      'You submit products; our team reviews and prices them',
      'Solomon Bharat is the seller buyers contract with',
      'Commission terms are shown in the final step of the application',
    ],
  },
]

export function StepSellerType({ data, patch }: StepProps) {
  return (
    <fieldset>
      <legend className="mb-7 block">
        <span className="block text-[11px] font-[700] font-sans uppercase tracking-[0.1em] mb-2 text-brass-dark">
          Before you start
        </span>
        <span className="block font-display font-[700] text-primary text-[26px] leading-tight">
          How do you want to sell?
        </span>
        <span className="block font-sans text-[13.5px] text-muted-text mt-1">
          Choose one. This applies to your whole account, and you can change your mind before you submit.
        </span>
      </legend>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {OPTIONS.map((o) => {
          const selected = data.sellerType === o.value
          return (
            <label
              key={o.value}
              className={`relative flex flex-col gap-3 min-h-11 rounded-[6px] border p-5 cursor-pointer transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-[3px] has-[:focus-visible]:outline-forest ${
                selected ? 'border-forest bg-selected' : 'border-line bg-white hover:border-forest'
              }`}
            >
              <input
                type="radio"
                name="sellerType"
                value={o.value}
                checked={selected}
                onChange={() => patch({ sellerType: o.value })}
                className="sr-only"
              />
              <span className="flex items-start justify-between gap-3">
                <span className="font-display text-[20px] leading-[26px] font-[600] text-ink">{o.title}</span>
                <span
                  aria-hidden="true"
                  className={`mt-1 w-5 h-5 rounded-full border flex-shrink-0 flex items-center justify-center ${
                    selected ? 'border-forest bg-forest' : 'border-line bg-white'
                  }`}
                >
                  {selected && <span className="w-2 h-2 rounded-full bg-white" />}
                </span>
              </span>
              <span className="font-sans text-[14px] leading-[20px] text-ink">{o.body}</span>
              <ul className="flex flex-col gap-1.5">
                {o.points.map((p) => (
                  <li key={p} className="font-sans text-[13px] leading-[1.5] text-muted flex gap-2">
                    <span aria-hidden="true" className="text-forest">•</span>
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
