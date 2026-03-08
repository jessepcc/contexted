const CONTROL_CHAR_REGEX = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
const SHA256_REGEX = /^[a-f0-9]{64}$/;
const SAFE_FILE_NAME_REGEX = /^[^\\/]+$/;
const EMAIL_REGEX = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const SSN_REGEX = /\b\d{3}[-.\s]?\d{2}[-.\s]?\d{4}\b/g;
const PHONE_REGEX = /(?<!\w)(?:\+?\d[\d().\s-]{8,}\d)(?!\w)/g;
const LONG_DIGIT_REGEX = /\b\d{10,15}\b/g;
const REDACTION_MARKER_REGEX = /\[redacted_[a-z_]+\]/gi;
const REDACTION_MARKER_DETECT_REGEX = /\[redacted_[a-z_]+\]/i;
const REDACTION_FRAGMENT_SPLIT_REGEX = /(?:\r?\n)+|(?<=[.!?])\s+/;
const CONTACT_PREFIX_REGEX =
  /^(?:you can\s+)?(?:email|e-mail|mail|message|dm|text|call|reach|contact)\s+me(?:\s+(?:at|on|via))?[\s,:;.!?-]*/i;
const CONTACT_LABEL_PREFIX_REGEX =
  /^(?:my\s+)?(?:email|e-mail|phone|number|handle|telegram|whatsapp|signal)\s*(?:is|:)\s*[\s,:;.!?-]*/i;
const CONTACT_SUFFIX_REGEX =
  /(?:[,;:]\s*|\s+(?:and|or)\s+)(?:you can\s+)?(?:email|e-mail|mail|message|dm|text|call|reach|contact)\s+me(?:\s+(?:at|on|via))?[\s,:;.!?-]*$/i;
const CONTACT_LABEL_SUFFIX_REGEX =
  /(?:[,;:]\s*|\s+(?:and|or)\s+)(?:my\s+)?(?:email|e-mail|phone|number|handle|telegram|whatsapp|signal)\s*(?:is|:)\s*[\s,:;.!?-]*$/i;

export function normalizeText(value: string): string {
  return value.normalize('NFKC').trim();
}

export function redactSensitiveText(value: string): { text: string; replacements: number } {
  let replacements = 0;

  const redact = (input: string, pattern: RegExp, replacement: string): string =>
    input.replace(pattern, () => {
      replacements += 1;
      return replacement;
    });

  const patterns: Array<[RegExp, string]> = [
    [EMAIL_REGEX, '[redacted_email]'],
    [SSN_REGEX, '[redacted_ssn]'],
    [PHONE_REGEX, '[redacted_phone]'],
    [LONG_DIGIT_REGEX, '[redacted_number]']
  ];

  const text = patterns.reduce((current, [pattern, replacement]) => redact(current, pattern, replacement), normalizeText(value));

  return {
    text,
    replacements
  };
}

export function redactCommonPii(value: string): string {
  return redactSensitiveText(value).text;
}

function compactWhitespace(value: string): string {
  return value
    .replace(REDACTION_MARKER_REGEX, ' ')
    .replace(/\s+([,.;!?])/g, '$1')
    .replace(/([(\[])\s+/g, '$1')
    .replace(/\s+([)\]])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripContactStub(value: string): string {
  const withoutRedactionMarkers = compactWhitespace(value);

  return compactWhitespace(
    withoutRedactionMarkers
      .replace(CONTACT_PREFIX_REGEX, '')
      .replace(CONTACT_LABEL_PREFIX_REGEX, '')
      .replace(CONTACT_SUFFIX_REGEX, '')
      .replace(CONTACT_LABEL_SUFFIX_REGEX, '')
      .replace(/^[,;:!?.-]+\s*/g, '')
      .replace(/[,;:]+\s*$/g, '')
      .replace(/^(?:and|or)\s+/i, '')
  );
}

function meaningfulTokenCount(value: string): number {
  return value.match(/[a-z]{4,}/gi)?.length ?? 0;
}

export function stripRedactionArtifacts(value: string): string {
  const normalized = normalizeText(value);
  if (normalized.length === 0) {
    return '';
  }

  const fragments = normalized
    .split(REDACTION_FRAGMENT_SPLIT_REGEX)
    .map((fragment) => fragment.trim())
    .filter((fragment) => fragment.length > 0);

  const cleanedFragments = fragments.flatMap((fragment) => {
    const cleaned = stripContactStub(fragment);
    if (cleaned.length === 0) {
      return [];
    }

    if (REDACTION_MARKER_DETECT_REGEX.test(fragment) && meaningfulTokenCount(cleaned) < 3) {
      return [];
    }

    return [cleaned];
  });

  if (cleanedFragments.length > 0) {
    return cleanedFragments.join(' ');
  }

  const cleaned = compactWhitespace(normalized);
  return meaningfulTokenCount(cleaned) >= 2 ? cleaned : '';
}

export function piiRiskScoreFromReplacements(replacements: number): number {
  return Math.min(100, replacements * 25);
}

export function estimatePiiRiskScore(value: string): number {
  const markers = normalizeText(value).match(REDACTION_MARKER_REGEX)?.length ?? 0;
  return piiRiskScoreFromReplacements(markers);
}

export function hasDisallowedControlChars(value: string): boolean {
  return CONTROL_CHAR_REGEX.test(value);
}

export function assertSafeText(value: string): void {
  if (hasDisallowedControlChars(value)) {
    throw new Error('Control characters are not allowed.');
  }
}

export function normalizeEmail(email: string): string {
  return normalizeText(email).toLowerCase();
}

export function assertSha256Hex(value: string): void {
  if (!SHA256_REGEX.test(value)) {
    throw new Error('SHA-256 must be lowercase hex with length 64.');
  }
}

export function assertSafeFileName(fileName: string): void {
  const normalized = normalizeText(fileName);
  if (!SAFE_FILE_NAME_REGEX.test(normalized)) {
    throw new Error('File name cannot include path separators.');
  }
}

export function assertUtf8PayloadSize(payload: string, maxBytes: number): void {
  const bytes = new TextEncoder().encode(payload).byteLength;
  if (bytes > maxBytes) {
    throw new Error(`Payload exceeds ${maxBytes} bytes.`);
  }
}
