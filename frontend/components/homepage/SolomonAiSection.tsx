import Link from 'next/link'

// Homepage entry to Solomon AI, the public sourcing and export guide at /guide.
const QUESTIONS = [
  'What could I sell in the UK with £2,000?',
  'What does it cost to bring block-print cushions to the US?',
  'Do I need to register a company to import into Australia?',
]

export function SolomonAiSection() {
  return (
    <section aria-labelledby="solomon-ai-heading" className="bg-[#0E1D18]">
      <div className="sb-container py-14 lg:py-20 grid lg:grid-cols-[1.1fr_0.9fr] gap-10 items-center">
        <div className="flex flex-col gap-4">
          <p className="text-[12px] tracking-[0.14em] uppercase font-[700] text-[#E9A23B]">New · Solomon AI</p>
          <h2 id="solomon-ai-heading" className="type-h1 text-[#EEF2EC]">Starting an Indian craft business abroad? Ask our AI export guide.</h2>
          <p className="type-body text-[#C9D6CC] max-w-[560px]">
            Tell it where you live and what you want to do. It suggests products, works out your landed cost and margin, and explains marketplaces, registration and documents for your country. Free to use.
          </p>
          <div>
            <Link href="/guide" className="inline-flex items-center justify-center h-12 px-6 rounded-[4px] bg-[#E9A23B] text-[#1A1206] font-[700] text-[15px] hover:bg-[#F0B256] transition-colors">
              Chat with Solomon AI
            </Link>
          </div>
        </div>
        <div className="bg-[#15291F] border border-[#2A473A] rounded-2xl p-5 flex flex-col gap-3">
          <p className="text-[13px] text-[#9DB3A6]">People ask things like:</p>
          {QUESTIONS.map((q) => (
            <Link key={q} href="/guide" className="rounded-xl bg-[#1C3428] border border-[#2A473A] px-4 py-3 text-[14.5px] text-[#EEF2EC] hover:border-[#E9A23B] transition-colors">
              {q}
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
