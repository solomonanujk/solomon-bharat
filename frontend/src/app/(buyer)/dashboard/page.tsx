'use client';

import Link from 'next/link';
import { OrderStatusBadge } from '@/components/OrderStatusBadge';
import { ProductCard } from '@/components/ProductCard';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { useAuth } from '@/providers/AuthProvider';
import { useMyOrders } from '@/modules/orders';
import { useWishlist } from '@/modules/buyers';
import { formatCurrency } from '@/utils/formatCurrency';

const ACTIVE_STATUSES = new Set(['PAYMENT_RECEIVED', 'CONFIRMED', 'PROCURING', 'COLLECTED', 'IN_TRANSIT']);

function StatCard({ label, value }: { readonly label: string; readonly value: string | number }) {
  return (
    <div className="rounded-card border border-border bg-bg-surface p-5">
      <p className="text-caption font-semibold uppercase tracking-[0.08em] text-text-muted">{label}</p>
      <p className="mt-2 font-serif text-h3 leading-none tabular-nums text-text-primary">{value}</p>
    </div>
  );
}

export default function BuyerDashboardPage() {
  const { user } = useAuth();
  const { data: ordersData, isLoading: isLoadingOrders } = useMyOrders(1, 50);
  const { data: wishlist } = useWishlist();

  const orders = ordersData?.data ?? [];
  const activeOrdersCount = orders.filter((order) => ACTIVE_STATUSES.has(order.status)).length;
  const recentOrders = orders.slice(0, 5);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-h2 text-text-primary">Welcome back{user ? `, ${user.email}` : ''}</h1>
          <p className="mt-1 text-body text-text-muted">Here&apos;s what&apos;s happening with your account.</p>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard label="Active Orders" value={isLoadingOrders ? '—' : activeOrdersCount} />
        <StatCard label="Total Orders" value={isLoadingOrders ? '—' : (ordersData?.total ?? 0)} />
        <StatCard label="Wishlist Items" value={wishlist ? wishlist.length : '—'} />
      </div>

      <div className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-h4 text-text-primary">Recent Orders</h2>
          <Link
            href="/orders"
            className="text-small font-semibold text-accent-primary hover:text-accent-primary-hover hover:underline"
          >
            View all
          </Link>
        </div>

        {recentOrders.length === 0 ? (
          <div className="mt-4 rounded-card border border-border bg-bg-surface p-10 text-center">
            <p className="text-body text-text-muted">You haven&apos;t placed any orders yet.</p>
            <Link
              href="/categories"
              className="mt-3 inline-block text-small font-semibold text-accent-primary hover:text-accent-primary-hover hover:underline"
            >
              Browse Categories
            </Link>
          </div>
        ) : (
          <div className="mt-4 overflow-hidden rounded-card border border-border bg-bg-surface">
            <Table>
              <TableHeader>
                <TableRow className="bg-fill-subtle/40 hover:bg-fill-subtle/40">
                  <TableHead>Order</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentOrders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell>
                      <Link href={`/orders/${order.id}`} className="font-semibold text-accent-primary hover:underline">
                        #{order.id.slice(0, 8)}
                      </Link>
                    </TableCell>
                    <TableCell className="text-text-muted">
                      {new Date(order.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <OrderStatusBadge status={order.status} />
                    </TableCell>
                    <TableCell className="text-right font-medium text-text-primary">
                      {formatCurrency(order.adminPriceTotal)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {wishlist && wishlist.length > 0 && (
        <div className="mt-10">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-h4 text-text-primary">From Your Wishlist</h2>
            <Link
              href="/wishlist"
              className="text-small font-semibold text-accent-primary hover:text-accent-primary-hover hover:underline"
            >
              View all
            </Link>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-6 md:grid-cols-4">
            {wishlist.slice(0, 4).map((entry) => (
              <ProductCard
                key={entry.id}
                slug={entry.product.slug}
                name={entry.product.name}
                adminPrice={entry.product.adminPrice}
                moq={entry.product.moq}
                imageUrl={entry.product.imageUrl}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
