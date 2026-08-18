'use client'

import { useMyAgentProfileForPortal } from '@/hooks/queries/useCatalogues'

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="border border-border-warm rounded bg-surface mb-6">
      <div className="px-6 py-5 border-b border-border-warm">
        <h2 className="text-[16px] leading-[1.3] font-[600] font-public-sans text-primary">{title}</h2>
        {description && <p className="text-[13px] font-public-sans text-muted-text mt-0.5">{description}</p>}
      </div>
      <div className="p-6">{children}</div>
    </section>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[12px] font-[600] font-public-sans text-muted-text uppercase tracking-[0.05em] mb-1.5">
        {label}
      </p>
      <p className="text-[14px] font-public-sans text-primary">{value || '—'}</p>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
// Read-only profile view. No update mutation is wired here — the profile
// fetch is a deliberate small duplicate of GET /agents/me kept local to this
// portal (see hooks/queries/useCatalogues.ts) to avoid a file-ownership
// conflict with the concurrently-built hooks/queries/useAgents.ts, which is
// where an edit mutation naturally belongs instead.

export default function AgentSettingsPage() {
  const { data: profile, isLoading } = useMyAgentProfileForPortal()

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse max-w-2xl">
        {Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-40 bg-muted-bg rounded" />)}
      </div>
    )
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-[24px] leading-[1.3] font-[500] font-playfair text-primary mb-6">Settings</h1>

      <Section title="Business Profile" description="Basic information Solomon Bharat has on file for you.">
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Business Name" value={profile?.businessName ?? ''} />
            <Field label="Contact Name" value={profile?.contactName ?? ''} />
          </div>
          <Field label="Phone Number" value={profile?.phone ?? ''} />
          <Field label="Business Address" value={profile?.businessAddress ?? ''} />
        </div>
      </Section>

      <p className="text-[12px] font-public-sans text-muted-text">
        To update these details, contact Solomon Bharat support.
      </p>
    </div>
  )
}
