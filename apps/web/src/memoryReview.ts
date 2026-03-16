import { normalizeText, redactSensitiveText } from '@contexted/shared';

export type ReviewProvider = 'chatgpt' | 'claude' | 'other';

export type MemoryReviewAlert = {
  id: 'contact' | 'secret' | 'length';
  tone: 'warning' | 'negative';
  title: string;
  message: string;
};

export type MemoryReview = {
  normalizedText: string;
  previewText: string;
  redactedPreviewText: string;
  charCount: number;
  wordCount: number;
  replacements: number;
  signals: string[];
  alerts: MemoryReviewAlert[];
  manualReviewItems: string[];
};

export type IntakePreviewSnapshot = {
  providerLabel: string;
  previewText: string;
  redactedPreviewText: string;
  replacements: number;
  signals: string[];
  alerts: MemoryReviewAlert[];
};

const CONTACT_PATTERNS = [
  /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
  /(?<!\w)(?:\+?\d[\d().\s-]{8,}\d)(?!\w)/,
  /\b\d{3}[-.\s]?\d{2}[-.\s]?\d{4}\b/,
  /\b\d{10,15}\b/
];

const SECRET_PATTERNS = [
  /\bsk-[A-Za-z0-9]{16,}\b/,
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/i,
  /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/i,
  /\bAIza[0-9A-Za-z_-]{20,}\b/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\b(?:api[_ -]?key|secret|token|password)\b\s*[:=]/i
];

const STOPWORDS = new Set([
  'about',
  'after',
  'again',
  'also',
  'always',
  'another',
  'around',
  'because',
  'before',
  'being',
  'between',
  'bring',
  'built',
  'change',
  'changes',
  'chapter',
  'claude',
  'contact',
  'context',
  'contexted',
  'could',
  'detail',
  'details',
  'email',
  'export',
  'feels',
  'first',
  'from',
  'have',
  'into',
  'just',
  'keep',
  'keeps',
  'later',
  'memory',
  'might',
  'more',
  'most',
  'much',
  'other',
  'over',
  'paste',
  'profile',
  'public',
  'really',
  'returning',
  'reviewed',
  'same',
  'secret',
  'shared',
  'should',
  'something',
  'still',
  'that',
  'their',
  'them',
  'there',
  'these',
  'they',
  'this',
  'through',
  'today',
  'token',
  'want',
  'when',
  'which',
  'with',
  'words',
  'your',
  'youre',
  'chatgpt'
]);

const MANUAL_REVIEW_ITEMS = [
  'Remove names, employers, and exact locations yourself before continuing.',
  'Replace family details, usernames, and anything that would identify another person.',
  'Do not paste API keys, passwords, financial data, or government identifiers.',
  'Prefer a reviewed excerpt over a full memory dump.'
] as const;

function truncatePreview(value: string, maxLength: number = 340): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength).trimEnd()}…`;
}

function matchesAnyPattern(value: string, patterns: readonly RegExp[]): boolean {
  return patterns.some((pattern) => {
    pattern.lastIndex = 0;
    return pattern.test(value);
  });
}

function extractSignalTerms(value: string): string[] {
  const counts = new Map<string, number>();
  const tokens =
    value
      .toLowerCase()
      .replace(/\[redacted_[a-z_]+\]/gi, ' ')
      .match(/[a-z][a-z'-]{2,}/g) ?? [];

  for (const token of tokens) {
    const normalized = normalizeSignalToken(token);
    if (normalized.length < 4 || STOPWORDS.has(normalized)) {
      continue;
    }

    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || right[0].length - left[0].length || left[0].localeCompare(right[0]))
    .slice(0, 5)
    .map(([term]) => term);
}

function normalizeSignalToken(value: string): string {
  const trimmed = value.replace(/^['-]+|['-]+$/g, '');

  if (trimmed.endsWith('ies') && trimmed.length > 5) {
    return `${trimmed.slice(0, -3)}y`;
  }

  if (trimmed.endsWith('s') && !trimmed.endsWith('ss') && trimmed.length > 4) {
    return trimmed.slice(0, -1);
  }

  return trimmed;
}

export function deriveProviderLabel(provider: ReviewProvider, providerLabel: string): string {
  if (provider === 'chatgpt') {
    return 'ChatGPT excerpt';
  }

  if (provider === 'claude') {
    return 'Claude excerpt';
  }

  const trimmed = providerLabel.trim();
  return trimmed.length > 0 ? `${trimmed} excerpt` : 'Reviewed excerpt';
}

export function buildMemoryReview(value: string): MemoryReview {
  const normalizedText = normalizeText(value);
  const redacted = redactSensitiveText(normalizedText);
  const wordCount = normalizedText.length > 0 ? normalizedText.split(/\s+/).filter(Boolean).length : 0;
  const alerts: MemoryReviewAlert[] = [];

  if (matchesAnyPattern(normalizedText, CONTACT_PATTERNS)) {
    alerts.push({
      id: 'contact',
      tone: 'warning',
      title: 'Contact-style details spotted',
      message: 'We only soften contact-style details automatically. Review the excerpt yourself before continuing.'
    });
  }

  if (matchesAnyPattern(normalizedText, SECRET_PATTERNS)) {
    alerts.push({
      id: 'secret',
      tone: 'negative',
      title: 'Possible secret or credential spotted',
      message: 'Remove keys, tokens, passwords, and private credentials before you paste anything here.'
    });
  }

  if (wordCount > 700 || normalizedText.length > 5000) {
    alerts.push({
      id: 'length',
      tone: 'warning',
      title: 'This looks longer than a focused excerpt',
      message: 'A shorter reviewed excerpt usually gives clearer matching signals and exposes less personal detail.'
    });
  }

  return {
    normalizedText,
    previewText: truncatePreview(normalizedText),
    redactedPreviewText: truncatePreview(redacted.text),
    charCount: normalizedText.length,
    wordCount,
    replacements: redacted.replacements,
    signals: extractSignalTerms(redacted.text),
    alerts,
    manualReviewItems: [...MANUAL_REVIEW_ITEMS]
  };
}

export function buildPreviewSnapshot(
  review: MemoryReview,
  provider: ReviewProvider,
  providerLabel: string
): IntakePreviewSnapshot {
  return {
    providerLabel: deriveProviderLabel(provider, providerLabel),
    previewText: review.previewText,
    redactedPreviewText: review.redactedPreviewText,
    replacements: review.replacements,
    signals: review.signals,
    alerts: review.alerts
  };
}
