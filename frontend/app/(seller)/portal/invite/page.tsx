'use client'

import { InviteLinkCard } from '@/components/seller-portal/InviteLinkCard'

// Brands bring their own customers here: 0% commission on their orders and instant payout.
export default function InviteBuyersPage() {
  return (
    <div className="max-w-3xl">
      <h1 className="text-[24px] font-[700] font-sans text-[#0F241D] leading-tight mb-1">Invite your buyers</h1>
      <p className="text-[13px] font-sans text-[#183D33B3] mb-5">
        Bring your existing customers to Solomon Bharat. You pay no commission on their orders and are paid as soon as they pay.
      </p>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <InviteLinkCard />
      </div>
    </div>
  )
}
