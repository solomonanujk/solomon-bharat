import { NavBar } from '@/components/shared/NavBar'
import { Footer } from '@/components/shared/Footer'

/** Minimal placeholder page shell for footer links that don't have full content yet. */
export function StubPage({ title, body }: { title: string; body: string }) {
  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <NavBar />
      <main className="flex-1">
        <div className="max-w-[720px] mx-auto w-full px-4 py-16 sm:py-24">
          <h1 className="font-playfair font-[500] text-primary text-[32px] sm:text-[40px] leading-tight mb-5">
            {title}
          </h1>
          <p className="font-public-sans text-[15px] text-muted-text leading-[1.7]">
            {body}
          </p>
        </div>
      </main>
      <Footer />
    </div>
  )
}
