'use client';

import type { ReactNode } from 'react';
import Image from 'next/image';
import { ApprovalStatusBadge } from '@/components/ApprovalStatusBadge';
import { Button } from '@/components/ui/Button';
import { useMyProduct, useResubmitProduct } from '@/modules/products';
import { formatCurrency } from '@/utils/formatCurrency';

export interface SellerProductDetailPageProps {
  readonly params: { id: string };
}

function SpecRow({ label, value }: { readonly label: string; readonly value: ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-border px-6 py-3 last:border-b-0">
      <span className="text-small font-semibold text-text-primary">{label}</span>
      <span className="text-small text-text-muted">{value}</span>
    </div>
  );
}

export default function SellerProductDetailPage({ params }: SellerProductDetailPageProps) {
  const { data: product, isLoading } = useMyProduct(params.id);
  const resubmitMutation = useResubmitProduct();

  if (isLoading || !product) {
    return <p className="text-small text-text-muted">Loading&hellip;</p>;
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-serif text-h3 text-text-primary">{product.name}</h1>
        <ApprovalStatusBadge status={product.approvalStatus} />
      </div>

      {product.approvalStatus === 'REJECTED' && (
        <div className="mt-4 rounded-card border border-error bg-error/5 p-5">
          <p className="text-small font-semibold text-error">Rejection Reason</p>
          <p className="mt-1 text-small text-text-primary">{product.rejectionReason}</p>
          <Button
            type="button"
            size="sm"
            className="mt-3"
            onClick={() => resubmitMutation.mutate(product.id)}
            disabled={resubmitMutation.isPending}
          >
            {resubmitMutation.isPending ? 'Resubmitting…' : 'Resubmit for Review'}
          </Button>
        </div>
      )}

      {product.isPublished && (
        <p className="mt-4 text-small font-medium text-success">This product is live on the marketplace.</p>
      )}

      {product.images.length > 0 && (
        <div className="mt-6 flex gap-3 overflow-x-auto">
          {product.images.map((image) => (
            <div key={image.id} className="relative h-32 w-32 shrink-0 overflow-hidden rounded-card border border-border bg-bg-surface">
              <Image src={image.url} alt={product.name} fill className="object-cover" />
            </div>
          ))}
        </div>
      )}

      <p className="mt-6 text-body text-text-primary">{product.description}</p>

      <div className="mt-8 overflow-hidden rounded-card border border-border bg-bg-surface">
        <SpecRow label="Your Price" value={formatCurrency(product.sellerPrice)} />
        <SpecRow label="MOQ" value={product.moq} />
        <SpecRow label="Declared Stock" value={product.declaredStock} />
        <SpecRow label="Materials" value={product.materials} />
        {product.dimensions && <SpecRow label="Dimensions" value={product.dimensions} />}
        {product.leadTime && <SpecRow label="Lead Time" value={product.leadTime} />}
      </div>
    </div>
  );
}
