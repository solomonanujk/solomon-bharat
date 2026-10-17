'use client'

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { useLogout } from '@/hooks/queries/useAuth'
import { ChangePasswordForm } from './ChangePasswordForm'

/** Right after an approved seller or agent first signs in with the emailed temporary
 *  password, ask them to pick their own before they carry on. */
export function ChangePasswordGate() {
  const user = useAuthStore((s) => s.user)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const logout = useLogout()
  if (!isAuthenticated || !user?.mustChangePassword) return null

  return (
    <Dialog open onOpenChange={() => undefined}>
      <DialogContent showClose={false} className="max-w-md">
        <DialogHeader>
          <DialogTitle>Set your own password</DialogTitle>
          <DialogDescription>
            You signed in with the temporary password from your approval email. Choose a new password to keep your account secure.
          </DialogDescription>
        </DialogHeader>
        <ChangePasswordForm askCurrent={false} submitLabel="Save and continue" />
        <button type="button" onClick={() => logout.mutate()} className="mt-3 text-[12.5px] font-sans text-[#183D33B3] hover:underline">
          Sign out instead
        </button>
      </DialogContent>
    </Dialog>
  )
}
