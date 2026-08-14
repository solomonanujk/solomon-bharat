'use client'

import { CreditCard } from 'lucide-react'
import { AccountPageWrapper } from '@/components/shared/AccountPageWrapper'

// There is no backend concept of a stored/saved payment method — buyers pay
// via PayPal per order at checkout (AGENTS.md → Orders: "Buyer pays via
// PayPal only"). This page is intentionally informational only; it must
// never fake a list of saved cards/methods.

export default function PaymentMethodsPage() {
  return (
    <AccountPageWrapper title="Payment Methods" description="How you pay Solomon Bharat.">
      <div className="max-w-[560px] mx-auto bg-surface border border-border-warm rounded p-8 text-center">
        <div className="w-14 h-14 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4 text-accent">
          <CreditCard size={24} aria-hidden="true" />
        </div>
        <h2 className="text-[18px] font-[600] font-public-sans text-primary">
          Paid securely via PayPal
        </h2>
        <p className="text-[14px] font-public-sans text-muted-text mt-2 leading-relaxed">
          Solomon Bharat processes every order through PayPal at checkout — there's nothing to
          save or manage here. You'll be prompted to pay with PayPal each time you place an order.
        </p>
      </div>
    </AccountPageWrapper>
  )
}
