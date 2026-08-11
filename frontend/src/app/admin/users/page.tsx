'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TablePagination } from '@/components/ui/Table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/Dialog';
import { useAdminUsers, useSuspendUser, useReactivateUser, usePromoteUser } from '@/modules/admin';
import type { Role, SafeUser } from '@/modules/auth/types';

const ROLE_OPTIONS: { value: Role | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'All Roles' },
  { value: 'SUPER_ADMIN', label: 'Admin' },
  { value: 'SELLER', label: 'Seller' },
  { value: 'BUYER', label: 'Buyer' },
];

type ConfirmState = { type: 'suspend' | 'promote'; user: SafeUser } | null;

export default function AdminUsersPage() {
  const [role, setRole] = useState<Role | 'ALL'>('ALL');
  const [page, setPage] = useState(1);
  const { data, isLoading } = useAdminUsers(role === 'ALL' ? { page } : { role, page });
  const suspendMutation = useSuspendUser();
  const reactivateMutation = useReactivateUser();
  const promoteMutation = usePromoteUser();

  const [confirm, setConfirm] = useState<ConfirmState>(null);

  function handleRoleChange(value: string) {
    setRole(value as Role | 'ALL');
    setPage(1);
  }

  async function handleConfirm() {
    if (!confirm) return;
    if (confirm.type === 'suspend') {
      await suspendMutation.mutateAsync(confirm.user.id);
    } else {
      await promoteMutation.mutateAsync(confirm.user.id);
    }
    setConfirm(null);
  }

  const confirmPending = suspendMutation.isPending || promoteMutation.isPending;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-h2 font-serif font-medium text-text-primary">Users</h1>
          <p className="mt-1 text-small text-text-muted">Every account on the platform, across all roles</p>
        </div>
        <div className="w-48">
          <Select value={role} onValueChange={handleRoleChange}>
            <SelectTrigger>
              <SelectValue placeholder="All Roles" />
            </SelectTrigger>
            <SelectContent>
              {ROLE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading && <p className="text-small text-text-muted">Loading&hellip;</p>}
      {!isLoading && data?.data.length === 0 && <p className="text-small text-text-muted">No users found.</p>}

      {data && data.data.length > 0 && (
        <div className="overflow-hidden rounded-card border border-border bg-bg-surface">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Email Verified</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.data.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-semibold">{user.email}</TableCell>
                  <TableCell>
                    <Badge variant="primary">{user.role}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.status === 'ACTIVE' ? 'success' : 'error'}>{user.status}</Badge>
                  </TableCell>
                  <TableCell className="text-text-muted">{user.emailVerifiedAt ? 'Verified' : 'Unverified'}</TableCell>
                  <TableCell className="text-text-muted">{new Date(user.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      {user.status === 'ACTIVE' ? (
                        <Button type="button" size="sm" variant="accent" onClick={() => setConfirm({ type: 'suspend', user })}>
                          Suspend
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => reactivateMutation.mutate(user.id)}
                          disabled={reactivateMutation.isPending}
                        >
                          Reactivate
                        </Button>
                      )}
                      {user.role !== 'SUPER_ADMIN' && (
                        <Button type="button" size="sm" variant="ghost" onClick={() => setConfirm({ type: 'promote', user })}>
                          Promote
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <TablePagination total={data.total} page={page} onPageChange={setPage} />
        </div>
      )}

      <Dialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <DialogContent>
          {confirm && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {confirm.type === 'suspend' ? 'Suspend this account?' : 'Promote to admin?'}
                </DialogTitle>
                <DialogDescription>
                  {confirm.type === 'suspend'
                    ? `${confirm.user.email} will immediately lose access to the platform.`
                    : `${confirm.user.email} will gain full SUPER_ADMIN privileges. This cannot be undone from here.`}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setConfirm(null)}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant={confirm.type === 'suspend' ? 'accent' : 'primary'}
                  onClick={handleConfirm}
                  disabled={confirmPending}
                >
                  {confirm.type === 'suspend' ? 'Suspend Account' : 'Promote to Admin'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
