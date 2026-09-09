'use client'

import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input as FormInput } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import type { AddressInput } from '@/hooks/queries/useAddresses'

// Shared by the profile page's Address Book (add/edit) and the checkout page's
// inline "Add new address" flow, so both stay in sync with one form definition.

export const EMPTY_ADDRESS_FORM: AddressInput = {
  label: '',
  line1: '',
  line2: '',
  city: '',
  state: '',
  postalCode: '',
  country: '',
}

export function AddressFormDialog({
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
