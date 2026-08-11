'use client';

export interface ErrorPageProps {
  readonly error: Error;
  readonly reset: () => void;
}

export default function ErrorPage({ reset }: ErrorPageProps) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-margin-mobile text-center">
      <h1 className="font-serif text-2xl text-text-primary">Something went wrong</h1>
      <p className="text-text-muted">Please try again, or head back to the homepage.</p>
      <button
        type="button"
        onClick={reset}
        className="rounded bg-accent-primary px-6 py-3 text-sm font-semibold text-bg-primary"
      >
        Try again
      </button>
    </div>
  );
}