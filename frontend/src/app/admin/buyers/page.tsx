'use client';

import { useState } from 'react';
import { useAdminBuyers } from '@/modules/buyers';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TablePagination } from '@/components/ui/Table';

export default function AdminBuyersPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useAdminBuyers({ page });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-h2 font-serif font-medium text-text-primary">Buyers</h1>
        <p className="mt-1 text-small text-text-muted">
          {data && data.total > 0 ? `${data.total} registered buyers` : 'Manage platform buyers'}
        </p>
      </div>

      {isLoading && <p className="text-small text-text-muted">Loading&hellip;</p>}
      {!isLoading && data?.data.length === 0 && <p className="text-small text-text-muted">No buyers yet.</p>}

      {data && data.data.length > 0 && (
        <div className="overflow-hidden rounded-card border border-border bg-bg-surface">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Country</TableHead>
                <TableHead>Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.data.map((buyer) => (
                <TableRow key={buyer.id}>
                  <TableCell className="font-semibold">{buyer.companyName ?? '—'}</TableCell>
                  <TableCell className="text-text-muted">{buyer.contactName}</TableCell>
                  <TableCell className="text-text-muted">{buyer.user.email}</TableCell>
                  <TableCell className="text-text-muted">{buyer.country}</TableCell>
                  <TableCell className="text-text-muted">{new Date(buyer.createdAt).toLocaleDateString()}</TableCell>
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
