import { Link } from '@tanstack/react-router';
import { motion } from 'motion/react';
import type { ReactElement } from 'react';
import { PageShell } from './PageShell.js';
import { useReducedMotion } from '../hooks/useDelight.js';

type LegalSection = {
  id: string;
  title: string;
  paragraphs: readonly string[];
  bullets?: readonly string[];
};

type LegalPage = 'privacy' | 'terms';

const pageLinks: ReadonlyArray<{ id: LegalPage; label: string; href: '/privacy' | '/terms' }> = [
  { id: 'privacy', label: 'Privacy', href: '/privacy' },
  { id: 'terms', label: 'Terms', href: '/terms' },
];

export function LegalPageLayout({
  currentPage,
  eyebrow,
  title,
  intro,
  updatedLabel,
  highlights = [],
  sections,
  summaryTitle,
  summaryBullets,
}: {
  currentPage: LegalPage;
  eyebrow: string;
  title: string;
  intro: string;
  updatedLabel: string;
  highlights?: readonly string[];
  sections: readonly LegalSection[];
  summaryTitle: string;
  summaryBullets: readonly string[];
}): ReactElement {
  const reduced = useReducedMotion();
  const fadeUp = (delay: number) =>
    reduced
      ? {}
      : {
          initial: { opacity: 0, y: 18 } as const,
          animate: { opacity: 1, y: 0 } as const,
          transition: { type: 'spring' as const, stiffness: 200, damping: 22, delay },
        };

  return (
    <PageShell blobs="landing">
      <div className="px-4 pb-12 pt-6 sm:px-6 sm:pt-8 lg:px-8 lg:pb-16">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
          <motion.header className="flex flex-wrap items-center justify-between gap-4" {...fadeUp(0)}>
            <Link
              to="/"
              className="flex flex-col transition-colors hover:text-accent-ink"
            >
              <span className="font-heading text-lg font-bold tracking-tight text-text-primary sm:text-xl">Contexted</span>
              <span className="text-[11px] tracking-wide text-text-secondary sm:text-xs">
                Matching with your AI&apos;s memory
              </span>
            </Link>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                to="/"
                className="rounded-full border border-border-default bg-bg-card px-4 py-2 text-sm text-text-secondary transition-colors hover:border-accent hover:text-accent-ink"
              >
                Back home
              </Link>
              <nav
                aria-label="Legal pages"
                className="flex flex-wrap items-center gap-2 rounded-full border border-border-default bg-bg-card/90 p-1 text-sm"
              >
                {pageLinks.map((pageLink) => {
                  const isActive = currentPage === pageLink.id;

                  return (
                    <Link
                      key={pageLink.id}
                      to={pageLink.href}
                      className={`rounded-full px-3 py-1.5 transition-colors ${
                        isActive
                          ? 'bg-accent-soft text-accent-ink'
                          : 'text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      {pageLink.label}
                    </Link>
                  );
                })}
              </nav>
            </div>
          </motion.header>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.02fr)_minmax(18rem,0.82fr)] lg:items-start lg:gap-8">
            <div className="flex flex-col gap-5">
              <motion.div
                className="rounded-[32px] border border-border-strong px-6 py-7 shadow-[0_32px_80px_-52px_rgba(38,24,20,0.45)] sm:px-7 sm:py-8"
                style={{
                  background:
                    'linear-gradient(180deg, rgba(255, 249, 243, 0.96) 0%, rgba(255, 249, 243, 0.84) 100%)',
                }}
                {...fadeUp(0.06)}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="text-[11px] font-bold tracking-[0.22em] text-accent-ink">{eyebrow}</span>
                  <span className="rounded-full border border-border-default bg-bg-card/90 px-3 py-1 text-[11px] font-semibold tracking-[0.12em] text-text-muted">
                    {updatedLabel}
                  </span>
                </div>
                <h1 className="mt-4 max-w-3xl font-heading text-[clamp(2.3rem,5vw,4rem)] font-bold leading-[0.95] tracking-[-0.04em] text-text-primary">
                  {title}
                </h1>
                <p className="mt-4 max-w-2xl text-sm leading-relaxed text-text-secondary sm:text-[15px]">
                  {intro}
                </p>
                {highlights.length > 0 ? (
                  <div className="mt-5 flex flex-wrap gap-3">
                    {highlights.map((highlight) => (
                      <span
                        key={highlight}
                        className="rounded-full border border-border-default bg-bg-card/90 px-4 py-2 text-sm text-text-secondary"
                      >
                        {highlight}
                      </span>
                    ))}
                  </div>
                ) : null}
              </motion.div>

              <div className="flex flex-col gap-4">
                {sections.map((section, index) => (
                  <motion.section
                    key={section.id}
                    id={section.id}
                    className="scroll-mt-6 rounded-[28px] border border-border-default bg-bg-card px-5 py-5 sm:px-6 sm:py-6"
                    {...fadeUp(0.14 + index * 0.05)}
                  >
                    <div className="flex items-start gap-3">
                      <span className="rounded-full bg-accent-soft px-3 py-1 text-[11px] font-bold tracking-[0.18em] text-accent-ink">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <div className="min-w-0">
                        <h2 className="font-heading text-xl font-semibold tracking-tight text-text-primary">
                          {section.title}
                        </h2>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-col gap-3">
                      {section.paragraphs.map((paragraph) => (
                        <p key={paragraph} className="text-sm leading-relaxed text-text-secondary">
                          {paragraph}
                        </p>
                      ))}
                    </div>
                    {section.bullets ? (
                      <ul className="mt-4 flex flex-col gap-3">
                        {section.bullets.map((bullet) => (
                          <li key={bullet} className="flex items-start gap-3 text-sm leading-relaxed text-text-secondary">
                            <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-accent" />
                            <span>{bullet}</span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </motion.section>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-4 lg:sticky lg:top-8">
              <motion.aside
                className="rounded-[28px] border border-border-strong bg-bg-card/95 px-5 py-5 sm:px-6 sm:py-6"
                {...fadeUp(0.18)}
              >
                <span className="text-[11px] font-bold tracking-[0.22em] text-text-muted">AT A GLANCE</span>
                <h2 className="mt-3 font-heading text-xl font-semibold tracking-tight text-text-primary">{summaryTitle}</h2>
                <ul className="mt-4 flex flex-col gap-3">
                  {summaryBullets.map((bullet) => (
                    <li key={bullet} className="flex items-start gap-3 text-sm leading-relaxed text-text-secondary">
                      <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-positive" />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              </motion.aside>

              <motion.aside
                className="rounded-[28px] border border-border-default bg-bg-card px-5 py-5 sm:px-6 sm:py-6"
                {...fadeUp(0.24)}
              >
                <span className="text-[11px] font-bold tracking-[0.22em] text-text-muted">ON THIS PAGE</span>
                <nav className="mt-4 flex flex-col gap-2" aria-label="Sections on this page">
                  {sections.map((section, index) => (
                    <a
                      key={section.id}
                      href={`#${section.id}`}
                      className="flex items-center gap-3 rounded-[18px] px-3 py-2 text-left transition-colors hover:bg-accent-soft"
                    >
                      <span className="rounded-full bg-accent-soft px-2.5 py-1 text-[10px] font-bold tracking-[0.18em] text-accent-ink">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <span className="text-sm font-medium text-text-primary">{section.title}</span>
                    </a>
                  ))}
                </nav>
              </motion.aside>

              <motion.aside
                className="rounded-[28px] border border-accent/18 bg-accent-soft/60 px-5 py-5 sm:px-6 sm:py-6"
                {...fadeUp(0.3)}
              >
                <span className="text-[11px] font-bold tracking-[0.22em] text-accent-ink">ALPHA CONTEXT</span>
                <p className="mt-3 text-sm leading-relaxed text-text-secondary">
                  Contexted is still an experiment. These pages are meant to make the current product behavior legible,
                  not to hide uncertainty behind polished language.
                </p>
                <div className="mt-4 flex flex-wrap gap-3 text-sm">
                  <Link to="/privacy" className="font-medium text-accent-ink underline decoration-accent/35 underline-offset-4 hover:text-accent">
                    Privacy Policy
                  </Link>
                  <Link to="/terms" className="font-medium text-accent-ink underline decoration-accent/35 underline-offset-4 hover:text-accent">
                    Terms of Service
                  </Link>
                </div>
              </motion.aside>
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
