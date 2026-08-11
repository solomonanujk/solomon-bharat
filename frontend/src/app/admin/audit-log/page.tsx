'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TablePagination } from '@/components/ui/Table';
import { useAuditLog } from '@/modules/admin';

export default function AdminAuditLogPage() {
  const [entityType, setEntityType] = useState('');
  const [page, setPage] = useState(1);
  const { data, isLoading } = useAuditLog({ entityType: entityType.trim() || undefined, page });

  function handleEntityTypeChange(value: string) {
    setEntityType(value);
    setPage(1);
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-h2 font-serif font-medium text-text-primary">Audit Log</h1>
          <p className="mt-1 text-small text-text-muted">Every administrative action taken on the platform</p>
        </div>
        <div className="w-56">
          <Label htmlFor="audit-entity-type">Filter by entity type</Label>
          <Input
            id="audit-entity-type"
            value={entityType}
            onChange={(event) => handleEntityTypeChange(event.target.value)}
            placeholder="e.g. Product, Order, Payout…"
          />
        </div>
      </div>

      {isLoading && <p className="text-small text-text-muted">Loading&hellip;</p>}
      {!isLoading && data?.data.length === 0 && <p className="text-small text-text-muted">No audit entries found.</p>}

      {data && data.data.length > 0 && (
        <div className="overflow-hidden rounded-card border border-border bg-bg-surface">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Action</TableHead>
                <TableHead>Entity Type</TableHead>
                <TableHead>Entity ID</TableHead>
                <TableHead>Admin</TableHead>
                <TableHead>When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.data.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="font-semibold">
                    <Badge variant="accent">{entry.action}</Badge>
                  </TableCell>
                  <TableCell className="text-text-muted">{entry.entityType}</TableCell>
                  <TableCell className="text-text-muted">
                    <code className="text-caption">{entry.entityId.slice(0, 8)}</code>
                  </TableCell>
                  <TableCell className="text-text-muted">
                    <code className="text-caption">{entry.adminId.slice(0, 8)}</code>
                  </TableCell>
                  <TableCell className="text-text-muted">{new Date(entry.createdAt).toLocaleString()}</TableCell>
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
