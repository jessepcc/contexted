const CONTROL_CHAR_REGEX = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
const SHA256_REGEX = /^[a-f0-9]{64}$/;
const SAFE_FILE_NAME_REGEX = /^[^\\/]+$/;

export function normalizeText(value: string): string {
  return value.normalize('NFKC').trim();
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
