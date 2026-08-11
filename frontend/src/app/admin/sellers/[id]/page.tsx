'use client';

import Link from 'next/link';
import { ArrowLeft, Building2 } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { useAdminSeller } from '@/modules/sellers';

export interface AdminSellerDetailPageProps {
  readonly params: { id: string };
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-border py-3 last:border-0">
      <span className="text-caption font-semibold uppercase tracking-[0.06em] text-text-muted">{label}</span>
      <span className="text-body text-text-primary">{value}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-caption font-semibold uppercase tracking-[0.06em] text-text-muted">{title}</h2>
      <div className="rounded-card border border-border bg-bg-surface px-5">{children}</div>
    </section>
  );
}

export default function AdminSellerDetailPage({ params }: AdminSellerDetailPageProps) {
  const { data: seller, isLoading } = useAdminSeller(params.id);

  if (isLoading || !seller) {
    return <p className="text-small text-text-muted">Loading&hellip;</p>;
  }

  return (
    <div className="max-w-2xl">
      <Link
        href="/admin/sellers"
        className="mb-4 flex w-fit items-center gap-1.5 text-small font-medium text-text-muted hover:text-text-primary"
      >
        <ArrowLeft size={14} aria-hidden="true" />
        Back to Sellers
      </Link>

      <div className="mb-6 flex items-center gap-4 rounded-card border border-border bg-bg-surface p-5">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-card border border-border bg-fill-subtle">
          <Building2 size={22} className="text-text-muted" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-h2 font-serif font-medium text-text-primary">{seller.businessName}</h1>
            <Badge variant={seller.user.status === 'ACTIVE' ? 'success' : 'default'}>{seller.user.status}</Badge>
          </div>
          <p className="mt-1 text-small text-text-muted">
            Joined {new Date(seller.createdAt).toLocaleDateString()}
          </p>
        </div>
      </div>

      <div className="space-y-5">
        <Section title="Contact">
          <DetailRow label="Contact Name" value={seller.contactName} />
          <DetailRow label="Email" value={seller.user.email} />
          <DetailRow label="Phone" value={seller.phone} />
        </Section>

        <Section title="Business">
          <DetailRow label="Business Address" value={seller.businessAddress} />
          <DetailRow label="Bank Details" value={seller.bankDetails || '—'} />
        </Section>

        <Section title="Account">
          <DetailRow label="Account Status" value={seller.user.status} />
          <DetailRow label="Last Updated" value={new Date(seller.updatedAt).toLocaleDateString()} />
        </Section>
      </div>
    </div>
  );
}
