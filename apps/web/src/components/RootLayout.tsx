import { Outlet, useNavigate, useRouterState } from '@tanstack/react-router';
import { useEffect } from 'react';
import type { ReactElement } from 'react';
import { applySeo } from '../seo.js';
import type { SeoMeta } from '../seo.js';

const ROUTE_SEO: Record<string, SeoMeta> = {
  '/': { canonicalPath: '/' },
  '/privacy': {
    title: 'Privacy Policy — Contexted',
    description:
      'How Contexted handles the AI-memory excerpt you paste in: what is stored, what is derived, what is discarded, and what you should remove before submitting.',
    canonicalPath: '/privacy',
  },
  '/terms': {
    title: 'Terms of Service — Contexted',
    description:
      'The rules for using Contexted, an alpha experiment that matches people through AI memory. 18+, manual review required, no promise of outcomes.',
    canonicalPath: '/terms',
  },
};

/**
 * Default-deny: anything not listed above is auth, the signed-in app funnel, or a
 * not-found page. None of those belong in a search index, and noindex is the safer
 * default for routes added later — a new public page opts in by adding an entry.
 */
function seoForPath(pathname: string): SeoMeta {
  return ROUTE_SEO[pathname] ?? { noindex: true };
}

export function RootLayout(): ReactElement {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  useEffect(() => {
    applySeo(seoForPath(pathname));
  }, [pathname]);

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
