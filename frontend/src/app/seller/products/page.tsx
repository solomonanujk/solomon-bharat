'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ApprovalStatusBadge } from '@/components/ApprovalStatusBadge';
import { Button } from '@/components/ui/Button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { useMyProducts } from '@/modules/products';
import { ApprovalStatus } from '@/modules/products/types';
import { formatCurrency } from '@/utils/formatCurrency';

const TABS: { label: string; value: ApprovalStatus | 'ALL' }[] = [
  { label: 'All', value: 'ALL' },
  { label: 'Pending Review', value: 'PENDING' },
  { label: 'Approved', value: 'APPROVED' },
  { label: 'Rejected', value: 'REJECTED' },
];

function SkeletonRows() {
  return (
    <div className="animate-pulse overflow-hidden rounded-card border border-border bg-bg-surface">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 border-b border-border px-4 py-3 last:border-0">
          <div className="h-10 w-10 shrink-0 rounded bg-fill-subtle" />
          <div className="flex-1">
            <div className="mb-1 h-4 w-1/3 rounded bg-fill-subtle" />
            <div className="h-3 w-1/5 rounded bg-fill-subtle" />
          </div>
          <div className="h-4 w-16 rounded bg-fill-subtle" />
          <div className="h-4 w-16 rounded bg-fill-subtle" />
          <div className="h-5 w-20 rounded bg-fill-subtle" />
        </div>
      ))}
    </div>
  );
}

export default function SellerProductsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ApprovalStatus | 'ALL'>('ALL');
  const { data, isLoading } = useMyProducts(activeTab === 'ALL' ? {} : { approvalStatus: activeTab });

  const products = data?.data ?? [];

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-h3 text-text-primary">Your Products</h1>
        <Button asChild>
          <Link href="/seller/products/submit">Submit New Product</Link>
        </Button>
      </div>

      <div className="mt-6 flex items-center justify-between border-b border-border">
        <div className="flex gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setActiveTab(tab.value)}
              className={`-mb-px border-b-2 px-4 py-2.5 text-small font-semibold transition-colors ${
                activeTab === tab.value
                  ? 'border-accent-primary text-text-primary'
                  : 'border-transparent text-text-muted hover:text-text-primary'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {!isLoading && (
          <p className="pb-2.5 text-small text-text-muted">
            {products.length} product{products.length !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {isLoading && <div className="mt-6"><SkeletonRows /></div>}

      {!isLoading && products.length === 0 && (
        <div className="mt-6 rounded-card border border-dashed border-border py-16 text-center">
          <p className="text-body font-medium text-text-primary">No products in this category yet.</p>
          <p className="mt-1 text-small text-text-muted">Submit a new product to start selling on Solomon Bharat.</p>
        </div>
      )}

      {!isLoading && products.length > 0 && (
        <div className="mt-6 overflow-hidden rounded-card border border-border bg-bg-surface">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead />
                <TableHead>Product</TableHead>
                <TableHead>Your Price</TableHead>
                <TableHead>MOQ</TableHead>
                <TableHead>Declared Stock</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Submitted</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => {
                const thumbnail = product.images[0]?.url ?? null;
                return (
                  <TableRow
                    key={product.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/seller/products/${product.id}`)}
                  >
                    <TableCell>
                      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded border border-border bg-bg-primary">
                        {thumbnail ? (
                          <Image src={thumbnail} alt="" fill className="object-cover" unoptimized />
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium text-text-primary">{product.name}</TableCell>
                    <TableCell className="tabular-nums text-text-muted">{formatCurrency(product.sellerPrice)}</TableCell>
                    <TableCell className="tabular-nums text-text-muted">{product.moq}</TableCell>
                    <TableCell className="tabular-nums text-text-muted">{product.declaredStock}</TableCell>
                    <TableCell>
                      <ApprovalStatusBadge status={product.approvalStatus} />
                    </TableCell>
                    <TableCell className="text-text-muted">{new Date(product.createdAt).toLocaleDateString()}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
