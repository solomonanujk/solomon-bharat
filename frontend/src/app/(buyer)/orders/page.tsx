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
];

export default function BuyerOrdersPage() {
  const [activeTab, setActiveTab] = useState<OrderStatus | 'ALL'>('ALL');
  const { data, isLoading } = useMyOrders(1, 50);

  const orders = (data?.data ?? []).filter((order) => activeTab === 'ALL' || order.status === activeTab);

  return (
    <div>
      <h1 className="font-serif text-h2 text-text-primary">Your Orders</h1>
      <p className="mt-1 text-body text-text-muted">Track and review every order you&apos;ve placed.</p>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as OrderStatus | 'ALL')} className="mt-6">
        <TabsList>
          {STATUS_TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {isLoading && <p className="mt-6 text-body text-text-muted">Loading&hellip;</p>}

      {!isLoading && orders.length === 0 && (
        <div className="mt-6 rounded-card border border-border bg-bg-surface p-10 text-center">
          <p className="text-body text-text-muted">No orders found.</p>
        </div>
      )}

      {orders.length > 0 && (
        <div className="mt-6 overflow-hidden rounded-card border border-border bg-bg-surface">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Order Number</TableHead>
                <TableHead>Date Placed</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">&nbsp;</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => (
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
      )}
    </div>
  );
}
