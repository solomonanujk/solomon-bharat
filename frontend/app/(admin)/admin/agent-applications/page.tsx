'use client'

import { useState } from 'react'
import { ClipboardList, Search, Mail, Phone, MapPin, Globe2, CalendarDays, MessageSquare, StickyNote, ChevronDown, ChevronUp } from 'lucide-react'
import {
  useAgentApplications,
  useApproveAgentApplication,
  useRejectAgentApplication,
  useRequestAgentMoreInfo,
  useAddAgentApplicationNote,
} from '@/hooks/queries/useAgents'
import type { AgentApplication, AgentApplicationStatus } from '@/types'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

const LIMIT = 20

const STATUS_TABS: { value: AgentApplicationStatus | ''; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'MORE_INFO_REQUESTED', label: 'More Info Requested' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
]

// ─── Reject dialog ─────────────────────────────────────────────────────────────

function RejectDialog({ application, onClose }: { application: AgentApplication; onClose: () => void }) {
  const [reason, setReason] = useState('')
  const rejectApplication = useRejectAgentApplication()
  const trimmed = reason.trim()

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject application</DialogTitle>
          <DialogDescription>
            Rejecting <strong className="text-[#1A1A1A]">{application.businessName}</strong>. A reason is required and
            will be shared with the applicant.
          </DialogDescription>
        </DialogHeader>
        <div className="px-6 pb-2">
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason for rejection (required)…"
            rows={4}
            className="w-full px-3 py-2.5 rounded-lg border border-[#E5E1D8] bg-[#F9F7F2] text-[13.5px] font-sans text-[#1A1A1A] placeholder:text-[#9CA3AF] focus:outline-none focus:border-[#A68B67] transition-colors resize-none"
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            variant="destructive"
            disabled={!trimmed || rejectApplication.isPending}
            onClick={() =>
              rejectApplication.mutate({ id: application.id, reason: trimmed }, { onSuccess: onClose })
            }
          >
            {rejectApplication.isPending ? 'Rejecting…' : 'Confirm reject'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Request info dialog ───────────────────────────────────────────────────────

function RequestInfoDialog({ application, onClose }: { application: AgentApplication; onClose: () => void }) {
  const [message, setMessage] = useState('')
  const requestMoreInfo = useRequestAgentMoreInfo()
  const trimmed = message.trim()

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request more information</DialogTitle>
          <DialogDescription>
            Send <strong className="text-[#1A1A1A]">{application.businessName}</strong> a message describing what
            additional information is needed.
          </DialogDescription>
        </DialogHeader>
        <div className="px-6 pb-2">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="What information do you need from the applicant?"
            rows={4}
            className="w-full px-3 py-2.5 rounded-lg border border-[#E5E1D8] bg-[#F9F7F2] text-[13.5px] font-sans text-[#1A1A1A] placeholder:text-[#9CA3AF] focus:outline-none focus:border-[#A68B67] transition-colors resize-none"
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            variant="accent"
            disabled={!trimmed || requestMoreInfo.isPending}
            onClick={() =>
              requestMoreInfo.mutate({ id: application.id, message: trimmed }, { onSuccess: onClose })
            }
          >
            {requestMoreInfo.isPending ? 'Sending…' : 'Send request'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Internal notes ────────────────────────────────────────────────────────────

function NotesPanel({ application }: { application: AgentApplication }) {
  const [note, setNote] = useState('')
  const addNote = useAddAgentApplicationNote()
  const trimmed = note.trim()

  return (
    <div className="mt-4 pt-4 border-t border-[#F5F0E8] space-y-3">
      <p className="text-[11px] font-[700] font-sans text-[#A68B67] uppercase tracking-[0.08em]">
        Internal notes
      </p>
      {application.internalNotes ? (
        <p className="text-[13px] font-sans text-[#1A1A1A] whitespace-pre-wrap bg-[#F9F7F2] rounded-lg px-3 py-2.5">
          {application.internalNotes}
        </p>
      ) : (
        <p className="text-[12.5px] font-sans text-[#9CA3AF]">No internal notes yet.</p>
      )}
      <div className="flex gap-2">
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add a note (not visible to applicant)…"
          className="flex-1 h-9 px-3 rounded-lg border border-[#E5E1D8] bg-white text-[13px] font-sans text-[#1A1A1A] placeholder:text-[#9CA3AF] focus:outline-none focus:border-[#A68B67] transition-colors"
        />
        <Button
          variant="ghost"
          size="sm"
          disabled={!trimmed || addNote.isPending}
          onClick={() => addNote.mutate({ id: application.id, note: trimmed }, { onSuccess: () => setNote('') })}
        >
          {addNote.isPending ? 'Saving…' : 'Add note'}
        </Button>
      </div>
    </div>
  )
}

// ─── Application card ──────────────────────────────────────────────────────────

function ApplicationCard({
  application,
  onReject,
  onRequestInfo,
}: {
  application: AgentApplication
  onReject: (a: AgentApplication) => void
  onRequestInfo: (a: AgentApplication) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const approveApplication = useApproveAgentApplication()

  const canAct = application.status === 'PENDING' || application.status === 'MORE_INFO_REQUESTED'

  return (
    <div className="bg-white border border-[#E5E1D8] rounded-xl p-5 hover:border-[#C4BDB4] transition-colors">
      <div className="flex items-start justify-between gap-4 flex-wrap">

        {/* Left: application info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 mb-1 flex-wrap">
            <p className="text-[15px] font-[700] font-sans text-[#1A1A1A]">{application.businessName}</p>
            <StatusBadge status={application.status} />
          </div>
          <p className="text-[13px] font-sans text-[#6B6460] mb-3">{application.contactName}</p>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[12px] font-sans text-[#9CA3AF]">
            <span className="flex items-center gap-1.5">
              <Mail size={11} aria-hidden="true" className="text-[#C4BDB4]" />
              {application.email}
            </span>
            <span className="flex items-center gap-1.5">
              <Phone size={11} aria-hidden="true" className="text-[#C4BDB4]" />
              {application.phone}
            </span>
            <span className="flex items-center gap-1.5">
              <MapPin size={11} aria-hidden="true" className="text-[#C4BDB4]" />
              {application.businessAddress}
            </span>
            <span className="flex items-center gap-1.5">
              <Globe2 size={11} aria-hidden="true" className="text-[#C4BDB4]" />
              {application.country}
            </span>
            <span className="flex items-center gap-1.5">
              <CalendarDays size={11} aria-hidden="true" className="text-[#C4BDB4]" />
              Applied {new Date(application.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          </div>

          {application.message && (
            <div className="mt-3 flex gap-2.5 bg-[#F9F7F2] rounded-lg px-3 py-2.5">
              <MessageSquare size={13} className="text-[#C4BDB4] mt-0.5 shrink-0" aria-hidden="true" />
              <p className="text-[13px] font-sans text-[#1A1A1A] whitespace-pre-wrap">{application.message}</p>
            </div>
          )}

          {application.status === 'REJECTED' && application.rejectionReason && (
            <p className="mt-3 text-[13px] font-sans text-red-700 bg-red-50 rounded-lg px-3 py-2.5 border border-red-100">
              Rejection reason: {application.rejectionReason}
            </p>
          )}
        </div>

        {/* Right: actions */}
        <div className="flex flex-col gap-2 shrink-0">
          {canAct && (
            <>
              <Button
                variant="accent"
                size="sm"
                disabled={approveApplication.isPending}
                onClick={() => approveApplication.mutate(application.id)}
              >
                {approveApplication.isPending ? 'Approving…' : 'Approve'}
              </Button>
              <Button variant="destructive" size="sm" onClick={() => onReject(application)}>
                Reject
              </Button>
              <Button variant="ghost" size="sm" onClick={() => onRequestInfo(application)}>
                Request info
              </Button>
            </>
          )}
          <Button variant="ghost" size="sm" onClick={() => setExpanded((e) => !e)} className="gap-1.5">
            <StickyNote size={12} aria-hidden="true" />
            Notes
            {expanded ? <ChevronUp size={12} aria-hidden="true" /> : <ChevronDown size={12} aria-hidden="true" />}
          </Button>
        </div>
      </div>

      {expanded && <NotesPanel application={application} />}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AgentApplicationsPage() {
  const [status, setStatus] = useState<AgentApplicationStatus | ''>('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [rejectTarget, setRejectTarget] = useState<AgentApplication | null>(null)
  const [infoTarget, setInfoTarget] = useState<AgentApplication | null>(null)

  const { data, isLoading } = useAgentApplications({
    status: status || undefined,
    page,
    limit: LIMIT,
  })

  const applications = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = data?.totalPages ?? 1

  const filtered = applications.filter((a) => {
    if (!search) return true
    const q = search.toLowerCase()
    return a.businessName.toLowerCase().includes(q) || a.email.toLowerCase().includes(q)
  })

  return (
    <div>

      {/* Header */}
      <div className="mb-7 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[26px] font-[700] font-sans text-[#1A1A1A] leading-tight">Agent Applications</h1>
          <p className="text-[13.5px] font-sans text-[#9CA3AF] mt-1">Review and action agent applications</p>
        </div>
        {total > 0 && (
          <p className="text-[13px] font-sans text-[#9CA3AF] self-end">
            {total.toLocaleString()} application{total !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* Search */}
      <div className="mb-4 relative max-w-[340px]">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#C4BDB4]" aria-hidden="true" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by business name or email…"
          className="w-full h-9 pl-9 pr-3 rounded-lg border border-[#E5E1D8] bg-white text-[13.5px] font-sans text-[#1A1A1A] placeholder:text-[#9CA3AF] focus:outline-none focus:border-[#A68B67] transition-colors"
        />
      </div>

      {/* Status tabs */}
      <div className="flex gap-0 mb-5 border-b border-[#E5E1D8] overflow-x-auto">
        {STATUS_TABS.map(({ value, label }) => (
          <button
            key={label}
            type="button"
            onClick={() => { setStatus(value); setPage(1) }}
            className={cn(
              'px-4 py-2.5 text-[13px] font-[600] font-sans border-b-2 -mb-px transition-colors whitespace-nowrap',
              status === value
                ? 'border-[#A68B67] text-[#A68B67]'
                : 'border-transparent text-[#9CA3AF] hover:text-[#1A1A1A]'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Cards */}
      {isLoading ? (
        <div className="grid gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white border border-[#E5E1D8] rounded-xl p-5 animate-pulse">
              <div className="flex justify-between gap-4">
                <div className="flex-1 space-y-3">
                  <div className="h-4 bg-[#F5F0E8] rounded w-40" />
                  <div className="h-3 bg-[#F5F0E8] rounded w-56" />
                </div>
                <div className="space-y-2">
                  <div className="h-8 bg-[#F5F0E8] rounded w-24" />
                  <div className="h-8 bg-[#F5F0E8] rounded w-24" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-[#E5E1D8] rounded-xl py-16 flex flex-col items-center gap-3 text-center">
          <div className="w-12 h-12 rounded-full bg-[#F5F0E8] flex items-center justify-center">
            <ClipboardList size={22} className="text-[#A68B67]" aria-hidden="true" />
          </div>
          <p className="text-[16px] font-[600] font-sans text-[#1A1A1A]">
            {search ? 'No matching applications' : 'No applications found'}
          </p>
          {(search || status) && (
            <p className="text-[13px] font-sans text-[#9CA3AF]">Try adjusting your filters.</p>
          )}
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((application) => (
            <ApplicationCard
              key={application.id}
              application={application}
              onReject={setRejectTarget}
              onRequestInfo={setInfoTarget}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-1 py-5">
          <p className="text-[12px] font-sans text-[#9CA3AF]">
            Page {page} of {totalPages} &middot; {total.toLocaleString()} total
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="h-8 px-4 rounded-lg border border-[#E5E1D8] text-[12px] font-[600] font-sans text-[#6B6460] hover:text-[#1A1A1A] hover:border-[#C4BDB4] disabled:opacity-40 transition-colors"
            >
              Prev
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="h-8 px-4 rounded-lg border border-[#E5E1D8] text-[12px] font-[600] font-sans text-[#6B6460] hover:text-[#1A1A1A] hover:border-[#C4BDB4] disabled:opacity-40 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {rejectTarget && <RejectDialog application={rejectTarget} onClose={() => setRejectTarget(null)} />}
      {infoTarget && <RequestInfoDialog application={infoTarget} onClose={() => setInfoTarget(null)} />}
    </div>
  )
}
