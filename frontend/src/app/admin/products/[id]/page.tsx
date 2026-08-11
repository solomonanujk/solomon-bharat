'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { ApprovalStatusBadge } from '@/components/ApprovalStatusBadge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { useAdminProduct, useApproveProduct, useRejectProduct } from '@/modules/products';
import { formatCurrency } from '@/utils/formatCurrency';

export interface AdminProductReviewPageProps {
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

export default function AdminProductReviewPage({ params }: AdminProductReviewPageProps) {
  const router = useRouter();
  const { data: product, isLoading } = useAdminProduct(params.id);
  const approveMutation = useApproveProduct();
  const rejectMutation = useRejectProduct();

  const [adminPrice, setAdminPrice] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');

  if (isLoading || !product) {
    return <p className="text-small text-text-muted">Loading&hellip;</p>;
  }

  const margin = adminPrice ? Number(adminPrice) - Number(product.sellerPrice) : null;
  const canReview = product.approvalStatus === 'PENDING' || product.approvalStatus === 'RESUBMITTED';

  async function handleApprove() {
    if (!adminPrice || Number(adminPrice) <= 0) return;
    await approveMutation.mutateAsync({ id: product!.id, adminPrice: Number(adminPrice) });
    router.push('/admin/products');
  }

  async function handleReject() {
    if (!rejectionReason.trim()) return;
    await rejectMutation.mutateAsync({ id: product!.id, reason: rejectionReason.trim() });
    router.push('/admin/products');
  }

  return (
    <div className="max-w-5xl">
      <Link
        href="/admin/products"
        className="mb-4 flex w-fit items-center gap-1.5 text-small font-medium text-text-muted hover:text-text-primary"
      >
        <ArrowLeft size={14} aria-hidden="true" />
        Back to Products
      </Link>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <div>
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-h2 font-serif font-medium text-text-primary">{product.name}</h1>
            <ApprovalStatusBadge status={product.approvalStatus} />
          </div>

          <div className="mt-4 flex gap-3 overflow-x-auto">
            {product.images.map((image) => (
              <div key={image.id} className="relative h-32 w-32 shrink-0 overflow-hidden rounded-card bg-fill-subtle">
                <Image src={image.url} alt={product.name} fill className="object-cover" />
              </div>
            ))}
          </div>

          <p className="mt-4 text-body text-text-primary">{product.description}</p>

          <div className="mt-6 rounded-card border border-border bg-bg-surface px-5">
            <DetailRow label="Materials" value={product.materials} />
            <DetailRow label="MOQ" value={product.moq} />
            <DetailRow label="Category" value={product.category?.name ?? product.categoryId} />
            <DetailRow label="Seller" value={product.seller?.businessName ?? product.sellerId} />
          </div>
        </div>

        <div className="rounded-card border border-border bg-bg-surface p-6">
          <h2 className="text-h4 font-serif text-text-primary">Review</h2>

          <div className="mt-4 space-y-4">
            <div>
              <p className="text-small text-text-muted">Seller Price</p>
              <p className="text-h3 font-serif text-text-primary">{formatCurrency(product.sellerPrice)}</p>
            </div>

            {canReview ? (
              <>
                <div>
                  <Label htmlFor="admin-price">Admin Price (what buyers pay)</Label>
                  <Input
                    id="admin-price"
                    type="number"
                    step="0.01"
                    value={adminPrice}
                    onChange={(event) => setAdminPrice(event.target.value)}
                  />
                </div>

                {margin !== null && (
                  <p className="text-small text-text-muted">
                    Margin: <span className="font-semibold text-text-primary">{formatCurrency(margin)}</span>
                  </p>
                )}

                <Button type="button" onClick={handleApprove} disabled={approveMutation.isPending} className="w-full">
                  Approve
                </Button>

                <div className="border-t border-border pt-4">
                  <Label htmlFor="rejection-reason">Rejection Reason</Label>
                  <textarea
                    id="rejection-reason"
                    value={rejectionReason}
                    onChange={(event) => setRejectionReason(event.target.value)}
                    rows={3}
                    className="w-full rounded-input border border-border bg-bg-surface px-3 py-2 text-body text-text-primary outline-none transition-colors focus:border-accent-primary focus:ring-1 focus:ring-accent-primary"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleReject}
                    disabled={rejectMutation.isPending}
                    className="mt-2 w-full"
                  >
                    Reject
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-small text-text-muted">
                {product.approvalStatus === 'APPROVED'
                  ? `Approved at ${product.adminPrice ? formatCurrency(product.adminPrice) : '—'} — margin ${
                      product.margin !== null ? formatCurrency(product.margin) : '—'
                    }.`
                  : `Rejected: ${product.rejectionReason}`}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
