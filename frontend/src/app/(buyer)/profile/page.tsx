'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { AddressManager } from '@/components/AddressManager';
import { useMyProfile, useUpdateMyProfile } from '@/modules/buyers';

function Section({
  title,
  children,
}: {
  readonly title: string;
  readonly children: React.ReactNode;
}) {
  return (
    <section className="rounded-card border border-border bg-bg-surface p-6">
      <h2 className="border-b border-border pb-4 font-serif text-h4 text-text-primary">{title}</h2>
      <div className="mt-5 grid gap-4">{children}</div>
    </section>
  );
}

function Field({ label, htmlFor, children }: { readonly label: string; readonly htmlFor: string; readonly children: React.ReactNode }) {
  return (
    <div>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
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
        <Section title="Company Information">
          <Field label="Company Name" htmlFor="company-name">
            <Input id="company-name" value={companyName} onChange={(event) => setCompanyName(event.target.value)} />
          </Field>
          <Field label="Country" htmlFor="country">
            <Input id="country" value={country} onChange={(event) => setCountry(event.target.value)} />
          </Field>
        </Section>

        <Section title="Contact Information">
          <Field label="Full Name" htmlFor="contact-name">
            <Input id="contact-name" value={contactName} onChange={(event) => setContactName(event.target.value)} />
          </Field>
          <Field label="Phone" htmlFor="phone">
            <Input id="phone" value={phone} onChange={(event) => setPhone(event.target.value)} />
          </Field>
        </Section>

        <div className="flex items-center gap-3">
          <Button type="button" onClick={handleSave} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? 'Saving…' : 'Save Changes'}
          </Button>
          {saved && <span className="text-small font-medium text-success">Saved.</span>}
        </div>

        <AddressManager />
      </div>
    </div>
  );
}
