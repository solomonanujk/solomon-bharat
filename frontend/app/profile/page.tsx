'use client'

import { useEffect, useState } from 'react'
import { MapPin, Pencil, Plus, Star, Trash2 } from 'lucide-react'
import { AccountPageWrapper } from '@/components/shared/AccountPageWrapper'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/shared/EmptyState'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input as FormInput } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { useBuyerProfile, useUpdateBuyerProfile } from '@/hooks/queries/useBuyerProfile'
import {
  useAddresses,
  useCreateAddress,
  useUpdateAddress,
  useDeleteAddress,
  useSetDefaultAddress,
  type AddressInput,
} from '@/hooks/queries/useAddresses'
import type { Address } from '@/types'

// Buyer profile: account details (companyName/contactName/phone/country — the
// fields that actually exist on BuyerProfile server-side) plus shipping
// addresses, on one page. There's no team-invite management or wallet on this
// product (AGENTS.md / prd.md §7.7); currency selection lives in the NavBar.

function Section({
  title,
  description,
  action,
  children,
}: {
  title: string
  description?: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="border border-border-warm rounded bg-surface p-6 space-y-5">
      <div className="pb-4 border-b border-border-warm flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[18px] font-[600] font-public-sans text-primary">{title}</h2>
          {description && (
            <p className="text-[14px] font-public-sans text-muted-text mt-0.5">{description}</p>
          )}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

function Field({
  label,
  children,
  htmlFor,
}: {
  label: string
  children: React.ReactNode
  htmlFor?: string
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
      <label
        htmlFor={htmlFor}
        className="text-[14px] font-[600] font-public-sans text-primary sm:w-[200px] flex-shrink-0"
      >
        {label}
      </label>
      <div className="flex-1">{children}</div>
    </div>
  )
}

function Input({
  id,
  value,
  onChange,
  type = 'text',
  placeholder,
  readOnly,
}: {
  id?: string
  value: string
  onChange?: (v: string) => void
  type?: string
  placeholder?: string
  readOnly?: boolean
}) {
  return (
    <input
      id={id}
      type={type}
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      placeholder={placeholder}
      readOnly={readOnly}
      className={cn(
        'w-full h-10 px-3 rounded border border-border-warm bg-muted-bg/30',
        'text-[14px] font-public-sans text-primary placeholder:text-muted-text',
        'focus:outline-none focus:border-primary/40 focus:bg-surface',
        'transition-colors duration-150',
        readOnly && 'opacity-60 cursor-not-allowed bg-muted-bg'
      )}
    />
  )
}

// ─── Business profile section ──────────────────────────────────────────────────

function BusinessProfileSection() {
  const user = useAuthStore((s) => s.user)
  const { data: profile, isSuccess: profileLoaded } = useBuyerProfile()
  const updateProfile = useUpdateBuyerProfile()

  const [companyName, setCompanyName] = useState('')
  const [contactName, setContactName] = useState('')
  const [phone, setPhone] = useState('')
  const [country, setCountry] = useState('')

  useEffect(() => {
    if (!profileLoaded || !profile) return
    setCompanyName(profile.companyName ?? '')
    setContactName(profile.contactName ?? '')
    setPhone(profile.phone ?? '')
    setCountry(profile.country ?? '')
  }, [profileLoaded, profile])

  function saveProfile() {
    updateProfile.mutate({
      companyName: companyName.trim(),
      contactName: contactName.trim(),
      phone: phone.trim(),
      country: country.trim(),
    })
  }

  return (
    <Section title="Business Profile" description="Your details as they appear on orders and invoices.">
      <Field label="Email Address" htmlFor="email">
        <Input id="email" type="email" value={user?.email ?? ''} readOnly />
      </Field>
      <Field label="Company Name" htmlFor="company-name">
        <Input id="company-name" value={companyName} onChange={setCompanyName} placeholder="Your company name" />
      </Field>
      <Field label="Contact Name" htmlFor="contact-name">
        <Input id="contact-name" value={contactName} onChange={setContactName} placeholder="Primary contact person" />
      </Field>
      <Field label="Phone" htmlFor="phone">
        <Input id="phone" type="tel" value={phone} onChange={setPhone} placeholder="+91 98765 43210" />
      </Field>
      <Field label="Country" htmlFor="country">
        <Input id="country" value={country} onChange={setCountry} placeholder="Country" />
      </Field>

      <div className="pt-2 flex items-center gap-3">
        <Button variant="primary" size="md" onClick={saveProfile} disabled={updateProfile.isPending}>
          {updateProfile.isPending ? 'Saving…' : 'Save Changes'}
        </Button>
      </div>
    </Section>
  )
}

// ─── Addresses section ──────────────────────────────────────────────────────────

const EMPTY_ADDRESS_FORM: AddressInput = {
  label: '',
  line1: '',
  line2: '',
  city: '',
  state: '',
  postalCode: '',
  country: '',
}

function AddressCard({
  address,
  onEdit,
  onDelete,
  onSetDefault,
  deletePending,
  setDefaultPending,
}: {
  address: Address
  onEdit: () => void
  onDelete: () => void
  onSetDefault: () => void
  deletePending: boolean
  setDefaultPending: boolean
}) {
  return (
    <div className="bg-bg border border-border-warm rounded p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <MapPin size={15} className="text-accent flex-shrink-0" aria-hidden="true" />
          <span className="text-[14px] font-[600] font-public-sans text-primary">
            {address.label || 'Address'}
          </span>
        </div>
        {address.isDefault ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-[600] font-public-sans text-accent bg-accent/10 rounded px-2 py-0.5 flex-shrink-0">
            <Star size={10} fill="currentColor" aria-hidden="true" />
            Default
          </span>
        ) : (
          <Button variant="ghost" size="sm" className="flex-shrink-0 h-auto py-0 px-2" onClick={onSetDefault} disabled={setDefaultPending}>
            Set Default
          </Button>
        )}
      </div>

      <div className="text-[13px] font-public-sans text-muted-text leading-relaxed">
        <p>{address.line1}</p>
        {address.line2 && <p>{address.line2}</p>}
        <p>{[address.city, address.state, address.postalCode].filter(Boolean).join(', ')}</p>
        <p>{address.country}</p>
      </div>

      <div className="flex items-center gap-2 pt-2 border-t border-border-warm mt-1">
        <Button variant="ghost" size="sm" className="gap-1.5" onClick={onEdit}>
          <Pencil size={12} aria-hidden="true" />
          Edit
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-error hover:text-error ml-auto"
          onClick={onDelete}
          disabled={deletePending}
        >
          <Trash2 size={12} aria-hidden="true" />
          Delete
        </Button>
      </div>
    </div>
  )
}

function AddressFormDialog({
  open,
  onOpenChange,
  initial,
  onSubmit,
  isPending,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  initial: AddressInput
  onSubmit: (data: AddressInput) => void
  isPending: boolean
}) {
  const [form, setForm] = useState<AddressInput>(initial)

  useEffect(() => {
    if (open) setForm(initial)
  }, [open, initial])

  function set<K extends keyof AddressInput>(key: K, value: AddressInput[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  const isValid = form.line1.trim() && form.city.trim() && form.postalCode.trim() && form.country.trim()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial.line1 ? 'Edit Address' : 'Add Address'}</DialogTitle>
        </DialogHeader>

        <div className="px-6 pb-4 space-y-4">
          <div>
            <Label htmlFor="addr-label">Label (optional)</Label>
            <FormInput id="addr-label" value={form.label ?? ''} onChange={(e) => set('label', e.target.value)} placeholder="e.g. Warehouse" />
          </div>
          <div>
            <Label htmlFor="addr-line1">Address Line 1 *</Label>
            <FormInput id="addr-line1" value={form.line1} onChange={(e) => set('line1', e.target.value)} placeholder="Street address" />
          </div>
          <div>
            <Label htmlFor="addr-line2">Address Line 2 (optional)</Label>
            <FormInput id="addr-line2" value={form.line2 ?? ''} onChange={(e) => set('line2', e.target.value)} placeholder="Apartment, suite, etc." />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="addr-city">City *</Label>
              <FormInput id="addr-city" value={form.city} onChange={(e) => set('city', e.target.value)} placeholder="City" />
            </div>
            <div>
              <Label htmlFor="addr-state">State / Region</Label>
              <FormInput id="addr-state" value={form.state ?? ''} onChange={(e) => set('state', e.target.value)} placeholder="State or region" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="addr-postal">Postal Code *</Label>
              <FormInput id="addr-postal" value={form.postalCode} onChange={(e) => set('postalCode', e.target.value)} placeholder="ZIP / Postal code" />
            </div>
            <div>
              <Label htmlFor="addr-country">Country *</Label>
              <FormInput id="addr-country" value={form.country} onChange={(e) => set('country', e.target.value)} placeholder="Country" />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" size="md" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button variant="primary" size="md" onClick={() => onSubmit(form)} disabled={!isValid || isPending}>
            {isPending ? 'Saving…' : 'Save Address'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function AddressesSection() {
  const { data: addresses = [], isLoading } = useAddresses()
  const createAddress = useCreateAddress()
  const updateAddress = useUpdateAddress()
  const deleteAddress = useDeleteAddress()
  const setDefaultAddress = useSetDefaultAddress()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const editingAddress = addresses.find((a) => a.id === editingId) ?? null
  const formInitial: AddressInput = editingAddress
    ? {
        label: editingAddress.label ?? '',
        line1: editingAddress.line1,
        line2: editingAddress.line2 ?? '',
        city: editingAddress.city,
        state: editingAddress.state ?? '',
        postalCode: editingAddress.postalCode,
        country: editingAddress.country,
      }
    : EMPTY_ADDRESS_FORM

  function openAdd() {
    setEditingId(null)
    setDialogOpen(true)
  }

  function openEdit(id: string) {
    setEditingId(id)
    setDialogOpen(true)
  }

  function handleSubmit(data: AddressInput) {
    if (editingId) {
      updateAddress.mutate({ id: editingId, data }, { onSuccess: () => setDialogOpen(false) })
    } else {
      createAddress.mutate(data, { onSuccess: () => setDialogOpen(false) })
    }
  }

  return (
    <Section
      title="Addresses"
      description="Manage the shipping addresses on your account."
      action={
        <Button variant="primary" size="sm" className="gap-1.5" onClick={openAdd}>
          <Plus size={13} aria-hidden="true" />
          Add Address
        </Button>
      }
    >
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="bg-bg border border-border-warm rounded p-5 h-40 animate-pulse" />
          ))}
        </div>
      ) : addresses.length === 0 ? (
        <EmptyState
          title="No addresses yet"
          description="Add a shipping address to speed up checkout."
          action={{ label: 'Add Address', onClick: openAdd }}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-4">
          {addresses.map((address) => (
            <AddressCard
              key={address.id}
              address={address}
              onEdit={() => openEdit(address.id)}
              onDelete={() => deleteAddress.mutate(address.id)}
              onSetDefault={() => setDefaultAddress.mutate(address.id)}
              deletePending={deleteAddress.isPending}
              setDefaultPending={setDefaultAddress.isPending}
            />
          ))}
        </div>
      )}

      <AddressFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initial={formInitial}
        onSubmit={handleSubmit}
        isPending={createAddress.isPending || updateAddress.isPending}
      />
    </Section>
  )
}

// ─── Page ───────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  return (
    <AccountPageWrapper title="Profile" description="Your account details and shipping addresses.">
      <div className="flex flex-col lg:flex-row lg:items-start gap-6">
        <div className="flex-1 min-w-0">
          <BusinessProfileSection />
        </div>
        <div className="flex-1 min-w-0">
          <AddressesSection />
        </div>
      </div>
    </AccountPageWrapper>
  )
}
