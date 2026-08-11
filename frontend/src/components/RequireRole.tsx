'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/providers/AuthProvider';
import { Role } from '@/modules/auth/types';

export interface RequireRoleProps {
  readonly role: Role;
  readonly children: React.ReactNode;
}

export function RequireRole({ role, children }: RequireRoleProps) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && (!user || user.role !== role)) {
      router.replace('/login');
    }
  }, [isLoading, user, role, router]);

  if (isLoading || !user || user.role !== role) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-text-muted">Loading&hellip;</p>
      </div>
    );
  }

  return <>{children}</>;
}
