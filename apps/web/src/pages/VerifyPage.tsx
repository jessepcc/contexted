import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { PageShell } from '../components/PageShell.js';

export function parseHashToken(hash: string): string | null {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  return params.get('access_token');
}

export function VerifyPage(): ReactElement {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = parseHashToken(window.location.hash);
    if (token) {
      localStorage.setItem('contexted_token', token);
      void navigate({ to: '/app' });
    } else {
      setError('We couldn’t read that sign-in link. Request a fresh one and we’ll keep your place in the alpha.');
    }
  }, [navigate]);

  if (error) {
    return (
      <PageShell blobs="landing">
        <div className="flex flex-col items-center pt-24 px-6">
          <h1 className="font-heading text-3xl font-bold text-text-primary">
            That link didn’t land
          </h1>
          <p role="alert" className="mt-4 text-center text-text-secondary text-sm">
            {error}
          </p>
          <a
            href="/auth/login"
            className="mt-6 font-heading text-sm font-semibold text-accent hover:underline"
          >
            Request a new link
          </a>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell blobs="landing">
      <div className="flex flex-col items-center pt-24 px-6">
        <h1 className="font-heading text-3xl font-bold text-text-primary">
          Checking your link…
        </h1>
        <p className="mt-4 text-text-secondary text-sm">
          Opening your place in the experiment…
        </p>
      </div>
    </PageShell>
  );
}
