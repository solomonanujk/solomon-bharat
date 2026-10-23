'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  useRequestWhatsAppCode,
  useUnlinkWhatsApp,
  useVerifyWhatsAppCode,
  useWhatsAppLink,
} from '@/hooks/queries/useWhatsApp'

const INPUT_CLS =
  'w-full h-10 px-3.5 rounded-lg border border-[#D9E2DA] bg-[#E7EDE7] text-[14px] font-sans text-[#0F241D] placeholder:text-[#6B7E6B] focus:outline-none focus:border-[#183D33] transition-colors'

/** Links the seller's WhatsApp number: enter number, receive a code on WhatsApp, type it back. */
export function WhatsAppLinkForm() {
  const { data: status, isLoading } = useWhatsAppLink()
  const requestCode = useRequestWhatsAppCode()
  const verify = useVerifyWhatsAppCode()
  const unlink = useUnlinkWhatsApp()

  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [codeSent, setCodeSent] = useState(false)

  if (isLoading) return <div className="h-16 animate-pulse rounded-lg bg-[#E7EDE7]" />

  if (status?.linked) {
    return (
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1">
          <p className="text-[14px] font-[600] font-sans text-[#0F241D]">Linked: {status.number}</p>
          <p className="text-[12.5px] font-sans text-[#183D33B3] mt-0.5">
            Message Solomon Bharat from this number to add products, update stock and check their status.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => unlink.mutate()} disabled={unlink.isPending}>
          {unlink.isPending ? 'Unlinking…' : 'Unlink'}
        </Button>
      </div>
    )
  }

  function handleSend() {
    requestCode.mutate({ phone: phone.trim() }, { onSuccess: () => setCodeSent(true) })
  }

  function handleVerify() {
    verify.mutate({ code: code.trim() }, { onSuccess: () => { setCode(''); setCodeSent(false) } })
  }

  return (
    <div className="space-y-4">
      <p className="text-[12.5px] font-sans text-[#183D33B3] leading-relaxed">
        List products by sending photos and a message on WhatsApp, in English, Hindi or Hinglish. First, confirm
        your WhatsApp number: we send a 6-digit code to it.
      </p>

      {!codeSent ? (
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+91 98765 43210"
            className={INPUT_CLS}
            aria-label="WhatsApp number"
          />
          <Button size="md" onClick={handleSend} disabled={requestCode.isPending || phone.trim().length < 8}>
            {requestCode.isPending ? 'Sending…' : 'Send code'}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="6-digit code"
              className={INPUT_CLS}
              aria-label="Verification code"
            />
            <Button size="md" onClick={handleVerify} disabled={verify.isPending || code.length !== 6}>
              {verify.isPending ? 'Checking…' : 'Verify'}
            </Button>
          </div>
          <button
            type="button"
            className="text-[12.5px] font-sans text-[#183D33] underline"
            onClick={() => { setCodeSent(false); setCode('') }}
          >
            Use a different number
          </button>
        </div>
      )}
    </div>
  )
}
