import { RequireRole } from '@/components/RequireRole';
import { WorkspaceHeader } from '@/components/WorkspaceHeader';
import { WorkspaceSidebar } from '@/components/WorkspaceSidebar';

const NAV_ITEMS = [
  { href: '/seller/dashboard', label: 'Dashboard' },
  { href: '/seller/products', label: 'Products' },
  { href: '/seller/orders', label: 'Orders' },
  { href: '/seller/payouts', label: 'Payouts' },
];

export interface SellerLayoutProps {
  readonly children: React.ReactNode;
}

export default function SellerLayout({ children }: SellerLayoutProps) {
  return (
    <RequireRole role="SELLER">
      <div className="flex min-h-screen flex-col">
        <WorkspaceHeader homeHref="/seller/dashboard" label="Seller Portal" />
        <div className="flex flex-1">
          <WorkspaceSidebar items={NAV_ITEMS} />
          <main className="flex-1 px-8 py-8">{children}</main>
        </div>
      </div>
    </RequireRole>
  );
}
