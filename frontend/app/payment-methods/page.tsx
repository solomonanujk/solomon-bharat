'use client'

import { CreditCard } from 'lucide-react'
import { AccountPageWrapper } from '@/components/shared/AccountPageWrapper'

// There is no backend concept of a stored/saved payment method — every order
// is paid 100% in advance at checkout (bank transfer until an online gateway is
// live). This page is informational only; it must never fake saved cards.

export default function PaymentMethodsPage() {
  return (
    <AccountPageWrapper title="Payment Methods" description="How you pay Solomon Bharat.">
      <div className="max-w-[560px] mx-auto bg-surface border border-border-warm rounded p-8 text-center">
        <div className="w-14 h-14 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4 text-accent">
          <CreditCard size={24} aria-hidden="true" />
        </div>
        <h2 className="text-[18px] font-[700] font-sans text-primary">
          100% advance payment
        </h2>
        <p className="text-[14px] font-sans text-muted-text mt-2 leading-relaxed">
          Every order is paid in full before it is confirmed, in your local currency. After you place an
          order we email you bank transfer details, and the order is confirmed once payment arrives.
          There&apos;s nothing to save or manage here.
        </p>
      </div>
    </AccountPageWrapper>
  )
}
