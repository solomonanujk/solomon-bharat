'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowRight, MessageSquarePlus, StickyNote } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Label } from '@/components/ui/Label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TablePagination } from '@/components/ui/Table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/Dialog';
import {
  useApproveApplication,
  useRejectApplication,
  useRequestApplicationInfo,
  useAddApplicationNote,
  useSellerApplications,
  useAdminSellers,
} from '@/modules/sellers';
import type { SellerApplication } from '@/modules/sellers';

type ActionDialog = { type: 'reject' | 'request-info' | 'note'; app: SellerApplication } | null;

const DIALOG_COPY: Record<NonNullable<ActionDialog>['type'], { title: string; description: string; placeholder: string; cta: string }> = {
  reject: {
    title: 'Reject application',
    description: 'This reason is shared with the applicant.',
    placeholder: 'Explain why this application is being rejected…',
    cta: 'Reject Application',
  },
  'request-info': {
    title: 'Request more information',
    description: 'Send a message asking the applicant to clarify or provide additional details.',
    placeholder: 'Let us know a bit more about…',
    cta: 'Send Request',
  },
  note: {
    title: 'Internal note',
    description: 'Visible to admins only — never shown to the applicant.',
    placeholder: 'Add context for other reviewers…',
    cta: 'Save Note',
  },
};

export default function AdminSellersPage() {
  const [tab, setTab] = useState<'applications' | 'sellers'>('applications');
  const [sellersPage, setSellersPage] = useState(1);
  const { data: applications, isLoading: applicationsLoading } = useSellerApplications();
  const { data: sellers, isLoading: sellersLoading } = useAdminSellers({ page: sellersPage });
  const approveMutation = useApproveApplication();
  const rejectMutation = useRejectApplication();
  const requestInfoMutation = useRequestApplicationInfo();
  const addNoteMutation = useAddApplicationNote();

  const [dialog, setDialog] = useState<ActionDialog>(null);
  const [dialogValue, setDialogValue] = useState('');

  const openApplications = (applications?.data ?? []).filter(
    (app) => app.status === 'PENDING' || app.status === 'MORE_INFO_REQUESTED',
  );

  function openDialog(type: NonNullable<ActionDialog>['type'], app: SellerApplication) {
    setDialog({ type, app });
    setDialogValue(type === 'note' ? app.internalNotes ?? '' : '');
  }

  async function handleDialogSubmit() {
    if (!dialog || !dialogValue.trim()) return;
    const { type, app } = dialog;
    if (type === 'reject') {
      await rejectMutation.mutateAsync({ id: app.id, reason: dialogValue.trim() });
    } else if (type === 'request-info') {
      await requestInfoMutation.mutateAsync({ id: app.id, message: dialogValue.trim() });
    } else {
      await addNoteMutation.mutateAsync({ id: app.id, note: dialogValue.trim() });
    }
    setDialog(null);
    setDialogValue('');
  }

  const dialogPending = rejectMutation.isPending || requestInfoMutation.isPending || addNoteMutation.isPending;

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
                    <TableHead>Notes</TableHead>
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
                      <TableCell className="max-w-[14rem] truncate text-text-muted">
                        {app.internalNotes || '—'}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => approveMutation.mutate(app.id)}
                            disabled={approveMutation.isPending}
                          >
                            Approve
                          </Button>
                          <Button type="button" size="sm" variant="ghost" onClick={() => openDialog('reject', app)}>
                            Reject
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="gap-1"
                            onClick={() => openDialog('request-info', app)}
                          >
                            <MessageSquarePlus size={13} aria-hidden="true" />
                            Request Info
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="gap-1"
                            onClick={() => openDialog('note', app)}
                          >
                            <StickyNote size={13} aria-hidden="true" />
                            Note
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
              <TablePagination total={sellers.total} page={sellersPage} onPageChange={setSellersPage} />
            </div>
          )}
          {sellers && sellers.data.length === 0 && (
            <p className="mt-6 text-small text-text-muted">No approved sellers yet.</p>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={dialog !== null} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent>
          {dialog && (
            <>
              <DialogHeader>
                <DialogTitle>{DIALOG_COPY[dialog.type].title}</DialogTitle>
                <DialogDescription>{DIALOG_COPY[dialog.type].description}</DialogDescription>
              </DialogHeader>
              <div className="px-6 pb-2">
                <Label htmlFor="dialog-textarea">{dialog.app.businessName}</Label>
                <textarea
                  id="dialog-textarea"
                  value={dialogValue}
                  onChange={(event) => setDialogValue(event.target.value)}
                  rows={4}
                  placeholder={DIALOG_COPY[dialog.type].placeholder}
                  className="w-full rounded-input border border-border bg-bg-surface px-3 py-2 text-body text-text-primary outline-none transition-colors focus:border-accent-primary focus:ring-1 focus:ring-accent-primary"
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setDialog(null)}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant={dialog.type === 'reject' ? 'destructive' : 'primary'}
                  onClick={handleDialogSubmit}
                  disabled={dialogPending || !dialogValue.trim()}
                >
                  {DIALOG_COPY[dialog.type].cta}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
