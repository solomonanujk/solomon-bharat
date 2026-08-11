'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { AddressManager } from '@/components/AddressManager';
import { useMyProfile, useUpdateMyProfile } from '@/modules/buyers';

function Section({
  title,
  description,
  children,
}: {
  readonly title: string;
  readonly description?: string;
  readonly children: React.ReactNode;
}) {
  return (
    <section className="rounded-card border border-border bg-bg-surface p-6">
      <div className="border-b border-border pb-4">
        <h2 className="font-serif text-h4 text-text-primary">{title}</h2>
        {description && <p className="mt-0.5 text-small text-text-muted">{description}</p>}
      </div>
      <div className="mt-5 space-y-4">{children}</div>
    </section>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  readonly label: string;
  readonly htmlFor: string;
  readonly children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <label htmlFor={htmlFor} className="shrink-0 text-small font-semibold text-text-primary sm:w-[180px]">
        {label}
      </label>
      <div className="flex-1">{children}</div>
    </div>
  );
}

export default function ProfilePage() {
  const { data: profile, isLoading } = useMyProfile();
  const updateMutation = useUpdateMyProfile();

  const [companyName, setCompanyName] = useState('');
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (profile) {
      setCompanyName(profile.companyName ?? '');
      setContactName(profile.contactName);
      setPhone(profile.phone ?? '');
      setCountry(profile.country);
    }
  }, [profile]);

  function handleSave() {
    setSaved(false);
    updateMutation.mutate(
      { companyName, contactName, phone, country },
      { onSuccess: () => setSaved(true) },
    );
  }

  if (isLoading || !profile) {
    return <p className="text-body text-text-muted">Loading&hellip;</p>;
  }

  return (
    <div className="max-w-2xl">
      <h1 className="font-serif text-h2 text-text-primary">Profile</h1>
      <p className="mt-1 text-body text-text-muted">Manage your company details and shipping addresses.</p>

      <div className="mt-8 space-y-6">
        <Section title="Company Information" description="Details used on your order confirmations and invoices.">
          <Field label="Company Name" htmlFor="company-name">
            <Input id="company-name" value={companyName} onChange={(event) => setCompanyName(event.target.value)} />
          </Field>
          <Field label="Country" htmlFor="country">
            <Input id="country" value={country} onChange={(event) => setCountry(event.target.value)} />
          </Field>
        </Section>

        <Section title="Contact Information" description="Who we reach out to about your orders.">
          <Field label="Full Name" htmlFor="contact-name">
            <Input id="contact-name" value={contactName} onChange={(event) => setContactName(event.target.value)} />
          </Field>
          <Field label="Phone" htmlFor="phone">
            <Input id="phone" value={phone} onChange={(event) => setPhone(event.target.value)} />
          </Field>

          <div className="flex items-center gap-3 pt-2">
            <Button type="button" onClick={handleSave} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Saving…' : 'Save Changes'}
            </Button>
            {saved && <span className="text-small font-medium text-success">Saved.</span>}
          </div>
        </Section>

        <AddressManager />
      </div>
    </div>
  );
}
