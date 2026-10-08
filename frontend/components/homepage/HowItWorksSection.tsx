import { PROCESS_STEPS } from '@/components/homepage/homepageContent'

// ─── How it works ─────────────────────────────────────────────────────────────
// Ivory, three steps (3 columns desktop/tablet, 1 on mobile). Decorative step
// numbers are brass-dark — the brass shade that holds contrast on ivory.

export function HowItWorksSection() {
  return (
    <section className="bg-ivory sb-section" aria-labelledby="home-process-heading">
      <div className="sb-container">
        <div className="mb-6 lg:mb-8 max-w-[660px]">
          <p className="type-eyebrow text-brass-dark">Simple process</p>
          <h2 id="home-process-heading" className="type-h2 text-ink mt-2">
            From discovery to delivery in three steps
          </h2>
        </div>

        <ol className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-6">
          {PROCESS_STEPS.map((step) => (
            <li key={step.number} className="border-t border-line pt-6">
              <span className="type-step-number text-brass-dark block" aria-hidden="true">
                {step.number}
              </span>
              <h3 className="type-h3 text-ink mt-3">
                <span className="sr-only">Step {Number(step.number)}: </span>
                {step.title}
              </h3>
              <p className="type-body text-muted mt-2">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
