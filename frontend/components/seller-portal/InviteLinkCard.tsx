'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useAddOwnBuyers, useMyBrandInvite } from '@/hooks/queries/useBrandPortal'

export function InviteLinkCard() {
  const { data, isLoading } = useMyBrandInvite()
  const addOwnBuyers = useAddOwnBuyers()
  const [emailText, setEmailText] = useState('')

  function submitEmails() {
    const emails = emailText.split(/[\s,;]+/).map((e) => e.trim()).filter((e) => e.includes('@'))
    if (emails.length === 0) return
    addOwnBuyers.mutate(emails.slice(0, 200), {
      onSuccess: (r) => {
        setEmailText('')
        toast.success(
          `${r.linked.length} linked, ${r.invited.length} invited by email` +
            (r.skipped.length ? `, ${r.skipped.length} skipped (already ordered from you here)` : ''),
        )
      },
    })
  }
  const url = data && typeof window !== 'undefined' ? `${window.location.origin}/invite/${data.code}` : ''

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Invite link copied')
    } catch {
      toast.error('Could not copy. Select the link and copy it manually.')
    }
  }

  return (
    <section className="rounded-xl border border-line bg-white p-6 lg:col-span-2">
      <h2 className="type-h3 text-ink">Your invite link</h2>
      <p className="text-[13px] font-sans text-muted mt-1">
        Share this with your existing customers. Buyers who join through it are yours: you pay <strong>0% commission</strong> on
        their orders and are paid as soon as they pay. Buyers who have already ordered from you on Solomon Bharat can&apos;t be
        added this way.
      </p>
      {isLoading || !data ? (
        <div className="h-10 mt-3 rounded bg-ivory animate-pulse" />
      ) : (
        <>
          <div className="mt-3 flex flex-col sm:flex-row gap-2">
            <input readOnly value={url} onFocus={(e) => e.target.select()}
              className="flex-1 min-w-0 h-10 px-3 rounded border border-line text-[13px] font-mono text-ink bg-ivory" />
            <Button type="button" variant="primary" size="sm" onClick={copy}>Copy link</Button>
          </div>
          <p className="text-[12px] font-sans text-muted mt-2">
            {data.ownBuyerCount} buyer{data.ownBuyerCount === 1 ? '' : 's'} joined through your link
          </p>
          <div className="mt-4">
            <label htmlFor="own-buyer-emails" className="block text-[13px] font-[600] font-sans text-ink mb-1.5">
              Or add customers by email (up to 200)
            </label>
            <textarea id="own-buyer-emails" rows={3} value={emailText} onChange={(e) => setEmailText(e.target.value)}
              placeholder="one@shop.co.uk, two@boutique.com"
              className="w-full px-3 py-2 rounded border border-line text-[13px] font-sans" />
            <Button type="button" variant="secondary" size="sm" className="mt-2" onClick={submitEmails} disabled={addOwnBuyers.isPending || !emailText.trim()}>
              {addOwnBuyers.isPending ? 'Adding…' : 'Add customers'}
            </Button>
          </div>
        </>
      )}
    </section>
  )
}
