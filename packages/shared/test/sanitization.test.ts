import { describe, expect, it } from 'vitest';
import { piiRiskScoreFromReplacements, redactSensitiveText, stripRedactionArtifacts } from '../src/sanitization.js';

describe('sanitization helpers', () => {
  it('redacts common pii markers and counts replacements', () => {
    const result = redactSensitiveText('Email me at user@example.com or +1 (415) 555-1212.');

    expect(result).toEqual({
      text: 'Email me at [redacted_email] or [redacted_phone].',
      replacements: 2
    });
  });

  it('converts replacement counts into bounded pii risk scores', () => {
    expect(piiRiskScoreFromReplacements(0)).toBe(0);
    expect(piiRiskScoreFromReplacements(2)).toBe(50);
    expect(piiRiskScoreFromReplacements(12)).toBe(100);
  });

  it('drops low-signal fragments dominated by redaction markers', () => {
    expect(
      stripRedactionArtifacts(
        'Email me at [redacted_email] and call [redacted_phone]. I like philosophy, music, and building tools.'
      )
    ).toBe('I like philosophy, music, and building tools.');
  });

  it('keeps substantive fragments after removing redaction markers', () => {
    expect(
      stripRedactionArtifacts('I keep returning to philosophy, and you can reach me at [redacted_email].')
    ).toBe('I keep returning to philosophy');
  });

  it('removes contact stubs when substance remains in the same fragment', () => {
    expect(stripRedactionArtifacts('Call me at [redacted_phone], I keep returning to philosophy and music.')).toBe(
      'I keep returning to philosophy and music.'
    );
  });
});
