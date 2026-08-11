import { PublicShell } from '@/components/PublicShell';

export interface PublicLayoutProps {
  readonly children: React.ReactNode;
}

export default function PublicLayout({ children }: PublicLayoutProps) {
  return <PublicShell>{children}</PublicShell>;
}
