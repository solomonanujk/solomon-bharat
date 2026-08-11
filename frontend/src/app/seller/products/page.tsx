'use client';

import Link from 'next/link';
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

export default function SellerProductsPage() {
  const [activeTab, setActiveTab] = useState<ApprovalStatus | 'ALL'>('ALL');
  const { data, isLoading } = useMyProducts(activeTab === 'ALL' ? {} : { approvalStatus: activeTab });

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-h3 text-text-primary">Your Products</h1>
        <Button asChild>
          <Link href="/seller/products/submit">Submit New Product</Link>
        </Button>
      </div>

      <div className="mt-6 flex gap-1 border-b border-border">
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

      {isLoading && <p className="mt-6 text-small text-text-muted">Loading&hellip;</p>}

      {!isLoading && data?.data.length === 0 && (
        <p className="mt-6 text-small text-text-muted">No products in this category yet.</p>
      )}

      {data && data.data.length > 0 && (
        <div className="mt-6 rounded-card border border-border bg-bg-surface">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Product</TableHead>
                <TableHead>Your Price</TableHead>
                <TableHead>Declared Stock</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.data.map((product) => (
                <TableRow key={product.id}>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell className="text-text-muted">{formatCurrency(product.sellerPrice)}</TableCell>
                  <TableCell className="text-text-muted">{product.declaredStock}</TableCell>
                  <TableCell>
                    <ApprovalStatusBadge status={product.approvalStatus} />
                  </TableCell>
                  <TableCell className="text-text-muted">{new Date(product.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Link href={`/seller/products/${product.id}`} className="font-medium text-accent-secondary hover:underline">
                      View
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
