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

// ─── Status filter tabs ───────────────────────────────────────────────────────

const STATUS_TABS: { value: AgentApplicationStatus | ''; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'MORE_INFO_REQUESTED', label: 'More Info Requested' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
]

// ─── Reject dialog (reason required) ─────────────────────────────────────────

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
            Rejecting <strong className="text-primary">{application.businessName}</strong>. A reason is required and
            will be shared with the applicant.
          </DialogDescription>
        </DialogHeader>
        <div className="px-6 pb-2">
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason for rejection (required)…"
            rows={4}
            className="w-full px-3 py-2.5 rounded border border-border-warm bg-bg text-[13.5px] font-public-sans text-primary placeholder:text-muted-text focus:outline-none focus:border-accent transition-colors resize-none"
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

// ─── Request more info dialog ─────────────────────────────────────────────────

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
            Send <strong className="text-primary">{application.businessName}</strong> a message describing what
            additional information is needed.
          </DialogDescription>
        </DialogHeader>
        <div className="px-6 pb-2">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="What information do you need from the applicant?"
            rows={4}
            className="w-full px-3 py-2.5 rounded border border-border-warm bg-bg text-[13.5px] font-public-sans text-primary placeholder:text-muted-text focus:outline-none focus:border-accent transition-colors resize-none"
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

// ─── Internal notes (inline expand) ──────────────────────────────────────────

function NotesPanel({ application }: { application: AgentApplication }) {
  const [note, setNote] = useState('')
  const addNote = useAddAgentApplicationNote()
  const trimmed = note.trim()

  return (
    <div className="mt-3 pt-3 border-t border-border-warm space-y-2.5">
      <p className="text-[11px] font-[600] font-public-sans text-muted-text uppercase tracking-[0.06em]">
        Internal notes
      </p>
      {application.internalNotes ? (
        <p className="text-[13px] font-public-sans text-primary whitespace-pre-wrap bg-muted-bg/40 rounded px-3 py-2.5">
          {application.internalNotes}
        </p>
      ) : (
        <p className="text-[12.5px] font-public-sans text-muted-text">No internal notes yet.</p>
      )}
      <div className="flex gap-2">
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add a note (not visible to applicant)…"
          className="flex-1 h-9 px-3 rounded border border-border-warm bg-surface text-[13px] font-public-sans text-primary placeholder:text-muted-text focus:outline-none focus:border-accent transition-colors"
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

// ─── Application card ─────────────────────────────────────────────────────────

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
    <div className="bg-surface border border-border-warm rounded p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        {/* Left: application info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <p className="text-[15px] font-[600] font-public-sans text-primary">{application.businessName}</p>
            <StatusBadge status={application.status} />
          </div>
          <p className="text-[13px] font-public-sans text-muted-text mb-2.5">{application.contactName}</p>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12.5px] font-public-sans text-muted-text">
            <span className="flex items-center gap-1"><Mail size={11} aria-hidden="true" />{application.email}</span>
            <span className="flex items-center gap-1"><Phone size={11} aria-hidden="true" />{application.phone}</span>
            <span className="flex items-center gap-1"><MapPin size={11} aria-hidden="true" />{application.businessAddress}</span>
            <span className="flex items-center gap-1"><Globe2 size={11} aria-hidden="true" />{application.country}</span>
            <span className="flex items-center gap-1">
              <CalendarDays size={11} aria-hidden="true" />
              Applied {new Date(application.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          </div>

          {application.message && (
            <p className="mt-2.5 text-[13px] font-public-sans text-primary bg-muted-bg/40 rounded px-3 py-2 flex gap-2">
              <MessageSquare size={13} className="text-muted-text mt-0.5 shrink-0" aria-hidden="true" />
              <span className="whitespace-pre-wrap">{application.message}</span>
            </p>
          )}

          {application.status === 'REJECTED' && application.rejectionReason && (
            <p className="mt-2.5 text-[13px] font-public-sans text-error bg-error/10 rounded px-3 py-2">
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
          <Button variant="ghost" size="sm" onClick={() => setExpanded((e) => !e)} className="gap-1">
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
      <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[28px] leading-[1.3] font-[500] font-playfair text-primary">Agent Applications</h1>
          <p className="text-[14px] font-public-sans text-muted-text mt-1">Review and action agent applications</p>
        </div>
        {total > 0 && (
          <p className="text-[13px] font-public-sans text-muted-text self-end">
            {total.toLocaleString()} application{total !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* Search */}
      <div className="mb-4 relative max-w-[320px]">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-text" aria-hidden="true" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by business name or email…"
          className={cn(
            'w-full h-9 pl-9 pr-3 rounded border border-border-warm bg-surface',
            'text-[14px] font-public-sans text-primary placeholder:text-muted-text',
            'focus:outline-none focus:border-primary/40 transition-colors'
          )}
        />
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 mb-4 border-b border-border-warm overflow-x-auto">
        {STATUS_TABS.map(({ value, label }) => (
          <button
            key={label}
            type="button"
            onClick={() => { setStatus(value); setPage(1) }}
            className={cn(
              'px-4 py-2.5 text-[13px] font-[600] font-public-sans border-b-2 -mb-px transition-colors whitespace-nowrap',
              status === value ? 'border-primary text-primary' : 'border-transparent text-muted-text hover:text-primary'
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
            <div key={i} className="bg-surface border border-border-warm rounded p-5 animate-pulse">
              <div className="flex justify-between gap-4">
                <div className="flex-1 space-y-3">
                  <div className="h-4 bg-muted-bg rounded w-40" />
                  <div className="h-3 bg-muted-bg rounded w-56" />
                </div>
                <div className="space-y-2">
                  <div className="h-8 bg-muted-bg rounded w-24" />
                  <div className="h-8 bg-muted-bg rounded w-24" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-surface border border-border-warm rounded py-16 flex flex-col items-center gap-3 text-center">
          <div className="w-12 h-12 rounded-full bg-muted-bg flex items-center justify-center">
            <ClipboardList size={22} className="text-muted-text" aria-hidden="true" />
          </div>
          <p className="text-[16px] font-[600] font-public-sans text-primary">
            {search ? 'No matching applications' : 'No applications found'}
          </p>
          {(search || status) && (
            <p className="text-[13px] font-public-sans text-muted-text">Try adjusting your filters.</p>
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

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-1 py-4">
          <p className="text-[12px] font-public-sans text-muted-text">
            Page {page} of {totalPages} &middot; {total.toLocaleString()} total
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="h-8 px-3 rounded border border-border-warm text-[12px] font-[500] font-public-sans text-muted-text hover:text-primary hover:bg-muted-bg disabled:opacity-40 transition-colors"
            >
              Prev
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="h-8 px-3 rounded border border-border-warm text-[12px] font-[500] font-public-sans text-muted-text hover:text-primary hover:bg-muted-bg disabled:opacity-40 transition-colors"
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
