'use client';

import { OrderStatusBadge } from '@/components/OrderStatusBadge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { useSellerOrderItems } from '@/modules/orders';
import { formatCurrency } from '@/utils/formatCurrency';

export default function SellerOrdersPage() {
  const { data, isLoading } = useSellerOrderItems(1, 50);

  return (
    <div>
      <h1 className="font-serif text-h3 text-text-primary">Orders</h1>
      <p className="mt-1 text-small text-text-muted">Items ordered from your catalog. Buyer identity is never shown.</p>

      {isLoading && <p className="mt-6 text-small text-text-muted">Loading&hellip;</p>}

      {!isLoading && data?.data.length === 0 && <p className="mt-6 text-small text-text-muted">No orders yet.</p>}

      {data && data.data.length > 0 && (
        <div className="mt-6 rounded-card border border-border bg-bg-surface">
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
              {data.data.map((item) => (
                <TableRow key={item.orderItemId}>
                  <TableCell className="text-text-muted">#{item.orderId.slice(0, 8)}</TableCell>
                  <TableCell className="font-medium">{item.productName}</TableCell>
                  <TableCell className="text-text-muted">{item.quantity}</TableCell>
                  <TableCell className="text-text-muted">{formatCurrency(item.sellerPrice)}</TableCell>
                  <TableCell className="font-medium">{formatCurrency(item.lineSellerTotal)}</TableCell>
                  <TableCell>
                    <OrderStatusBadge status={item.status} />
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
