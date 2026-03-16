import type { ReactElement } from 'react';
import { LegalPageLayout } from '../components/LegalPageLayout.js';

const sections = [
  {
    id: 'scope',
    title: 'What this policy covers',
    paragraphs: [
      'This policy explains how Contexted handles the information you give us when you use the product, including the AI-memory text you paste in, your email address, your matching preferences, and activity tied to invites, matching, chat, and feedback.',
      'It is written for the product as it exists today: an alpha service focused on matching people through recurring themes and tone found in AI memory.',
    ],
  },
  {
    id: 'collect',
    title: 'What we collect',
    paragraphs: [
      'We collect the information you choose to provide directly, such as your email address, matching preferences, invite usage, chat messages, reports, feedback, and the reviewed memory excerpt you paste into intake.',
      'We also create derived data from that intake so the product can function.',
    ],
    bullets: [
      'A reviewed draft of your excerpt may be stored in browser storage on your device until you finish the flow or clear it.',
      'The service generates and stores a redacted matching text, a derived summary, a vibe-check style description, and an embedding used for similarity search.',
      'We keep basic operational records such as rate-limit state, ingestion job state, and match lifecycle data.',
    ],
  },
  {
    id: 'use',
    title: 'How we use it',
    paragraphs: [
      'We use your information to authenticate you, process intake, generate matching signals, run batch drops, open reveal and chat states, prevent abuse, and improve the product.',
      'We do not position Contexted as a general-purpose data broker. The point of processing is to operate the matching experience you asked to use.',
    ],
  },
  {
    id: 'processors',
    title: 'Services involved',
    paragraphs: [
      'Running Contexted may involve third-party infrastructure and model providers. In the current stack that includes Cloudflare, Supabase, OpenAI, and optionally Anthropic.',
      'Those services may process data on our behalf so the app can authenticate users, store records, generate embeddings, or create derived matching copy.',
    ],
  },
  {
    id: 'retention',
    title: 'Retention and limits',
    paragraphs: [
      'Today, Contexted stores the redacted matching text and derived summary that power future drops. That means the system does not currently behave like a pure transient processor.',
      'Automatic redaction is intentionally limited. It mostly catches contact-style details, not every identifying reference. DO NOT paste names, employers, exact locations, family details, sensitive secrets, financial data, government identifiers, or anything you would not want retained in redacted form as part of your profile state.',
    ],
    bullets: [
      'Raw drafts on your device remain subject to your browser storage until you clear them or finish the flow.',
      'Operational and moderation records may be kept longer when needed to keep the service safe and usable.',
      'We may change retention behavior as the alpha evolves, and if we do, this page should change with it.',
    ],
  },
  {
    id: 'choices',
    title: 'Your choices',
    paragraphs: [
      'You control what you paste into Contexted. The safest approach is to share only a reviewed excerpt that you genuinely want used for matching.',
      'If you do not want a piece of information processed, do not submit it. This service is not designed for full memory exports, medical, legal, payment, or other highly regulated personal records.',
    ],
  },
] as const;

export function PrivacyPage(): ReactElement {
  return (
    <LegalPageLayout
      currentPage="privacy"
      eyebrow="PRIVACY POLICY"
      title="How Contexted handles the memory you hand it."
      intro="This experiment only works if the data story is readable. Here is the plain-language version of what the current alpha keeps, derives, and uses when you trust it with intimate text."
      updatedLabel="Last updated March 16, 2026"
      highlights={['Email sign-in', 'Manual review required', 'Derived matching profile']}
      sections={[...sections]}
      summaryTitle="What matters most"
      summaryBullets={[
        'We use your email to sign you in and your reviewed excerpt to generate matching signals.',
        'The service stores redacted matching text and derived profile data today.',
        'Automatic redaction is limited, so you should remove names, employers, exact locations, and secrets yourself before submitting.',
      ]}
    />
  );
}
