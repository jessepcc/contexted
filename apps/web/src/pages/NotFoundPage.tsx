import type { ReactElement } from 'react';
import { PageShell } from '../components/PageShell.js';

export function NotFoundPage(): ReactElement {
  return (
    <PageShell blobs="landing">
      <div className="flex flex-col items-center gap-6 px-6 pt-24">
        <h1 className="font-heading text-7xl font-bold text-text-muted">
          404
        </h1>
        <p className="font-heading text-xl font-semibold text-text-primary text-center">
          This page wandered off
        </p>
        <p className="text-sm text-text-secondary text-center max-w-md">
          The page you're looking for doesn't exist or has been moved. Let's get you back on track.
        </p>
        <a
          href="/"
          className="mt-2 inline-flex min-h-11 items-center justify-center rounded-full bg-accent px-8 font-heading text-sm font-semibold text-accent-ink transition-colors hover:bg-accent/90"
        >
          Back to home
        </a>
      </div>
    </PageShell>
  );
}
