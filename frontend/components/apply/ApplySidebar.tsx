'use client'

import { Check } from 'lucide-react'

const STEPS = [
  { n: 1, label: 'Seller', hint: 'Who you are' },
  { n: 2, label: 'Products', hint: 'What you make' },
  { n: 3, label: 'Export readiness', hint: 'Compliance & history' },
  { n: 4, label: 'Final details', hint: 'About you & commission' },
] as const

export function ApplySidebar({ step }: { step: number }) {
  return (
    <div className="hidden lg:flex flex-col w-[280px] flex-shrink-0 p-7 bg-primary">
      <div className="mb-10">
        <p className="font-display font-[700] text-white text-[19px] leading-none">
          Solomon <span className="text-accent">Bharat</span>
        </p>
        <p className="font-sans text-[12px] text-white/50 mt-1.5">Seller application</p>
      </div>

      <div className="flex flex-col gap-1.5 flex-1">
        {STEPS.map(({ n, label, hint }) => {
          const done = n < step
          const current = n === step
          return (
            <div
              key={n}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors ${current ? 'bg-white/[0.06]' : ''}`}
            >
              <span
                className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-[12.5px] font-[700] font-sans ${
                  done
                    ? 'bg-success text-white'
                    : current
                      ? 'bg-accent text-white'
                      : 'bg-transparent border-[1.5px] border-white/25 text-white/50'
                }`}
              >
                {done ? <Check size={13} aria-hidden="true" /> : n}
              </span>
              <div className="min-w-0">
                <p className={`font-sans text-[13.5px] font-[600] leading-tight truncate ${done || current ? 'text-white' : 'text-white/50'}`}>
                  {label}
                </p>
                <p className="font-sans text-[11.5px] leading-tight truncate text-white/40">
                  {hint}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      <div className="rounded-lg p-3.5 flex gap-2.5 bg-white/5 border border-white/10">
        <span className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5 bg-accent" aria-hidden="true" />
        <p className="font-sans text-[12px] leading-[1.5] text-white/65">
          Selected sellers are invited to our launch event with buyers, press and partners.
        </p>
      </div>
    </div>
  )
}
