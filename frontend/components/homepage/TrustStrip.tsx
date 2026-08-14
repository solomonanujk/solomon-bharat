import { ShieldCheck, Globe2, Lock } from 'lucide-react'

// ─── Trust Indicators — prd.md §6.2 ───────────────────────────────────────────

const METRICS = [
  { Icon: ShieldCheck, label: 'Verified Indian Suppliers' },
  { Icon: Globe2, label: 'Export Ready' },
  { Icon: Lock, label: 'Secure PayPal Payments' },
]

export function TrustStrip() {
  return (
    <section className="bg-surface border-y border-border-warm py-10">
      <div className="max-w-7xl mx-auto px-6 lg:px-16">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 lg:gap-6">
          {METRICS.map(({ Icon, label }) => (
            <div key={label} className="flex items-center justify-center gap-3 text-center">
              <div className="w-9 h-9 rounded bg-muted-bg border border-border-warm flex items-center justify-center text-accent flex-shrink-0">
                <Icon size={16} aria-hidden="true" />
              </div>
              <p className="font-public-sans text-[14px] font-[600] text-primary">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
