import Link from 'next/link';

export interface AuthLayoutProps {
  readonly children: React.ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border px-margin-mobile py-4 md:px-margin-desktop">
        <Link href="/" className="font-serif text-xl text-text-primary">
          Solomon Bharat
        </Link>
      </header>
      <main className="flex flex-1 items-center justify-center px-margin-mobile py-section-mobile">{children}</main>
      <footer className="px-margin-mobile py-6 text-center text-xs text-text-muted md:px-margin-desktop">
        <Link href="/terms" className="hover:text-accent-primary">
          Terms of Service
        </Link>{' '}
        &middot;{' '}
        <Link href="/privacy" className="hover:text-accent-primary">
          Privacy Policy
        </Link>
      </footer>
    </div>
  );
}
