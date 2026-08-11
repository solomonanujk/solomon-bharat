import { RequireRole } from '@/components/RequireRole';
import { WorkspaceHeader } from '@/components/WorkspaceHeader';
import { WorkspaceSidebar } from '@/components/WorkspaceSidebar';

const NAV_ITEMS = [
  { href: '/admin/dashboard', label: 'Dashboard' },
  { href: '/admin/sellers', label: 'Sellers' },
  { href: '/admin/products', label: 'Products' },
  { href: '/admin/buyers', label: 'Buyers' },
  { href: '/admin/orders', label: 'Orders' },
  { href: '/admin/collections', label: 'Collections' },
  { href: '/admin/payouts', label: 'Payouts' },
  { href: '/admin/categories', label: 'Categories' },
  { href: '/admin/reports', label: 'Reports' },
];

export interface AdminLayoutProps {
  readonly children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <RequireRole role="SUPER_ADMIN">
      <div className="flex min-h-screen flex-col">
        <WorkspaceHeader homeHref="/admin/dashboard" label="Admin" />
        <div className="flex flex-1">
          <WorkspaceSidebar items={NAV_ITEMS} />
          <main className="flex-1 px-8 py-8">{children}</main>
        </div>
      </div>
    </RequireRole>
  );
}
