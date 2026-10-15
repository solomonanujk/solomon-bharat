'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Script from 'next/script'
import { Button } from '@/components/ui/button'

// UK/EU GDPR + PECR: analytics cookies need opt-in consent, so Google Analytics
// and Microsoft Clarity are only loaded after "Accept". The choice is stored on this device and can be
// changed any time from the footer's "Cookie settings" link.

const STORAGE_KEY = 'sb-cookie-consent'
const OPEN_EVENT = 'sb:open-cookie-settings'
const GA_ID = process.env.NEXT_PUBLIC_GA_ID
// Microsoft Clarity (heatmaps and session recordings). Public project id, not a secret.
const CLARITY_ID = process.env.NEXT_PUBLIC_CLARITY_ID ?? 'yy0gg7k3v8'

type Consent = 'accepted' | 'rejected'

function readConsent(): Consent | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return v === 'accepted' || v === 'rejected' ? v : null
  } catch {
    return null
  }
}

/** Reopens the banner — used by the footer's "Cookie settings" link. */
export function openCookieSettings() {
  window.dispatchEvent(new Event(OPEN_EVENT))
}

export function CookieConsent() {
  const [consent, setConsent] = useState<Consent | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const stored = readConsent()
    // Reading device storage after mount; it can't be known during SSR.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setConsent(stored)
    setOpen(stored === null)
    const reopen = () => setOpen(true)
    window.addEventListener(OPEN_EVENT, reopen)
    return () => window.removeEventListener(OPEN_EVENT, reopen)
  }, [])

  function choose(value: Consent) {
    try {
      localStorage.setItem(STORAGE_KEY, value)
    } catch {
      // Storage blocked: the choice still applies for this visit.
    }
    if (value === 'rejected' && consent === 'accepted') {
      // GA/Clarity are already loaded on this page; a reload is the only clean way to stop it.
      window.location.reload()
    }
    setConsent(value)
    setOpen(false)
  }

  return (
    <>
      {GA_ID && consent === 'accepted' && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
          <Script id="ga-init" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_ID}',{anonymize_ip:true});`}
          </Script>
        </>
      )}
      {CLARITY_ID && consent === 'accepted' && (
        <Script id="ms-clarity" strategy="afterInteractive">
          {`(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","${CLARITY_ID}");`}
        </Script>
      )}
      {open && (
        <div
          role="dialog"
          aria-label="Cookie preferences"
          className="fixed inset-x-0 bottom-0 z-[60] p-4 sm:p-6 pointer-events-none"
        >
          <div className="pointer-events-auto mx-auto max-w-[760px] bg-white border border-line rounded shadow-[0_8px_24px_rgba(32,32,30,0.12)] p-5 flex flex-col sm:flex-row sm:items-center gap-4">
            <p className="flex-1 font-sans text-[14px] leading-[20px] text-ink">
              We use essential cookies to run the site. With your permission we also use analytics cookies to improve
              it. See our{' '}
              <Link href="/cookies" className="underline underline-offset-4">
                Cookie Policy
              </Link>
              .
            </p>
            <div className="flex gap-2 flex-shrink-0">
              <Button variant="ghost" size="md" onClick={() => choose('rejected')}>
                Reject
              </Button>
              <Button variant="primary" size="md" onClick={() => choose('accepted')}>
                Accept
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
