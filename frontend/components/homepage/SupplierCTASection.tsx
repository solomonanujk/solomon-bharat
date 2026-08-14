import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

export function SupplierCTASection() {
  return (
    <section className="bg-[#3D4E1F]">
      <div className="max-w-7xl mx-auto px-6 lg:px-16 py-16 lg:py-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">

          {/* Left — copy */}
          <div>
            <p className="font-public-sans text-[12px] font-[600] text-white/40 uppercase tracking-[0.08em] mb-4">
              For Indian Suppliers
            </p>
            <h2 className="font-playfair font-[500] text-white leading-[1.1] text-[36px] lg:text-[52px] mb-5">
              Take Your Brand<br className="hidden sm:block" /> Global
            </h2>
            <p className="font-public-sans text-[15px] font-[400] leading-[1.7] text-white/60 max-w-[420px]">
              Join hundreds of Indian manufacturers reaching buyers in 40+ countries. No middlemen, no hidden commissions — direct access to global retail.
            </p>
          </div>

          {/* Right — CTAs + benefits */}
          <div className="flex flex-col gap-6 lg:items-end">
            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                href="/categories"
                className="inline-flex items-center justify-center gap-2 rounded bg-white text-[#3D4E1F] font-[600] font-public-sans text-[14px] px-6 py-3.5 hover:bg-white/90 transition-colors"
              >
                Browse Categories
              </Link>
              <Link
                href="/apply"
                className="inline-flex items-center justify-center gap-2 rounded border border-white/20 text-white font-[600] font-public-sans text-[14px] px-6 py-3.5 hover:bg-white/10 transition-colors"
              >
                Apply as a Seller <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </div>

            <ul className="flex flex-col gap-2.5">
              {[
                'Access 40+ international markets',
                'Zero listing or commission fees',
                'Dedicated export support team',
              ].map((item) => (
                <li key={item} className="flex items-center gap-2.5">
                  <span className="w-1 h-1 rounded-full bg-white/30 flex-shrink-0" aria-hidden="true" />
                  <span className="font-public-sans text-[13px] font-[400] text-white/50">{item}</span>
                </li>
              ))}
            </ul>
          </div>

        </div>
      </div>
    </section>
  )
}
