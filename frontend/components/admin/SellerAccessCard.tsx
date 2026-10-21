'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import {
  AlertTriangle,
  Check,
  Copy,
  KeyRound,
  Link2,
  Mail,
  RotateCcw,
  ShieldCheck,
  X,
} from 'lucide-react'
import { useCreateSignInLink, useResetTempPassword, type SignInLink } from '@/hooks/queries/useAdmin'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import type { SellerAccountUser } from '@/types'

// ─── Copy button ──────────────────────────────────────────────────────────────

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      toast.success(`${label} copied`)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Could not copy — select the text and copy it manually.')
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={`Copy ${label.toLowerCase()}`}
      className="shrink-0 inline-flex items-center gap-1 h-7 px-2 rounded-md border border-[#D9E2DA] bg-white text-[12px] font-[600] font-sans text-[#183D33] hover:bg-[#E7EDE7] transition-colors"
    >
      {copied ? <Check size={12} aria-hidden="true" /> : <Copy size={12} aria-hidden="true" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

/** A long value (email, link) that must stay readable and copyable on a phone. */
function SecretRow({ label, value, copyLabel }: { label: string; value: string; copyLabel: string }) {
  return (
    <div>
      <p className="text-[11px] font-[700] font-sans text-[#6B7E6B] uppercase tracking-[0.06em] mb-1">{label}</p>
      <div className="flex items-start gap-2">
        <code className="flex-1 min-w-0 block px-2.5 py-2 rounded-lg bg-[#E7EDE7] border border-[#D9E2DA] text-[13px] font-mono text-[#0F241D] break-all">
          {value}
        </code>
        <CopyButton value={value} label={copyLabel} />
      </div>
    </div>
  )
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ─── Card ─────────────────────────────────────────────────────────────────────

/**
 * "Seller access" — everything an admin needs to get a seller (or agent) signed in,
 * and to re-share it later.
 *
 * It deliberately cannot show an existing password: passwords are stored only as
 * bcrypt hashes, so no API can return one. Instead it shows the login id, whether the
 * seller has chosen their own password yet, and two actions: a fresh one-time
 * set-password link, or a brand-new temporary password shown here exactly once.
 */
export function SellerAccessCard({
  user,
  businessName,
}: {
  user: SellerAccountUser
  businessName: string
}) {
  const createLink = useCreateSignInLink()
  const resetPassword = useResetTempPassword()

  const [link, setLink] = useState<SignInLink | null>(null)
  const [tempPassword, setTempPassword] = useState<string | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)

  const onTempPassword = user.mustChangePassword

  return (
    <section className="bg-white border border-[#D9E2DA] rounded-xl overflow-hidden mb-5">
      <div className="px-5 py-3.5 border-b border-[#D9E2DA] bg-[#E7EDE7]/40 flex items-center gap-2">
        <KeyRound size={14} className="text-[#183D33]" aria-hidden="true" />
        <h3 className="text-[12px] font-[600] font-sans text-[#183D33B3] uppercase tracking-[0.06em]">
          Seller access
        </h3>
      </div>

      <div className="px-5 py-4 space-y-5">
        {/* (a) Login ID + the direct email link */}
        <div>
          <SecretRow label="Login ID (email)" value={user.email} copyLabel="Login ID" />
          <a
            href={`mailto:${user.email}`}
            className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-[600] font-sans text-[#183D33] hover:underline"
          >
            <Mail size={13} aria-hidden="true" />
            Email {businessName}
          </a>
        </div>

        {/* (b) Password status — derived from the account, never from a stored password */}
        <div>
          <p className="text-[11px] font-[700] font-sans text-[#6B7E6B] uppercase tracking-[0.06em] mb-1.5">
            Password
          </p>
          <p
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12.5px] font-[600] font-sans ${
              onTempPassword
                ? 'bg-[#FFF7E8] text-[#8A5F10] border border-[#E9A23B]'
                : 'bg-selected text-forest border border-[#D9E2DA]'
            }`}
          >
            {onTempPassword ? (
              <AlertTriangle size={12} aria-hidden="true" />
            ) : (
              <ShieldCheck size={12} aria-hidden="true" />
            )}
            {onTempPassword ? 'Temporary password not yet changed' : 'Seller has set their own password'}
          </p>
          <p className="mt-2 text-[12px] font-sans text-[#6B7E6B]">
            Account last updated {formatDate(user.updatedAt)}
            {!onTempPassword && ' — the closest record of when the password was last changed.'}
          </p>
          <p className="mt-1.5 text-[12px] font-sans text-[#6B7E6B]">
            Passwords are stored encrypted (hashed) and cannot be read by anyone, including admins. To get
            this seller in, send them a sign-in link or set a new temporary password below.
          </p>
        </div>

        {/* (c) + (d) actions */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            className="gap-1.5"
            disabled={createLink.isPending}
            onClick={() =>
              createLink.mutate(user.id, {
                onSuccess: (data) => {
                  setLink(data)
                  toast.success('Sign-in link created.')
                },
              })
            }
          >
            <Link2 size={13} aria-hidden="true" />
            {createLink.isPending ? 'Creating…' : 'Generate sign-in link'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5"
            disabled={resetPassword.isPending}
            onClick={() => setConfirmReset(true)}
          >
            <RotateCcw size={13} aria-hidden="true" />
            Reset to a new temporary password
          </Button>
        </div>

        {/* (c) result — the one-time link */}
        {link && (
          <div className="rounded-lg border border-[#D9E2DA] bg-[#E7EDE7]/50 p-3.5 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <p className="text-[13px] font-[700] font-sans text-[#0F241D]">One-time sign-in link</p>
              <button
                type="button"
                onClick={() => setLink(null)}
                aria-label="Dismiss sign-in link"
                className="shrink-0 p-1 rounded-md text-[#6B7E6B] hover:bg-white transition-colors"
              >
                <X size={14} aria-hidden="true" />
              </button>
            </div>
            <SecretRow label="Paste into WhatsApp or email" value={link.url} copyLabel="Sign-in link" />
            <p className="text-[12px] font-sans text-[#6B7E6B]">
              This link works <strong>once</strong> and expires in {link.expiresInDays} days. Generate a new one
              any time — older links stop working once a password is set.
            </p>
          </div>
        )}

        {/* (d) result — the plaintext temporary password, shown once */}
        {tempPassword && (
          <div className="rounded-lg border border-[#E9A23B] bg-[#FFF7E8] p-3.5 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <p className="text-[13px] font-[700] font-sans text-[#8A5F10]">New temporary password</p>
              <button
                type="button"
                onClick={() => setTempPassword(null)}
                aria-label="Dismiss temporary password"
                className="shrink-0 p-1 rounded-md text-[#8A5F10] hover:bg-white transition-colors"
              >
                <X size={14} aria-hidden="true" />
              </button>
            </div>
            <SecretRow label="Share this with the seller" value={tempPassword} copyLabel="Temporary password" />
            <p className="text-[12px] font-sans text-[#8A5F10]">
              Copy it now — <strong>it will not be shown again</strong> and cannot be recovered. The seller has
              also been emailed a sign-in link, and will be asked to choose their own password on first sign-in.
            </p>
          </div>
        )}
      </div>

      {/* (d) confirmation — resetting signs the seller out of every device */}
      <Dialog open={confirmReset} onOpenChange={setConfirmReset}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset to a new temporary password?</DialogTitle>
            <DialogDescription>
              This replaces the current password for <strong className="text-[#0F241D]">{user.email}</strong>,
              signs {businessName} out everywhere, and emails them a sign-in link. The new temporary password is
              shown to you once, right after.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmReset(false)}>
              Cancel
            </Button>
            <Button
              variant="accent"
              disabled={resetPassword.isPending}
              onClick={() =>
                resetPassword.mutate(user.id, {
                  onSuccess: (data) => {
                    setTempPassword(data.tempPassword)
                    setConfirmReset(false)
                    toast.success(
                      data.emailSent
                        ? 'New temporary password set and emailed to the seller.'
                        : 'New temporary password set — the email could not be sent, so share it yourself.',
                    )
                  },
                })
              }
            >
              {resetPassword.isPending ? 'Resetting…' : 'Reset password'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
