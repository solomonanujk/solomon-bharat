'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
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

      <div className="mb-6 flex items-center gap-3">
        <h1 className="text-h2 font-serif font-medium text-text-primary">{seller.businessName}</h1>
        <Badge variant={seller.user.status === 'ACTIVE' ? 'success' : 'default'}>{seller.user.status}</Badge>
      </div>
      <p className="-mt-4 mb-6 text-small text-text-muted">Joined {new Date(seller.createdAt).toLocaleDateString()}</p>

      <div className="rounded-card border border-border bg-bg-surface px-5">
        <DetailRow label="Contact Name" value={seller.contactName} />
        <DetailRow label="Email" value={seller.user.email} />
        <DetailRow label="Phone" value={seller.phone} />
        <DetailRow label="Business Address" value={seller.businessAddress} />
        <DetailRow label="Account Status" value={seller.user.status} />
      </div>
    </div>
  );
}
