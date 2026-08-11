'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { useApproveApplication, useRejectApplication, useSellerApplications, useAdminSellers } from '@/modules/sellers';

export default function AdminSellersPage() {
  const [tab, setTab] = useState<'applications' | 'sellers'>('applications');
  const { data: applications, isLoading: applicationsLoading } = useSellerApplications();
  const { data: sellers, isLoading: sellersLoading } = useAdminSellers();
  const approveMutation = useApproveApplication();
  const rejectMutation = useRejectApplication();

  const openApplications = (applications?.data ?? []).filter(
    (app) => app.status === 'PENDING' || app.status === 'MORE_INFO_REQUESTED',
  );

  function handleReject(id: string) {
    const reason = window.prompt('Rejection reason:');
    if (reason) rejectMutation.mutate({ id, reason });
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-h2 font-serif font-medium text-text-primary">Sellers</h1>
        <p className="mt-1 text-small text-text-muted">Review applications and manage approved sellers</p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="applications">Applications ({openApplications.length})</TabsTrigger>
          <TabsTrigger value="sellers">Sellers</TabsTrigger>
        </TabsList>

        <TabsContent value="applications">
          {applicationsLoading && <p className="mt-6 text-small text-text-muted">Loading&hellip;</p>}
          {!applicationsLoading && openApplications.length === 0 && (
            <p className="mt-6 text-small text-text-muted">No pending applications.</p>
          )}
          {openApplications.length > 0 && (
            <div className="mt-6 overflow-hidden rounded-card border border-border bg-bg-surface">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Business</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {openApplications.map((app) => (
                    <TableRow key={app.id}>
                      <TableCell className="font-semibold">{app.businessName}</TableCell>
                      <TableCell className="text-text-muted">{app.contactName}</TableCell>
                      <TableCell className="text-text-muted">{app.email}</TableCell>
                      <TableCell>
                        <Badge variant={app.status === 'PENDING' ? 'warning' : 'accent'}>
                          {app.status === 'PENDING' ? 'Pending' : 'More Info Requested'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => approveMutation.mutate(app.id)}
                            disabled={approveMutation.isPending}
                          >
                            Approve
                          </Button>
                          <Button type="button" size="sm" variant="ghost" onClick={() => handleReject(app.id)}>
                            Reject
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="sellers">
          {sellersLoading && <p className="mt-6 text-small text-text-muted">Loading&hellip;</p>}
          {sellers && sellers.data.length > 0 && (
            <div className="mt-6 overflow-hidden rounded-card border border-border bg-bg-surface">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Business Name</TableHead>
                    <TableHead>Contact Email</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sellers.data.map((seller) => (
                    <TableRow key={seller.id}>
                      <TableCell className="font-semibold">{seller.businessName}</TableCell>
                      <TableCell className="text-text-muted">{seller.user.email}</TableCell>
                      <TableCell className="text-text-muted">{new Date(seller.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Link
                          href={`/admin/sellers/${seller.id}`}
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
