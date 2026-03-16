import type { ReactElement } from 'react';
import { LegalPageLayout } from '../components/LegalPageLayout.js';

const sections = [
  {
    id: 'acceptance',
    title: 'Using Contexted',
    paragraphs: [
      'By signing up for Contexted or using the service, you agree to these terms. If you do not agree, do not use the product.',
      'Contexted is an alpha experiment. Features may change, disappear, pause, or fail without much ceremony while the product is still being built.',
    ],
  },
  {
    id: 'eligibility',
    title: 'Who can use it',
    paragraphs: [
      'You must be at least 18 years old and legally able to agree to these terms.',
      'You are responsible for using an email address you control and for providing truthful information where the app asks for it.',
    ],
  },
  {
    id: 'conduct',
    title: 'What you agree not to do',
    paragraphs: ['Contexted is meant to support thoughtful matching, not scraping, abuse, or impersonation.'],
    bullets: [
      'Do not harass, threaten, deceive, stalk, or impersonate other people.',
      'Do not submit content you do not have permission to use.',
      'Do not try to reverse engineer, overload, or break the service.',
      'Do not use the product to collect other people’s private data or to evade moderation.',
    ],
  },
  {
    id: 'content',
    title: 'Your content and our license to process it',
    paragraphs: [
      'You keep ownership of the text you submit. By using Contexted, you give us permission to host, redact, transform, analyze, and store that content as needed to operate the product.',
      'That permission includes creating derived summaries, matching text, embeddings, reveal copy, and other output needed to run the service.',
    ],
  },
  {
    id: 'service',
    title: 'No promise of outcomes',
    paragraphs: [
      'Contexted does not promise you a match, a chat, a response, or a particular quality of interpersonal outcome.',
      'Invite priority, if offered, means earlier consideration in the queue. It does not mean guaranteed matching, access, or success.',
    ],
  },
  {
    id: 'termination',
    title: 'Suspension and termination',
    paragraphs: [
      'We may suspend, limit, or end access to the service if we believe you are abusing it, harming other users, creating legal risk, or interfering with operations.',
      'We may also pause or shut down parts of the alpha product when we need to debug, change direction, or stop offering a feature.',
    ],
  },
  {
    id: 'disclaimers',
    title: 'Disclaimers and liability',
    paragraphs: [
      'Contexted is provided on an “as is” and “as available” basis. We do not guarantee uninterrupted service, perfect matching quality, or error-free behavior.',
      'To the extent allowed by law, we are not liable for indirect, incidental, special, consequential, or punitive damages arising from your use of the service.',
    ],
  },
  {
    id: 'privacy',
    title: 'Privacy still governs data handling',
    paragraphs: [
      'Our Privacy Policy explains how the service currently handles submitted memory, account data, and derived matching information.',
      'If these terms and the Privacy Policy ever point in different directions on data handling, the more specific privacy disclosure should control for that topic.',
    ],
  },
] as const;

export function TermsPage(): ReactElement {
  return (
    <LegalPageLayout
      currentPage="terms"
      eyebrow="TERMS OF SERVICE"
      title="The rules for using an experimental product built around AI memory."
      intro="These terms are intentionally plain. Contexted is still early, and the contract should be readable by the people actually using it."
      updatedLabel="Last updated March 16, 2026"
      highlights={['18+ only', 'Use it respectfully', 'Alpha means unfinished']}
      sections={[...sections]}
      summaryTitle="Short version"
      summaryBullets={[
        'You must be 18+ and use the service respectfully.',
        'You keep ownership of what you submit, but you let Contexted process it to run matching.',
        'This is an alpha product with no guarantee of matches, uptime, or polished outcomes.',
      ]}
    />
  );
}
