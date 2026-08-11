'use client';

import { useState } from 'react';
import { MapPin, Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Badge } from '@/components/ui/Badge';
import {
  useAddresses,
  useCreateAddress,
  useDeleteAddress,
  useSetDefaultAddress,
  Address,
  CreateAddressInput,
} from '@/modules/buyers';

const EMPTY_FORM: CreateAddressInput = {
  label: '',
  line1: '',
  line2: '',
  city: '',
  state: '',
  postalCode: '',
  country: '',
  isDefault: false,
};

export function AddressManager() {
  const { data: addresses, isLoading } = useAddresses();
  const createMutation = useCreateAddress();
  const deleteMutation = useDeleteAddress();
  const setDefaultMutation = useSetDefaultAddress();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CreateAddressInput>(EMPTY_FORM);

  function handleField<K extends keyof CreateAddressInput>(key: K, value: CreateAddressInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    createMutation.mutate(form, {
      onSuccess: () => {
        setForm(EMPTY_FORM);
        setShowForm(false);
      },
    });
  }

  return (
    <section className="rounded-card border border-border bg-bg-surface p-6">
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <h2 className="font-serif text-h4 text-text-primary">Shipping Addresses</h2>
          <p className="mt-0.5 text-small text-text-muted">Where your orders get shipped and collected from.</p>
        </div>
        {!showForm && (
          <Button type="button" variant="ghost" size="sm" onClick={() => setShowForm(true)} className="shrink-0 gap-1.5">
            <Plus size={14} aria-hidden="true" />
            Add Address
          </Button>
        )}
      </div>

      <div className="mt-5 space-y-3">
        {isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, index) => (
              // eslint-disable-next-line react/no-array-index-key
              <div key={index} className="h-20 animate-pulse rounded-card bg-fill-subtle" />
            ))}
          </div>
        )}
        {!isLoading && addresses?.length === 0 && (
          <p className="text-small text-text-muted">No addresses saved yet.</p>
        )}
        {addresses?.map((address: Address) => (
          <div
            key={address.id}
            className="flex items-start justify-between gap-4 rounded-card border border-border bg-bg-primary p-4"
          >
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-bg-surface">
                <MapPin size={14} className="text-text-muted" aria-hidden="true" />
              </span>
              <div className="text-small text-text-primary">
                {address.label && <p className="font-semibold">{address.label}</p>}
                <p>{address.line1}</p>
                {address.line2 && <p>{address.line2}</p>}
                <p className="text-text-muted">
                  {address.city}
                  {address.state ? `, ${address.state}` : ''} {address.postalCode}
                </p>
                <p className="text-text-muted">{address.country}</p>
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2">
              {address.isDefault ? (
                <Badge variant="success">Default</Badge>
              ) : (
                <button
                  type="button"
                  onClick={() => setDefaultMutation.mutate(address.id)}
                  disabled={setDefaultMutation.isPending}
                  className="text-caption font-semibold text-accent-primary hover:underline"
                >
                  Set as default
                </button>
              )}
              <button
                type="button"
                onClick={() => deleteMutation.mutate(address.id)}
                disabled={deleteMutation.isPending}
                className="text-caption font-semibold text-error hover:underline"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mt-5 grid gap-4 rounded-card border border-border bg-bg-primary p-5">
          <p className="text-small font-semibold text-text-primary">Add a new address</p>
          <div>
            <Label htmlFor="address-label">Label (optional)</Label>
            <Input
              id="address-label"
              value={form.label}
              onChange={(event) => handleField('label', event.target.value)}
              placeholder="e.g. Warehouse"
            />
          </div>
          <div>
            <Label htmlFor="address-line1">Address Line 1</Label>
            <Input
              id="address-line1"
              required
              value={form.line1}
              onChange={(event) => handleField('line1', event.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="address-line2">Address Line 2 (optional)</Label>
            <Input
              id="address-line2"
              value={form.line2}
              onChange={(event) => handleField('line2', event.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="address-city">City</Label>
              <Input
                id="address-city"
                required
                value={form.city}
                onChange={(event) => handleField('city', event.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="address-state">State (optional)</Label>
              <Input
                id="address-state"
                value={form.state}
                onChange={(event) => handleField('state', event.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="address-postal">Postal Code</Label>
              <Input
                id="address-postal"
                required
                value={form.postalCode}
                onChange={(event) => handleField('postalCode', event.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="address-country">Country</Label>
              <Input
                id="address-country"
                required
                value={form.country}
                onChange={(event) => handleField('country', event.target.value)}
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-small text-text-primary">
            <input
              type="checkbox"
              checked={form.isDefault}
              onChange={(event) => handleField('isDefault', event.target.checked)}
              className="h-4 w-4 rounded border-border accent-accent-primary"
            />
            Set as default address
          </label>
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Saving…' : 'Save Address'}
            </Button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setForm(EMPTY_FORM);
              }}
              className="text-small text-text-muted hover:text-text-primary hover:underline"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
