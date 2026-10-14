'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useAdminRfqs, useUpdateRfq, type Rfq, type RfqStatus } from '@/hooks/queries/useRfqs'

const STATUSES: RfqStatus[] = ['NEW', 'IN_PROGRESS', 'QUOTED', 'CLOSED']
const LABELS: Record<RfqStatus, string> = { NEW: 'New', IN_PROGRESS: 'In progress', QUOTED: 'Quoted', CLOSED: 'Closed' }

function RfqCard({ rfq }: { rfq: Rfq }) {
  const update = useUpdateRfq()
  const [notes, setNotes] = useState(rfq.adminNotes ?? '')

  return (
    <article className="bg-white border border-[#D9E2DA] rounded-xl p-5 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[15px] font-[600] font-sans text-[#0F241D]">
            {rfq.isSample && <span className="mr-2 text-[11px] font-[700] uppercase tracking-[0.06em] text-[#A0522D]">Sample order</span>}
            {rfq.quantity.toLocaleString()} units &middot; {rfq.destinationCountry}
          </p>
          <p className="text-[12px] font-sans text-[#183D33B3] mt-0.5">
            {rfq.user?.email} ({rfq.user?.role?.toLowerCase()}) &middot; {new Date(rfq.createdAt).toLocaleDateString('en-IN')}
            {rfq.deadline && ` · needed by ${new Date(rfq.deadline).toLocaleDateString('en-IN')}`}
          </p>
        </div>
        <select
          value={rfq.status}
          onChange={(e) => update.mutate({ id: rfq.id, status: e.target.value as RfqStatus })}
          className="h-9 px-2 rounded border border-[#D9E2DA] text-[13px] font-sans"
          aria-label="Status"
        >
          {STATUSES.map((s) => <option key={s} value={s}>{LABELS[s]}</option>)}
        </select>
      </div>
      {rfq.product && (
        <p className="text-[13px] font-sans">
          From listing: <Link href={`/products/${rfq.product.slug}`} className="underline">{rfq.product.name}</Link>
        </p>
      )}
      <p className="text-[14px] font-sans text-[#0F241D] whitespace-pre-wrap">{rfq.description}</p>
      {rfq.targetPrice && (
        <p className="text-[13px] font-sans text-[#183D33]">Target: {rfq.currency} {rfq.targetPrice} / unit</p>
      )}
      {rfq.referenceImages && rfq.referenceImages.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {rfq.referenceImages.map((url, i) => (
            <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="text-[13px] underline">Image {i + 1}</a>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Internal notes (quote sent, maker, price…)"
          className="flex-1 h-9 px-3 rounded border border-[#D9E2DA] text-[13px] font-sans"
        />
        <button
          type="button"
          onClick={() => update.mutate({ id: rfq.id, adminNotes: notes })}
          disabled={update.isPending || notes === (rfq.adminNotes ?? '')}
          className="h-9 px-3 rounded bg-[#183D33] text-white text-[13px] font-sans disabled:opacity-50"
        >
          Save
        </button>
      </div>
    </article>
  )
}

export default function AdminRfqsPage() {
  const [status, setStatus] = useState<RfqStatus | undefined>('NEW')
  const { data: rfqs = [], isLoading } = useAdminRfqs(status)

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div>
        <h1 className="text-[28px] leading-[1.3] font-[500] font-sans text-[#0F241D]">Custom Requirements</h1>
        <p className="text-[14px] font-sans text-[#183D33B3] mt-1">Requests for quotes from buyers and agents.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {[undefined, ...STATUSES].map((s) => (
          <button
            key={s ?? 'ALL'}
            type="button"
            onClick={() => setStatus(s)}
            className={`h-8 px-3 rounded-full text-[13px] font-sans border ${status === s ? 'bg-[#183D33] text-white border-[#183D33]' : 'border-[#D9E2DA] text-[#183D33]'}`}
          >
            {s ? LABELS[s] : 'All'}
          </button>
        ))}
      </div>
      {isLoading ? (
        <div className="h-32 bg-white border border-[#D9E2DA] rounded-xl animate-pulse" />
      ) : rfqs.length === 0 ? (
        <p className="text-[14px] font-sans text-[#183D33B3]">No requests here.</p>
      ) : (
        rfqs.map((rfq) => <RfqCard key={rfq.id} rfq={rfq} />)
      )}
    </div>
  )
}
