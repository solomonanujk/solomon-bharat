'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { useAddresses, useCreateAddress, Address, CreateAddressInput } from '@/modules/buyers';
import { useCheckout, useCapturePayment } from '@/modules/payments';
import { useCart } from '@/providers/CartProvider';
import { formatCurrency } from '@/utils/formatCurrency';

const EMPTY_ADDRESS: CreateAddressInput = {
  label: '',
  line1: '',
  line2: '',
  city: '',
  state: '',
  postalCode: '',
  country: '',
  isDefault: true,
};

export default function CheckoutPage() {
  const router = useRouter();
  const { items, subtotal, clear } = useCart();
  const { data: addresses, isLoading: isLoadingAddresses } = useAddresses();
  const createAddressMutation = useCreateAddress();
  const checkoutMutation = useCheckout();
  const captureMutation = useCapturePayment();

  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [newAddress, setNewAddress] = useState<CreateAddressInput>(EMPTY_ADDRESS);
  const [error, setError] = useState<string | null>(null);

  const effectiveAddressId =
    selectedAddressId ?? addresses?.find((a) => a.isDefault)?.id ?? addresses?.[0]?.id ?? null;
  const isPlacingOrder = checkoutMutation.isPending || captureMutation.isPending;

  function handleAddressField<K extends keyof CreateAddressInput>(key: K, value: CreateAddressInput[K]) {
    setNewAddress((prev) => ({ ...prev, [key]: value }));
  }

  async function handleAddAddress(event: React.FormEvent) {
    event.preventDefault();
    const created = await createAddressMutation.mutateAsync(newAddress);
    setSelectedAddressId(created.id);
    setNewAddress(EMPTY_ADDRESS);
  }

  async function handlePlaceOrder() {
    setError(null);
    if (!effectiveAddressId) {
      setError('Please select or add a shipping address.');
      return;
    }

    try {
      const result = await checkoutMutation.mutateAsync({
        items: items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
        shippingAddressId: effectiveAddressId,
      });

      if (result.approveUrl) {
        clear();
        window.location.href = result.approveUrl;
        return;
      }

      await captureMutation.mutateAsync(result.paymentId);
      clear();
      router.push(`/orders/${result.orderId}?confirmed=1`);
    } catch {
      setError('We could not place your order. Please try again.');
    }
  }

  if (items.length === 0) {
    return (
      <div className="rounded-card border border-border bg-bg-surface p-10 text-center">
        <p className="text-body text-text-muted">Your cart is empty. Add products before checking out.</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl">
      <h1 className="font-serif text-h2 text-text-primary">Checkout</h1>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_360px] lg:items-start">
        <div className="space-y-8">
          <section>
            <h2 className="font-serif text-h4 text-text-primary">Shipping Address</h2>

            {isLoadingAddresses && <p className="mt-4 text-small text-text-muted">Loading&hellip;</p>}

            {!isLoadingAddresses && addresses && addresses.length > 0 && (
              <div className="mt-4 space-y-3">
                {addresses.map((address: Address) => (
                  <label
                    key={address.id}
                    className="flex items-start gap-3 rounded-card border border-border bg-bg-surface p-4 text-small transition-colors has-[:checked]:border-accent-primary has-[:checked]:bg-fill-subtle/40"
                  >
                    <input
                      type="radio"
                      name="shipping-address"
                      checked={effectiveAddressId === address.id}
                      onChange={() => setSelectedAddressId(address.id)}
                      className="mt-1 accent-accent-primary"
                    />
                    <span>
                      {address.label && <span className="block font-semibold text-text-primary">{address.label}</span>}
                      <span className="block text-text-primary">{address.line1}</span>
                      {address.line2 && <span className="block text-text-primary">{address.line2}</span>}
                      <span className="block text-text-muted">
                        {address.city}
                        {address.state ? `, ${address.state}` : ''} {address.postalCode}, {address.country}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            )}

            {!isLoadingAddresses && addresses && addresses.length === 0 && (
              <p className="mt-4 text-small text-text-muted">No saved addresses yet. Add one below.</p>
            )}

            <form onSubmit={handleAddAddress} className="mt-4 grid gap-4 rounded-card border border-border bg-bg-surface p-5">
              <p className="text-small font-semibold text-text-primary">Add a new address</p>
              <div>
                <Label htmlFor="checkout-line1">Address Line 1</Label>
                <Input
                  id="checkout-line1"
                  required
                  value={newAddress.line1}
                  onChange={(event) => handleAddressField('line1', event.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="checkout-city">City</Label>
                  <Input
                    id="checkout-city"
                    required
                    value={newAddress.city}
                    onChange={(event) => handleAddressField('city', event.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="checkout-postal">Postal Code</Label>
                  <Input
                    id="checkout-postal"
                    required
                    value={newAddress.postalCode}
                    onChange={(event) => handleAddressField('postalCode', event.target.value)}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="checkout-country">Country</Label>
                <Input
                  id="checkout-country"
                  required
                  value={newAddress.country}
                  onChange={(event) => handleAddressField('country', event.target.value)}
                />
              </div>
              <Button type="submit" variant="ghost" disabled={createAddressMutation.isPending} className="justify-self-start">
                {createAddressMutation.isPending ? 'Saving…' : 'Save Address'}
              </Button>
            </form>
          </section>

          {error && <p className="text-small text-error">{error}</p>}

          <Button type="button" onClick={handlePlaceOrder} disabled={isPlacingOrder} size="lg" className="w-full lg:w-auto">
            {isPlacingOrder ? 'Placing Order…' : 'Place Order'}
          </Button>
        </div>

        <aside className="rounded-card border border-border bg-bg-surface p-6 lg:sticky lg:top-8">
          <h2 className="font-serif text-h4 text-text-primary">Order Summary</h2>
          <div className="mt-4 space-y-3">
            {items.map((item) => (
              <div key={item.productId} className="flex items-center gap-3 rounded-card border border-border bg-bg-primary p-3">
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded bg-bg-surface">
                  {item.imageUrl && <Image src={item.imageUrl} alt={item.name} fill className="object-cover" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-small font-medium text-text-primary">{item.name}</p>
                  <p className="text-caption text-text-muted">Qty {item.quantity}</p>
                </div>
                <p className="shrink-0 text-small font-semibold text-text-primary">
                  {formatCurrency(Number(item.adminPrice) * item.quantity)}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex justify-between border-t border-border pt-4 font-semibold text-text-primary">
            <span>Total</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
        </aside>
      </div>
    </div>
  );
}
