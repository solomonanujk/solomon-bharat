'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { User, CreditCard, Bell, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useMySellerProfile, useUpdateMySellerProfile } from '@/hooks/queries/useSellers'
import { useMe, useForgotPassword } from '@/hooks/queries/useAuth'

const INPUT_CLS =
  'w-full h-10 px-3.5 rounded-lg border border-[#E5E1D8] bg-[#F9F7F2] text-[14px] font-sans text-[#1A1A1A] placeholder:text-[#C4BDB4] focus:outline-none focus:border-[#A68B67] transition-colors'

const TEXTAREA_CLS =
  'w-full px-3.5 py-2.5 rounded-lg border border-[#E5E1D8] bg-[#F9F7F2] text-[14px] font-sans text-[#1A1A1A] placeholder:text-[#C4BDB4] focus:outline-none focus:border-[#A68B67] transition-colors resize-none'

function Section({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string
  description?: string
  icon: React.ComponentType<{ size?: number; className?: string; 'aria-hidden'?: boolean }>
  children: React.ReactNode
}) {
  return (
    <section className="bg-white border border-[#E5E1D8] rounded-xl overflow-hidden mb-5">
      <div className="px-6 py-4 border-b border-[#E5E1D8] bg-[#F9F7F2] flex items-start gap-3">
        <div className="w-7 h-7 rounded-lg bg-[#F5F0E8] flex items-center justify-center shrink-0 mt-0.5">
          <Icon size={13} className="text-[#A68B67]" aria-hidden={true} />
        </div>
        <div>
          <h2 className="text-[14px] font-[700] font-sans text-[#1A1A1A] leading-snug">{title}</h2>
          {description && (
            <p className="text-[12.5px] font-sans text-[#6B6460] mt-0.5 leading-relaxed">{description}</p>
          )}
        </div>
      </div>
      <div className="p-6">{children}</div>
    </section>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11.5px] font-[700] font-sans text-[#6B6460] uppercase tracking-[0.07em] mb-1.5">
        {label}
      </label>
      {children}
      {hint && <p className="text-[11px] font-sans text-[#9CA3AF] mt-1">{hint}</p>}
    </div>
  )
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors',
        checked ? 'bg-[#A68B67]' : 'bg-[#E5E1D8]'
      )}
    >
      <span
        className={cn(
          'inline-block h-5 w-5 translate-y-0.5 rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-5.5' : 'translate-x-0.5'
        )}
      />
    </button>
  )
}

const NOTIFICATION_KEYS: { key: string; label: string; hint: string }[] = [
  { key: 'productApproved', label: 'Product approved', hint: 'When Solomon Bharat approves one of your submitted products.' },
  { key: 'productRejected', label: 'Product rejected', hint: 'When a submission needs changes before it can go live.' },
  { key: 'orderStatusChanged', label: 'New orders & status updates', hint: 'When an order containing your products is placed or its status changes.' },
  { key: 'payoutPaid', label: 'Payout paid', hint: 'When a payout for your products is marked as paid.' },
]

export default function SettingsPage() {
  const { data: profile, isLoading } = useMySellerProfile()
  const updateProfile = useUpdateMySellerProfile()
  const { data: me } = useMe()
  const forgotPassword = useForgotPassword()

  const [businessName, setBusinessName] = useState('')
  const [contactName, setContactName] = useState('')
  const [phone, setPhone] = useState('')
  const [businessAddress, setBusinessAddress] = useState('')
  const [bankDetails, setBankDetails] = useState('')
  const [notificationPrefs, setNotificationPrefs] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (!profile) return
    setBusinessName(profile.businessName ?? '')
    setContactName(profile.contactName ?? '')
    setPhone(profile.phone ?? '')
    setBusinessAddress(profile.businessAddress ?? '')
    setBankDetails(profile.bankDetails ?? '')
    setNotificationPrefs(profile.notificationPrefs ?? {})
  }, [profile])

  function toggleNotification(key: string, value: boolean) {
    setNotificationPrefs((prev) => ({ ...prev, [key]: value }))
  }

  function handleSave() {
    if (!businessName.trim()) { toast.error('Business name is required.'); return }
    if (!contactName.trim()) { toast.error('Contact name is required.'); return }
    if (!phone.trim()) { toast.error('Phone number is required.'); return }
    if (!businessAddress.trim()) { toast.error('Business address is required.'); return }

    updateProfile.mutate({
      businessName: businessName.trim(),
      contactName: contactName.trim(),
      phone: phone.trim(),
      businessAddress: businessAddress.trim(),
      bankDetails: bankDetails.trim() || undefined,
      notificationPrefs,
    })
  }

  function handleSendResetLink() {
    if (!me?.email) return
    forgotPassword.mutate({ email: me.email })
  }

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse max-w-2xl">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-40 bg-white border border-[#E5E1D8] rounded-xl" />
        ))}
      </div>
    )
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-[24px] font-[700] font-sans text-[#1A1A1A] leading-tight">Settings</h1>
        <p className="text-[13px] font-sans text-[#6B6460] mt-0.5">Manage your profile, bank details, and preferences.</p>
      </div>

      {/* Business Profile */}
      <Section title="Business Profile" description="Basic information Solomon Bharat uses to work with you." icon={User}>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Business Name">
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="Your business name"
                className={INPUT_CLS}
              />
            </Field>
            <Field label="Contact Name">
              <input
                type="text"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="Primary contact person"
                className={INPUT_CLS}
              />
            </Field>
          </div>
          <Field label="Phone Number" hint="Include country code.">
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 98765 43210"
              className={INPUT_CLS}
            />
          </Field>
          <Field label="Business Address">
            <textarea
              rows={3}
              value={businessAddress}
              onChange={(e) => setBusinessAddress(e.target.value)}
              placeholder="Registered business address"
              className={TEXTAREA_CLS}
            />
          </Field>
        </div>
      </Section>

      {/* Bank Details */}
      <Section
        title="Bank Details"
        description="Reference only — payouts are processed manually by Solomon Bharat, not through an automated transfer from this form."
        icon={CreditCard}
      >
        <Field label="Bank Details">
          <textarea
            rows={3}
            value={bankDetails}
            onChange={(e) => setBankDetails(e.target.value)}
            placeholder="Account holder name, bank name, account number, IFSC code…"
            className={TEXTAREA_CLS}
          />
        </Field>
      </Section>

      {/* Notification Preferences */}
      <Section title="Notification Preferences" description="Choose what Solomon Bharat notifies you about." icon={Bell}>
        <div className="divide-y divide-[#F5F0E8]">
          {NOTIFICATION_KEYS.map(({ key, label, hint }) => (
            <div key={key} className="flex items-center justify-between gap-4 py-3.5 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <p className="text-[14px] font-[500] font-sans text-[#1A1A1A]">{label}</p>
                <p className="text-[12px] font-sans text-[#6B6460] mt-0.5">{hint}</p>
              </div>
              <Toggle
                checked={notificationPrefs[key] !== false}
                onChange={(v) => toggleNotification(key, v)}
              />
            </div>
          ))}
        </div>
      </Section>

      <div className="flex justify-end mb-5">
        <Button size="md" onClick={handleSave} disabled={updateProfile.isPending}>
          {updateProfile.isPending ? 'Saving…' : 'Save Changes'}
        </Button>
      </div>

      {/* Security */}
      <Section title="Security" description="Manage your login credentials." icon={Shield}>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[14px] font-[500] font-sans text-[#1A1A1A]">Password</p>
            <p className="text-[12.5px] font-sans text-[#6B6460] mt-0.5">
              {me?.email
                ? `We’ll email a reset link to ${me.email}.`
                : 'Send a password reset link to your account email.'}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSendResetLink}
            disabled={forgotPassword.isPending || !me?.email}
          >
            {forgotPassword.isPending ? 'Sending…' : 'Send Reset Link'}
          </Button>
        </div>
      </Section>
    </div>
  )
}
