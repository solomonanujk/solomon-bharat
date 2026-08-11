import { Navbar } from './Navbar';
import { Footer } from './Footer';

export interface PublicShellProps {
  readonly children: React.ReactNode;
}

export function PublicShell({ children }: PublicShellProps) {
  return (
    <>
      <Navbar />
      <main>{children}</main>
      <Footer />
    </>
  );
}
