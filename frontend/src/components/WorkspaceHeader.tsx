'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/providers/AuthProvider';

export interface WorkspaceHeaderProps {
  readonly homeHref: string;
  readonly label: string;
}

export function WorkspaceHeader({ homeHref, label }: WorkspaceHeaderProps) {
  const { user, logout } = useAuth();
  const router = useRouter();

  async function handleLogout() {
    await logout();
    router.push('/login');
  }

  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-bg-surface px-6">
      <div className="flex items-baseline gap-3">
        <Link href={homeHref} className="font-serif text-lg font-medium text-text-primary">
          Solomon Bharat
        </Link>
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-accent-primary">{label}</span>
      </div>
      <div className="flex items-center gap-4 text-sm text-text-muted">
        <span>{user?.email}</span>
        <button type="button" onClick={handleLogout} className="font-medium text-accent-secondary hover:underline">
          Log Out
        </button>
      </div>
    </header>
  );
}
