'use client'

import { useState } from 'react'
import { useAuditLog } from '@/hooks/queries/useAdmin'
import type { AuditLogEntry } from '@/types'

const ENTITY_TYPES = ['Order', 'Checkout', 'Product', 'Payout', 'SellerApplication', 'AgentApplication', 'Brand', 'Rfq', 'User', 'Setting']
const PAGE_SIZE = 50

function toCsv(rows: AuditLogEntry[]): string {
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const header = ['When', 'Admin', 'Action', 'Entity type', 'Entity ID', 'Details']
  const lines = rows.map((r) =>
    [new Date(r.createdAt).toISOString(), r.admin?.email ?? r.adminId, r.action, r.entityType, r.entityId, JSON.stringify(r.metadata ?? {})]
      .map(esc)
      .join(','),
  )
  return [header.map(esc).join(','), ...lines].join('\n')
}

function downloadCsv(rows: AuditLogEntry[]) {
  const url = URL.createObjectURL(new Blob([toCsv(rows)], { type: 'text/csv' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// Every sensitive admin action (approvals, prices, payments, refunds, payouts) is recorded
// here, for internal review and for auditors.
export default function AuditLogPage() {
  const [entityType, setEntityType] = useState('')
  const [entityId, setEntityId] = useState('')
  const [page, setPage] = useState(1)
  const { data, isLoading } = useAuditLog({
    entityType: entityType || undefined,
    entityId: entityId.trim() || undefined,
    page,
    limit: PAGE_SIZE,
  })
  const rows = data?.items ?? []

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] leading-[1.3] font-[500] font-sans text-[#0F241D]">Audit Log</h1>
          <p className="text-[14px] font-sans text-[#183D33B3] mt-1">Who changed what, and when.</p>
        </div>
        <button
          type="button"
          onClick={() => downloadCsv(rows)}
          disabled={rows.length === 0}
          className="h-9 px-4 rounded bg-[#183D33] text-white text-[13px] font-sans disabled:opacity-50"
        >
          Export this page (CSV)
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <select
          value={entityType}
          onChange={(e) => { setEntityType(e.target.value); setPage(1) }}
          className="h-9 px-2 rounded border border-[#D9E2DA] text-[13px] font-sans bg-white"
          aria-label="Entity type"
        >
          <option value="">All types</option>
          {ENTITY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <input
          value={entityId}
          onChange={(e) => { setEntityId(e.target.value); setPage(1) }}
          placeholder="Entity ID (e.g. an order ID)"
          className="h-9 px-3 rounded border border-[#D9E2DA] text-[13px] font-sans bg-white w-[300px] max-w-full"
        />
      </div>

      <div className="bg-white border border-[#D9E2DA] rounded-xl overflow-x-auto">
        <table className="w-full text-[13px] font-sans">
          <thead>
            <tr className="text-left text-[#183D33B3] border-b border-[#D9E2DA]">
              <th className="px-4 py-3 font-[600]">When</th>
              <th className="px-4 py-3 font-[600]">Admin</th>
              <th className="px-4 py-3 font-[600]">Action</th>
              <th className="px-4 py-3 font-[600]">Entity</th>
              <th className="px-4 py-3 font-[600]">Details</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-[#183D33B3]">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-[#183D33B3]">No entries.</td></tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-b border-[#EEF2EE] align-top">
                  <td className="px-4 py-3 whitespace-nowrap">{new Date(r.createdAt).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-3">{r.admin?.email ?? r.adminId}</td>
                  <td className="px-4 py-3 font-[600] text-[#0F241D]">{r.action}</td>
                  <td className="px-4 py-3">
                    {r.entityType}
                    <span className="block font-mono text-[11px] text-[#183D33B3]">{r.entityId}</span>
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-[#183D33] break-all max-w-[320px]">
                    {r.metadata ? JSON.stringify(r.metadata) : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {data && data.totalPages > 1 && (
        <div className="flex items-center gap-3 text-[13px] font-sans">
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="underline disabled:opacity-40">Previous</button>
          <span>Page {page} of {data.totalPages}</span>
          <button type="button" disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)} className="underline disabled:opacity-40">Next</button>
        </div>
      )}
    </div>
  )
}
