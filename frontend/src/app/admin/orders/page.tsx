'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { OrderStatusBadge } from '@/components/OrderStatusBadge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { useAdminOrders } from '@/modules/orders';
import { OrderStatus } from '@/modules/orders/types';
import { formatCurrency } from '@/utils/formatCurrency';

const TABS: { label: string; value: OrderStatus | 'ALL' }[] = [
  { label: 'All', value: 'ALL' },
  { label: 'Confirmed', value: 'CONFIRMED' },
  { label: 'Procuring', value: 'PROCURING' },
  { label: 'In Transit', value: 'IN_TRANSIT' },
  { label: 'Delivered', value: 'DELIVERED' },
];

export default function AdminOrdersPage() {
  const [tab, setTab] = useState<OrderStatus | 'ALL'>('ALL');
  const { data, isLoading } = useAdminOrders(tab === 'ALL' ? {} : { status: tab });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-h2 font-serif font-medium text-text-primary">Orders</h1>
        <p className="mt-1 text-small text-text-muted">Track fulfillment from confirmation to delivery</p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as OrderStatus | 'ALL')}>
        <TabsList>
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {isLoading && <p className="mt-6 text-small text-text-muted">Loading&hellip;</p>}
      {!isLoading && data?.data.length === 0 && <p className="mt-6 text-small text-text-muted">No orders found.</p>}

      {data && data.data.length > 0 && (
        <div className="mt-6 overflow-hidden rounded-card border border-border bg-bg-surface">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.data.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-semibold">#{order.id.slice(0, 8)}</TableCell>
                  <TableCell className="text-text-muted">{order.items.length}</TableCell>
                  <TableCell className="text-text-muted">{formatCurrency(order.adminPriceTotal)}</TableCell>
                  <TableCell>
                    <OrderStatusBadge status={order.status} />
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/admin/orders/${order.id}`}
                      className="flex items-center justify-end gap-1 text-small font-semibold text-accent-secondary hover:text-accent-secondary-hover"
                    >
                      View
                      <ArrowRight size={14} aria-hidden="true" />
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
