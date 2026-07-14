const SITE_ORIGIN = 'https://match.contexted.app';

const DEFAULT_TITLE = "Contexted — Peer matching built on your AI's memory";
const DEFAULT_DESCRIPTION =
  'Contexted matches people through the memory their AI assistant has built with them — recurring themes, values, and tone, not photos or swipes. Paste a ChatGPT or Claude memory excerpt and join a batched alpha drop.';

export type SeoMeta = {
  title?: string;
  description?: string;
  /** Path (not full URL) this route should canonicalize to. Omit for noindex routes. */
  canonicalPath?: string;
  /** Private funnel pages (auth, the signed-in app) should stay out of search indexes. */
  noindex?: boolean;
};

function upsertMeta(selector: string, attr: 'name' | 'property', key: string, content: string): void {
  let tag = document.head.querySelector<HTMLMetaElement>(selector);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attr, key);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
}

function upsertCanonical(href: string): void {
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }
  link.setAttribute('href', href);
}

/**
 * The SPA serves one index.html for every route, so without this every URL would
 * report the homepage's title, description and canonical. Search crawlers that run
 * JS (Googlebot, Bingbot) read the post-render head, so keeping it in sync per route
 * is what stops /privacy, /terms and the app funnel from looking like duplicates of /.
 */
export function applySeo({ title, description, canonicalPath, noindex = false }: SeoMeta): void {
  const resolvedTitle = title ?? DEFAULT_TITLE;
  const resolvedDescription = description ?? DEFAULT_DESCRIPTION;

  document.title = resolvedTitle;
  upsertMeta('meta[name="description"]', 'name', 'description', resolvedDescription);
  upsertMeta('meta[property="og:title"]', 'property', 'og:title', resolvedTitle);
  upsertMeta('meta[property="og:description"]', 'property', 'og:description', resolvedDescription);
  upsertMeta('meta[name="twitter:title"]', 'name', 'twitter:title', resolvedTitle);
  upsertMeta('meta[name="twitter:description"]', 'name', 'twitter:description', resolvedDescription);

  if (noindex) {
    upsertMeta('meta[name="robots"]', 'name', 'robots', 'noindex, nofollow');
    // A noindex page must not also claim a canonical, or the two signals conflict.
    document.head.querySelector('link[rel="canonical"]')?.remove();
    document.head.querySelector('meta[property="og:url"]')?.remove();
    return;
  }

  document.head.querySelector('meta[name="robots"]')?.remove();

  const canonical = `${SITE_ORIGIN}${canonicalPath ?? '/'}`;
  upsertCanonical(canonical);
  upsertMeta('meta[property="og:url"]', 'property', 'og:url', canonical);
}
