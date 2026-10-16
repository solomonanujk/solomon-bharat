'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useChangePassword } from '@/hooks/queries/useAuth'

/** New password + confirm. Asks for the current password unless the user is still on the
 *  temporary one emailed on approval (they have just typed it to sign in). */
export function ChangePasswordForm({ askCurrent, onDone, submitLabel = 'Save new password' }: {
  askCurrent: boolean
  onDone?: () => void
  submitLabel?: string
}) {
  const change = useChangePassword()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (next.length < 8) return setError('Use at least 8 characters.')
    if (next !== confirm) return setError('The two passwords do not match.')
    setError('')
    change.mutate(
      { currentPassword: askCurrent ? current : undefined, newPassword: next },
      {
        onSuccess: () => {
          setCurrent('')
          setNext('')
          setConfirm('')
          onDone?.()
        },
      },
    )
  }

  const label = 'block text-[12.5px] font-[600] font-sans text-[#0F241D] mb-1'
  return (
    <form onSubmit={submit} className="space-y-3">
      {askCurrent && (
        <div>
          <label className={label} htmlFor="cp-current">Current password</label>
          <Input id="cp-current" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
        </div>
      )}
      <div>
        <label className={label} htmlFor="cp-new">New password</label>
        <Input id="cp-new" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} placeholder="At least 8 characters" required />
      </div>
      <div>
        <label className={label} htmlFor="cp-confirm">Confirm new password</label>
        <Input id="cp-confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} error={error || undefined} required />
      </div>
      <Button type="submit" disabled={change.isPending} className="w-full sm:w-auto">
        {change.isPending ? 'Saving…' : submitLabel}
      </Button>
    </form>
  )
}
