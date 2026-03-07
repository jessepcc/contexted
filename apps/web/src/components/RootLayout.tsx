import { Outlet, useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import type { ReactElement } from 'react';

export function RootLayout(): ReactElement {
  const navigate = useNavigate();

  useEffect(() => {
    function handleUnauthorized() {
      void navigate({ to: '/auth/login' });
    }
    window.addEventListener('contexted:unauthorized', handleUnauthorized);
    return () => {
      window.removeEventListener('contexted:unauthorized', handleUnauthorized);
    };
  }, [navigate]);

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-bg-card focus:px-4 focus:py-2 focus:text-text-primary"
      >
        Skip to content
      </a>
      <Outlet />
    </>
  );
}
