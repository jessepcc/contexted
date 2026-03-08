import type { ReactElement, ReactNode } from 'react';
import { BlurBlobs } from './BlurBlobs.js';
import type { BlobVariant } from './BlurBlobs.js';

export function PageShell({
  children,
  blobs,
}: {
  children: ReactNode;
  blobs: BlobVariant;
}): ReactElement {
  return (
    <div className="relative min-h-dvh w-full overflow-hidden">
      <BlurBlobs variant={blobs} />
      <div className="dot-grid pointer-events-none absolute inset-0 z-[1]" />
      <main
        id="main-content"
        className="relative z-10 mx-auto flex w-full max-w-[92rem] min-w-0 flex-col animate-fade-in"
      >
        {children}
      </main>
    </div>
  );
}
