'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Building2, User, Phone, MapPin, Landmark, Bell, CalendarDays, AlertTriangle, RotateCcw, Package, Upload } from 'lucide-react'
import { useSetSellerInternalRating, useAdminSeller } from '@/hooks/queries/useSellers'
import { useSuspendUser, useReactivateUser } from '@/hooks/queries/useAdmin'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'

// ─── Sub-components ───────────────────────────────────────────────────────────

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-[#D9E2DA] rounded-xl overflow-hidden">
      <div className="px-5 py-3.5 border-b border-[#D9E2DA] bg-[#E7EDE7]/40">
        <h3 className="text-[12px] font-[600] font-sans text-[#183D33B3] uppercase tracking-[0.06em]">
          {title}
        </h3>
      </div>
      <div className="px-5 py-4 space-y-3.5">{children}</div>
    </div>
  )
}

function InfoRow({ icon: Icon, label, value }: { icon?: React.ElementType; label: string; value?: React.ReactNode }) {
  if (value === undefined || value === null || value === '') return null
  return (
    <div className="flex items-start gap-2.5">
      {Icon && <Icon size={14} className="text-[#183D33B3] mt-0.5 shrink-0" aria-hidden="true" />}
      <div>
        <p className="text-[11px] font-[600] font-sans text-[#183D33B3] uppercase tracking-[0.06em] mb-0.5">
          {label}
        </p>
        <div className="text-[14px] font-sans text-[#0F241D] leading-[1.5]">{value}</div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminSellerDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { data: seller, isLoading, isError } = useAdminSeller(params.id)
  const suspendUser = useSuspendUser()
  const reactivateUser = useReactivateUser()
  const [confirmAction, setConfirmAction] = useState<'suspend' | 'reactivate' | null>(null)

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto animate-pulse space-y-5">
        <div className="h-5 bg-[#E7EDE7] rounded w-24" />
        <div className="h-32 bg-white border border-[#D9E2DA] rounded-xl" />
        <div className="grid grid-cols-2 gap-5">
          <div className="h-40 bg-white border border-[#D9E2DA] rounded-xl" />
          <div className="h-40 bg-white border border-[#D9E2DA] rounded-xl" />
        </div>
      </div>
    )
  }

  if (!seller) {
    return (
      <div className="max-w-3xl mx-auto">
        <button
          type="button"
          onClick={() => router.push('/admin/sellers')}
          className="flex items-center gap-1.5 text-[13px] font-sans text-[#183D33B3] hover:text-[#0F241D] mb-6 transition-colors"
        >
          <ArrowLeft size={14} /> Back
        </button>
        <div className="bg-white border border-[#D9E2DA] rounded-xl py-20 flex flex-col items-center gap-3">
          <Building2 size={28} className="text-[#D9E2DA]" aria-hidden="true" />
          <p className="text-[15px] font-[600] font-sans text-[#0F241D]">
            {isError ? 'Failed to load seller — check that the backend is running' : 'Seller not found'}
          </p>
          {isError && <p className="text-[12px] font-sans text-[#183D33B3]">ID: {params.id}</p>}
        </div>
      </div>
    )
  }

  const ratingCard = <InternalRatingCard sellerId={seller.id} rating={seller.internalRating ?? null} notes={seller.internalNotes ?? ''} />

  const notificationPrefs = seller.notificationPrefs
    ? Object.entries(seller.notificationPrefs).filter(([, enabled]) => enabled)
    : []

  return (
    <div className="max-w-3xl mx-auto">
      {/* Back + actions */}
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <button
          type="button"
          onClick={() => router.push('/admin/sellers')}
          className="flex items-center gap-1.5 text-[13px] font-sans text-[#183D33B3] hover:text-[#0F241D] transition-colors"
        >
          <ArrowLeft size={14} />
          Back to sellers
        </button>

        <div className="flex items-center gap-2.5">
          <Button variant="destructive" size="sm" onClick={() => setConfirmAction('suspend')} className="gap-1.5">
            <AlertTriangle size={13} aria-hidden="true" />
            Suspend seller
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setConfirmAction('reactivate')} className="gap-1.5">
            <RotateCcw size={13} aria-hidden="true" />
            Reactivate seller
          </Button>
        </div>
      </div>

      {ratingCard}

      {/* Data gap note — see final report */}
      <p className="text-[12px] font-sans text-[#183D33B3] mb-5 px-4 py-2.5 rounded border border-[#D9E2DA] bg-[#E7EDE7]/40">
        Note: this seller directory does not expose the underlying account&apos;s active/suspended status, so both
        actions are always shown. Confirm the seller&apos;s current status in the Users section before acting.
      </p>

      {/* Hero */}
      <div className="bg-white border border-[#D9E2DA] rounded-xl overflow-hidden mb-5 px-6 py-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-[#E7EDE7] border border-[#D9E2DA] flex items-center justify-center shrink-0">
            <Building2 size={22} className="text-[#183D33]" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-[24px] leading-[1.3] font-[500] font-sans text-[#0F241D]">{seller.businessName}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-[600] font-sans bg-selected text-forest">
                {seller.sellerType === 'MARKETPLACE' ? 'Marketplace brand' : 'Curated seller'}
              </span>
              {seller.brand?.name && (
                <Link href="/admin/brands" className="text-[13px] font-sans text-forest underline underline-offset-2">
                  {seller.brand.name}
                </Link>
              )}
            </p>
            <p className="text-[13px] font-sans text-[#183D33B3] mt-0.5 flex items-center gap-1.5">
              <CalendarDays size={12} aria-hidden="true" />
              Seller since{' '}
              {new Date(seller.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
        </div>
      </div>

      {/* Content grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <InfoCard title="Contact">
          <InfoRow icon={User} label="Contact name" value={seller.contactName} />
          <InfoRow icon={Phone} label="Phone" value={seller.phone} />
          <InfoRow icon={MapPin} label="Business address" value={seller.businessAddress} />
        </InfoCard>

        <InfoCard title="Banking">
          <InfoRow icon={Landmark} label="Bank details" value={seller.bankDetails ?? '—'} />
        </InfoCard>

        <InfoCard title="Notification preferences">
          {notificationPrefs.length > 0 ? (
            <ul className="space-y-1.5">
              {notificationPrefs.map(([key]) => (
                <li key={key} className="flex items-center gap-2 text-[13px] font-sans text-[#0F241D]">
                  <Bell size={12} className="text-[#183D33]" aria-hidden="true" />
                  {key.replace(/_/g, ' ')}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] font-sans text-[#183D33B3]">No preferences enabled</p>
          )}
        </InfoCard>

        <InfoCard title="Catalog">
          <Link
            href={`/admin/products?sellerId=${seller.id}`}
            className="flex items-center gap-2 text-[13px] font-[600] font-sans text-[#183D33] hover:underline"
          >
            <Package size={14} aria-hidden="true" />
            View products from this seller
          </Link>
          <Link
            href={`/admin/sellers/${seller.id}/product-import`}
            className="flex items-center gap-2 text-[13px] font-[600] font-sans text-[#183D33] hover:underline mt-2.5"
          >
            <Upload size={14} aria-hidden="true" />
            Import products from a spreadsheet
          </Link>
        </InfoCard>
      </div>

      {/* Confirm dialog */}
      <Dialog open={confirmAction !== null} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirmAction === 'suspend' ? 'Suspend seller' : 'Reactivate seller'}</DialogTitle>
            <DialogDescription>
              {confirmAction === 'suspend'
                ? `This will suspend the account linked to ${seller.businessName}, blocking their login.`
                : `This will reactivate the account linked to ${seller.businessName}.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmAction(null)}>
              Cancel
            </Button>
            <Button
              variant={confirmAction === 'suspend' ? 'destructive' : 'accent'}
              disabled={suspendUser.isPending || reactivateUser.isPending}
              onClick={() => {
                if (confirmAction === 'suspend') {
                  suspendUser.mutate(seller.userId, { onSuccess: () => setConfirmAction(null) })
                } else {
                  reactivateUser.mutate(seller.userId, { onSuccess: () => setConfirmAction(null) })
                }
              }}
            >
              {confirmAction === 'suspend'
                ? suspendUser.isPending ? 'Suspending…' : 'Confirm suspend'
                : reactivateUser.isPending ? 'Reactivating…' : 'Confirm reactivate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/** Admin-only performance rating; the seller never sees it. */
function InternalRatingCard({ sellerId, rating, notes }: { sellerId: string; rating: number | null; notes: string }) {
  const save = useSetSellerInternalRating()
  const [value, setValue] = useState<number | null>(rating)
  const [text, setText] = useState(notes)
  return (
    <section className="bg-white border border-[#D9E2DA] rounded-xl p-5 mb-5 space-y-3">
      <div>
        <p className="text-[15px] font-[600] font-sans text-[#0F241D]">Internal rating</p>
        <p className="text-[12px] font-sans text-[#183D33B3]">Only admins see this. Based on quality, dispatch time and claims.</p>
      </div>
      <div className="flex gap-1.5" role="radiogroup" aria-label="Internal rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            onClick={() => setValue(value === n ? null : n)}
            className={`w-9 h-9 rounded border text-[14px] font-sans ${value !== null && n <= value ? 'bg-[#183D33] text-white border-[#183D33]' : 'border-[#D9E2DA] text-[#183D33]'}`}
          >
            {n}
          </button>
        ))}
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder="Notes (quality issues, late dispatches, strengths…)"
        className="w-full px-3 py-2 rounded border border-[#D9E2DA] text-[13px] font-sans"
      />
      <Button
        variant="accent"
        size="sm"
        disabled={save.isPending}
        onClick={() => save.mutate({ id: sellerId, internalRating: value, internalNotes: text.trim() || null })}
      >
        {save.isPending ? 'Saving…' : 'Save rating'}
      </Button>
    </section>
  )
}
