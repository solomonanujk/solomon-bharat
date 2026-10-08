import { NavBar } from '@/components/shared/NavBar'
import { Footer } from '@/components/shared/Footer'

/** Minimal placeholder page shell for footer links that don't have full content yet. */
export function StubPage({ title, body }: { title: string; body: string }) {
  return (
    <div className="min-h-screen bg-ivory flex flex-col">
      <NavBar />
      <main className="flex-1">
        <div className="sb-container sb-section">
          <div className="max-w-[660px]">
            <h1 className="type-h1 text-ink">{title}</h1>
            <p className="type-body text-muted mt-6">{body}</p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
