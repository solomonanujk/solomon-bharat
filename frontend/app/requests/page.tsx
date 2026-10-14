'use client'

import Link from 'next/link'
import { AccountPageWrapper } from '@/components/shared/AccountPageWrapper'
import { EmptyState } from '@/components/shared/EmptyState'
import { useMyRfqs, type RfqStatus } from '@/hooks/queries/useRfqs'

const LABELS: Record<RfqStatus, string> = {
  NEW: 'Received',
  IN_PROGRESS: 'Our team is working on it',
  QUOTED: 'Quote sent to your email',
  CLOSED: 'Closed',
}

export default function MyRequestsPage() {
  const { data: rfqs = [], isLoading } = useMyRfqs()

  return (
    <AccountPageWrapper title="Custom requests" description="Your custom requirements and their status.">
      <div className="flex justify-end mb-4">
        <Link href="/custom-requirement" className="text-[14px] font-[600] font-sans text-forest underline underline-offset-4">
          New custom request
        </Link>
      </div>
      {isLoading ? (
        <div className="h-24 rounded border border-border-warm bg-surface animate-pulse" />
      ) : rfqs.length === 0 ? (
        <EmptyState title="No custom requests yet" description="Need different colours, sizes or your own label? Send us a request." />
      ) : (
        <div className="space-y-3">
          {rfqs.map((r) => (
            <article key={r.id} className="border border-border-warm rounded bg-surface p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[15px] font-[600] font-sans text-primary">
                  {r.isSample ? 'Sample · ' : ''}{r.quantity.toLocaleString()} units &middot; {r.destinationCountry}
                </p>
                <span className="text-[12px] font-[600] font-sans px-2.5 py-1 rounded-full bg-accent/10 text-accent-hover">
                  {LABELS[r.status]}
                </span>
              </div>
              <p className="text-[14px] font-sans text-muted-text mt-2 whitespace-pre-wrap">{r.description}</p>
              <p className="text-[12px] font-sans text-muted-text mt-2">
                Sent {new Date(r.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            </article>
          ))}
        </div>
      )}
    </AccountPageWrapper>
  )
}
