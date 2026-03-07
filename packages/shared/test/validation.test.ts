import { describe, expect, it } from 'vitest';
import {
  confessionSchema,
  intakeSummarySchema,
  magicLinkSchema,
  preferencesSchema,
  sendMessageSchema,
  uploadInitSchema
} from '../src/validation.js';

describe('validation schemas', () => {
  it('normalizes and lowercases email', () => {
    const output = magicLinkSchema.parse({
      email: '  USER@Example.COM  ',
      redirect_to: 'https://contexted.app/auth/verify'
    });
    expect(output.email).toBe('user@example.com');
  });

  it('rejects upload init with file path separator', () => {
    expect(() =>
      uploadInitSchema.parse({
        source: 'chatgpt',
        file_name: '../memory.json',
        file_size: 1000,
        sha256: 'a'.repeat(64)
      })
    ).toThrow(/path separators/i);
  });

  it('rejects unknown fields', () => {
    expect(() =>
      preferencesSchema.parse({
        gender_identity: 'M',
        attracted_to: ['F'],
        age_min: 21,
        age_max: 30,
        extra: true
      })
    ).toThrow();
  });

  it('rejects control chars in confession', () => {
    expect(() => confessionSchema.parse({ answer: 'hello\u0001', expected_version: 0 })).toThrow(
      /control characters/i
    );
  });

  it('accepts message body and trims whitespace', () => {
    const parsed = sendMessageSchema.parse({
      client_message_id: '  abc-1  ',
      body: '  hello there  '
    });
    expect(parsed.client_message_id).toBe('abc-1');
    expect(parsed.body).toBe('hello there');
  });

  it('requires provider_label for source=both intake summary', () => {
    expect(() =>
      intakeSummarySchema.parse({
        summary_text: 'This is my memory summary.',
        source: 'both'
      })
    ).toThrow(/provider_label is required/i);
  });

  it('accepts intake summary with custom provider label', () => {
    const parsed = intakeSummarySchema.parse({
      summary_text: '  This is my memory summary.  ',
      source: 'both',
      provider_label: '  Gemini  '
    });

    expect(parsed.summary_text).toBe('This is my memory summary.');
    expect(parsed.provider_label).toBe('Gemini');
  });
});
