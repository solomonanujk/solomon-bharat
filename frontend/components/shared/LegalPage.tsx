import { NavBar } from '@/components/shared/NavBar'
import { Footer } from '@/components/shared/Footer'
import type { LegalDocument } from '@/lib/legal/types'

/** Renders a legal document (terms, privacy, cookies, seller agreement) as numbered sections. */
export function LegalPage({ doc, children }: { doc: LegalDocument; children?: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-ivory flex flex-col">
      <NavBar />
      <main className="flex-1">
        <div className="sb-container sb-section">
          <article className="max-w-[760px]">
            <h1 className="type-h1 text-ink">{doc.title}</h1>
            {doc.updated && <p className="type-body text-muted mt-3">Last updated: {doc.updated}</p>}
            {doc.intro && <p className="type-body text-ink mt-6">{doc.intro}</p>}
            {children}
            <div className="mt-8 space-y-8">
              {doc.sections.map((section, i) => (
                <section key={section.heading}>
                  <h2 className="text-[18px] font-[600] text-ink">
                    {i + 1}. {section.heading}
                  </h2>
                  <div className="mt-3 space-y-3">
                    {section.body.map((para) =>
                      Array.isArray(para) ? (
                        <ul key={para.join('|')} className="list-disc pl-5 space-y-1 type-body text-ink">
                          {para.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      ) : (
                        <p key={para} className="type-body text-ink">
                          {para}
                        </p>
                      ),
                    )}
                  </div>
                </section>
              ))}
            </div>
          </article>
        </div>
      </main>
      <Footer />
    </div>
  )
}
