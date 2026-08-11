'use client';

import { useState } from 'react';
import { OrderStatusBadge } from '@/components/OrderStatusBadge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TablePagination } from '@/components/ui/Table';
import { useSellerOrderItems } from '@/modules/orders';
import { formatCurrency } from '@/utils/formatCurrency';

const PAGE_SIZE = 20;

function SkeletonRows() {
  return (
    <div className="animate-pulse overflow-hidden rounded-card border border-border bg-bg-surface">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 border-b border-border px-4 py-3 last:border-0">
          <div className="h-4 w-1/6 rounded bg-fill-subtle" />
          <div className="h-4 w-1/5 rounded bg-fill-subtle" />
          <div className="h-4 w-1/12 rounded bg-fill-subtle" />
          <div className="h-4 w-1/6 rounded bg-fill-subtle" />
          <div className="h-4 w-1/6 rounded bg-fill-subtle" />
          <div className="h-5 w-20 rounded bg-fill-subtle" />
        </div>
      ))}
    </div>
  );
}

export default function SellerOrdersPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useSellerOrderItems(page, PAGE_SIZE);

  const items = data?.data ?? [];
  const total = data?.total ?? 0;

  return (
    <div>
      <h1 className="font-serif text-h3 text-text-primary">Orders</h1>
      <p className="mt-1 text-small text-text-muted">Items ordered from your catalog. Buyer identity is never shown.</p>

      {isLoading && <div className="mt-6"><SkeletonRows /></div>}

      {!isLoading && items.length === 0 && (
        <div className="mt-6 rounded-card border border-dashed border-border py-16 text-center">
          <p className="text-body font-medium text-text-primary">No orders yet.</p>
          <p className="mt-1 text-small text-text-muted">Orders placed on your products will appear here.</p>
        </div>
      )}

      {!isLoading && items.length > 0 && (
        <div className="mt-6 overflow-hidden rounded-card border border-border bg-bg-surface">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Order</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Your Price</TableHead>
                <TableHead>Line Total</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.orderItemId}>
                  <TableCell className="text-text-muted">#{item.orderId.slice(0, 8)}</TableCell>
                  <TableCell className="font-medium">{item.productName}</TableCell>
                  <TableCell className="tabular-nums text-text-muted">{item.quantity}</TableCell>
                  <TableCell className="tabular-nums text-text-muted">{formatCurrency(item.sellerPrice)}</TableCell>
                  <TableCell className="tabular-nums font-medium">{formatCurrency(item.lineSellerTotal)}</TableCell>
                  <TableCell>
                    <OrderStatusBadge status={item.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <TablePagination total={total} page={page} pageSize={PAGE_SIZE} onPageChange={setPage} />
        </div>
      )}
    </div>
  );
}
