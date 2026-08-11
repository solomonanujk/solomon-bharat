import { RequireRole } from '@/components/RequireRole';
import { WorkspaceHeader } from '@/components/WorkspaceHeader';
import { WorkspaceSidebar } from '@/components/WorkspaceSidebar';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/orders', label: 'Orders' },
  { href: '/wishlist', label: 'Wishlist' },
  { href: '/messages', label: 'Messages' },
  { href: '/profile', label: 'Profile' },
];

export interface BuyerLayoutProps {
  readonly children: React.ReactNode;
}

export default function BuyerLayout({ children }: BuyerLayoutProps) {
  return (
    <RequireRole role="BUYER">
      <div className="flex min-h-screen flex-col">
        <WorkspaceHeader homeHref="/dashboard" label="Workspace" />
        <div className="flex flex-1">
          <WorkspaceSidebar items={NAV_ITEMS} />
          <main className="flex-1 px-8 py-8">{children}</main>
        </div>
      </div>
    </RequireRole>
  );
}
