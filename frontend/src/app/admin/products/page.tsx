'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { ApprovalStatusBadge } from '@/components/ApprovalStatusBadge';
import { Badge } from '@/components/ui/Badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TablePagination } from '@/components/ui/Table';
import { useAdminProducts } from '@/modules/products';
import { ApprovalStatus } from '@/modules/products/types';
import { formatCurrency } from '@/utils/formatCurrency';

const TABS: { label: string; value: ApprovalStatus | 'ALL' }[] = [
  { label: 'Pending Review', value: 'PENDING' },
  { label: 'Resubmitted', value: 'RESUBMITTED' },
  { label: 'Approved', value: 'APPROVED' },
  { label: 'Rejected', value: 'REJECTED' },
  { label: 'All', value: 'ALL' },
];

export default function AdminProductsPage() {
  const [tab, setTab] = useState<ApprovalStatus | 'ALL'>('PENDING');
  const [page, setPage] = useState(1);
  const { data, isLoading } = useAdminProducts(tab === 'ALL' ? { page } : { approvalStatus: tab, page });

  function handleTabChange(value: ApprovalStatus | 'ALL') {
    setTab(value);
    setPage(1);
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-h2 font-serif font-medium text-text-primary">Products</h1>
        <p className="mt-1 text-small text-text-muted">Review submissions and set the price buyers pay</p>
      </div>

      <Tabs value={tab} onValueChange={(v) => handleTabChange(v as ApprovalStatus | 'ALL')}>
        <TabsList>
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {isLoading && <p className="mt-6 text-small text-text-muted">Loading&hellip;</p>}
      {!isLoading && data?.data.length === 0 && (
        <p className="mt-6 text-small text-text-muted">No products in this category.</p>
      )}

      {data && data.data.length > 0 && (
        <div className="mt-6 overflow-hidden rounded-card border border-border bg-bg-surface">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Seller</TableHead>
                <TableHead>Seller Price</TableHead>
                <TableHead>Admin Price</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Published</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.data.map((product) => (
                <TableRow key={product.id}>
                  <TableCell className="font-semibold">{product.name}</TableCell>
                  <TableCell className="text-text-muted">{product.seller?.businessName ?? '—'}</TableCell>
                  <TableCell className="text-text-muted">{formatCurrency(product.sellerPrice)}</TableCell>
                  <TableCell className="text-text-muted">
                    {product.adminPrice ? formatCurrency(product.adminPrice) : '—'}
                  </TableCell>
                  <TableCell>
                    <ApprovalStatusBadge status={product.approvalStatus} />
                  </TableCell>
                  <TableCell>
                    <Badge variant={product.isPublished ? 'success' : 'default'}>
                      {product.isPublished ? 'Published' : 'Unpublished'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/admin/products/${product.id}`}
                      className="flex items-center justify-end gap-1 text-small font-semibold text-accent-secondary hover:text-accent-secondary-hover"
                    >
                      Review
                      <ArrowRight size={14} aria-hidden="true" />
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <TablePagination total={data.total} page={page} onPageChange={setPage} />
        </div>
      )}
    </div>
  );
}
