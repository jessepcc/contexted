import { useNavigate } from '@tanstack/react-router';
import type { ReactElement } from 'react';
import { useEffect } from 'react';
import { PageShell } from '../components/PageShell.js';

export function UploadPage(): ReactElement {
  const navigate = useNavigate();

  useEffect(() => {
    void navigate({ to: '/' });
  }, [navigate]);

  return (
    <PageShell blobs="landing">
      <div className="flex flex-col items-center gap-4 px-6 pt-24">
        <h1 className="font-heading text-3xl font-bold text-text-primary text-center">Use the memory flow instead</h1>
        <p className="text-sm text-text-secondary text-center">
          File upload has been removed. Open your AI memory and paste the export or excerpt on the landing page.
        </p>
      </div>
    </PageShell>
  );
}
