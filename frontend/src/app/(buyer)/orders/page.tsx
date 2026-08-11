'use client';

import Link from 'next/link';
import { useState } from 'react';
import { OrderStatusBadge } from '@/components/OrderStatusBadge';
import { Button } from '@/components/ui/Button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { useMyOrders } from '@/modules/orders';
import { OrderStatus } from '@/modules/orders/types';
import { formatCurrency } from '@/utils/formatCurrency';

const STATUS_TABS: { label: string; value: OrderStatus | 'ALL' }[] = [
  { label: 'All', value: 'ALL' },
  { label: 'Processing', value: 'CONFIRMED' },
  { label: 'Shipped', value: 'IN_TRANSIT' },
  { label: 'Delivered', value: 'DELIVERED' },
  { label: 'Cancelled', value: 'CANCELLED' },
];

export default function BuyerOrdersPage() {
  const [activeTab, setActiveTab] = useState<OrderStatus | 'ALL'>('ALL');
  const { data, isLoading } = useMyOrders(1, 50);

  const allOrders = data?.data ?? [];
  const orders = allOrders.filter((order) => activeTab === 'ALL' || order.status === activeTab);
  const total = data?.total ?? 0;

  return (
    <div>
      <h1 className="font-serif text-h2 text-text-primary">Order History</h1>
      <p className="mt-1 text-body text-text-muted">
        {isLoading ? 'Loading…' : `${total} order${total === 1 ? '' : 's'} to date`}
      </p>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as OrderStatus | 'ALL')} className="mt-6">
        <TabsList>
          {STATUS_TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="mt-6 overflow-hidden rounded-card border border-border bg-bg-surface">
        <Table>
          <TableHeader>
            <TableRow className="bg-fill-subtle/40 hover:bg-fill-subtle/40">
              <TableHead>Order Number</TableHead>
              <TableHead>Date Placed</TableHead>
              <TableHead>Items</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">&nbsp;</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: 4 }).map((_, index) => (
                // eslint-disable-next-line react/no-array-index-key
                <TableRow key={index}>
                  <TableCell colSpan={6}>
                    <div className="h-4 w-full animate-pulse rounded bg-fill-subtle" />
                  </TableCell>
                </TableRow>
              ))}

            {!isLoading && orders.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={6} className="p-0">
                  <div className="py-14 text-center">
                    <p className="text-body font-medium text-text-primary">No orders found</p>
                    <p className="mt-1 text-small text-text-muted">
                      {activeTab === 'ALL'
                        ? "You haven't placed any orders yet."
                        : 'No orders match this filter.'}
                    </p>
                    <Link
                      href="/categories"
                      className="mt-3 inline-block text-small font-semibold text-accent-primary hover:text-accent-primary-hover hover:underline"
                    >
                      Browse Categories
                    </Link>
                  </div>
                </TableCell>
              </TableRow>
            )}

            {!isLoading &&
              orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-semibold text-text-primary">#{order.id.slice(0, 8)}</TableCell>
                  <TableCell className="text-text-muted">{new Date(order.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell className="text-text-muted">{order.items.length}</TableCell>
                  <TableCell className="font-medium text-text-primary">{formatCurrency(order.adminPriceTotal)}</TableCell>
                  <TableCell>
                    <OrderStatusBadge status={order.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/orders/${order.id}`}>View Details</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
