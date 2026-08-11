import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-margin-mobile text-center">
      <h1 className="font-serif text-2xl text-text-primary">Page not found</h1>
      <p className="text-text-muted">The page you&apos;re looking for doesn&apos;t exist.</p>
      <Link href="/" className="rounded bg-accent-primary px-6 py-3 text-sm font-semibold text-bg-primary">
        Back to homepage
      </Link>
    </div>
  );
}