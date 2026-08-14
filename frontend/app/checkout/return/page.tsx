'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { useCartStore } from '@/lib/store/useCartStore'
import { useCapturePayment } from '@/hooks/queries/usePayments'
import { NavBar } from '@/components/shared/NavBar'
import { Footer } from '@/components/shared/Footer'

const PAYMENT_ID_KEY = 'sb_checkout_payment_id'
const ORDER_ID_KEY = 'sb_checkout_order_id'

/**
 * PayPal redirects the browser here after the buyer approves (or cancels) the
 * payment on PayPal's hosted page, appending its own `token`/`PayerID` query
 * params. Those identify PayPal's order, not our internal payment — so the
 * paymentId returned by useCheckout() (stashed in sessionStorage before the
 * redirect) is what actually drives the capture call.
 */
function CheckoutReturnInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const clearCart = useCartStore((s) => s.clearCart)
  const capturePayment = useCapturePayment()
  const [status, setStatus] = useState<'capturing' | 'success' | 'error'>('capturing')
  const attempted = useRef(false)

  const cancelled = searchParams.get('cancel') != null || searchParams.get('cancelled') != null

  useEffect(() => {
    if (attempted.current) return
    attempted.current = true

    if (cancelled) {
      setStatus('error')
      return
    }

    const paymentId = typeof window !== 'undefined' ? sessionStorage.getItem(PAYMENT_ID_KEY) : null
    if (!paymentId) {
      setStatus('error')
      return
    }

    capturePayment.mutate(paymentId, {
      onSuccess: () => {
        clearCart()
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem(PAYMENT_ID_KEY)
          sessionStorage.removeItem(ORDER_ID_KEY)
        }
        setStatus('success')
      },
      onError: () => setStatus('error'),
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cancelled])

  return (
    <div className="bg-bg min-h-screen flex flex-col">
      <NavBar />

      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="max-w-[440px] w-full text-center bg-surface border border-border-warm rounded p-8 flex flex-col items-center gap-4">
          {status === 'capturing' && (
            <>
              <Loader2 size={32} className="text-accent animate-spin" aria-hidden="true" />
              <h1 className="font-playfair text-[20px] font-[500] text-primary">Confirming your payment…</h1>
              <p className="text-[14px] font-public-sans text-muted-text">
                Please don&apos;t close this window while we confirm your order with PayPal.
              </p>
            </>
          )}

          {status === 'success' && (
            <>
              <CheckCircle2 size={32} className="text-success" aria-hidden="true" />
              <h1 className="font-playfair text-[20px] font-[500] text-primary">Order confirmed</h1>
              <p className="text-[14px] font-public-sans text-muted-text">
                Your payment was successful and your order has been placed.
              </p>
              <button
                type="button"
                onClick={() => router.push('/orders')}
                className="mt-2 h-11 px-8 rounded bg-primary text-white font-[600] font-public-sans text-[14px] hover:bg-primary/90 transition-colors"
              >
                View my orders
              </button>
            </>
          )}

          {status === 'error' && (
            <>
              <XCircle size={32} className="text-error" aria-hidden="true" />
              <h1 className="font-playfair text-[20px] font-[500] text-primary">
                {cancelled ? 'Payment cancelled' : 'We couldn’t confirm your payment'}
              </h1>
              <p className="text-[14px] font-public-sans text-muted-text">
                {cancelled
                  ? 'You cancelled the PayPal checkout. Your cart is still saved.'
                  : 'Something went wrong confirming your payment. If you were charged, contact support — otherwise your cart is still saved and you can try again.'}
              </p>
              <Link
                href="/cart"
                className="mt-2 h-11 px-8 inline-flex items-center rounded bg-primary text-white font-[600] font-public-sans text-[14px] hover:bg-primary/90 transition-colors"
              >
                Return to cart
              </Link>
            </>
          )}
        </div>
      </main>

      <Footer />
    </div>
  )
}

export default function CheckoutReturnPage() {
  return (
    <Suspense>
      <CheckoutReturnInner />
    </Suspense>
  )
}
