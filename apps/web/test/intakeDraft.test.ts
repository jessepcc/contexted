import { afterEach, describe, expect, it } from 'vitest';
import { redactSensitiveText } from '../../../packages/shared/src/sanitization.js';
import {
  clearActiveJobId,
  clearIntakeDraft,
  clearLastIntakePreview,
  draftToIntakePayload,
  getActiveJobId,
  loadLastIntakePreview,
  loadIntakeDraft,
  saveIntakeDraft,
  saveLastIntakePreview,
  setActiveJobId
} from '../src/intakeDraft.js';

describe('intake draft helpers', () => {
  afterEach(() => {
    clearIntakeDraft();
    clearActiveJobId();
    clearLastIntakePreview();
  });

  it('round-trips intake draft in localStorage', () => {
    saveIntakeDraft({
      summaryText: '  My memory summary  ',
      provider: 'chatgpt',
      providerLabel: 'ignored',
      reviewConfirmed: true
    });

    expect(loadIntakeDraft()).toEqual({
      summaryText: 'My memory summary',
      provider: 'chatgpt',
      providerLabel: 'ignored',
      reviewConfirmed: true
    });
  });

  it('maps custom provider to source=both with provider_label', () => {
    const payload = draftToIntakePayload({
      summaryText: 'summary',
      provider: 'other',
      providerLabel: 'Gemini',
      reviewConfirmed: true
    });

    expect(payload).toEqual({
      summary_text: 'summary',
      source: 'both',
      provider_label: 'Gemini'
    });
  });

  it('maps built-in providers to their direct intake sources', () => {
    expect(
      draftToIntakePayload({
        summaryText: '  chatgpt summary  ',
        provider: 'chatgpt',
        providerLabel: '',
        reviewConfirmed: true
      })
    ).toEqual({
      summary_text: 'chatgpt summary',
      source: 'chatgpt'
    });

    expect(
      draftToIntakePayload({
        summaryText: ' claude summary ',
        provider: 'claude',
        providerLabel: '',
        reviewConfirmed: true
      })
    ).toEqual({
      summary_text: 'claude summary',
      source: 'claude'
    });
  });

  it('stores and loads active processing job id', () => {
    expect(getActiveJobId()).toBeNull();
    setActiveJobId('job-123');
    expect(getActiveJobId()).toBe('job-123');
  });

  it('stores and loads the last intake preview snapshot', () => {
    saveLastIntakePreview({
      providerLabel: 'Claude excerpt',
      previewText: 'Thoughtful conversation and creative work.',
      redactedPreviewText: 'Thoughtful conversation and creative work.',
      replacements: 1,
      signals: ['thoughtful', 'creative'],
      alerts: [
        {
          id: 'contact',
          tone: 'warning',
          title: 'Contact-style details spotted',
          message: 'Review the excerpt yourself before continuing.'
        }
      ]
    });

    expect(loadLastIntakePreview()).toEqual({
      providerLabel: 'Claude excerpt',
      previewText: 'Thoughtful conversation and creative work.',
      redactedPreviewText: 'Thoughtful conversation and creative work.',
      replacements: 1,
      signals: ['thoughtful', 'creative'],
      alerts: [
        {
          id: 'contact',
          tone: 'warning',
          title: 'Contact-style details spotted',
          message: 'Review the excerpt yourself before continuing.'
        }
      ]
    });
  });

  it('drops malformed draft and preview payloads from localStorage', () => {
    localStorage.setItem(
      'contexted_intake_draft',
      JSON.stringify({
        summaryText: 'summary',
        provider: 'invalid-provider',
        providerLabel: 'ignored',
        reviewConfirmed: true
      })
    );
    expect(loadIntakeDraft()).toBeNull();

    localStorage.setItem(
      'contexted_last_intake_preview',
      JSON.stringify({
        providerLabel: 'Claude excerpt',
        previewText: 'Thoughtful conversation and creative work.',
        redactedPreviewText: 'Thoughtful conversation and creative work.',
        replacements: 1,
        signals: ['thoughtful', 42, 'creative'],
        alerts: [
          {
            id: 'contact',
            tone: 'warning',
            title: 'Contact-style details spotted',
            message: 'Review the excerpt yourself before continuing.'
          },
          {
            id: 'unknown',
            tone: 'warning',
            title: 'Should be ignored',
            message: 'Bad alert shape'
          }
        ]
      })
    );

    expect(loadLastIntakePreview()).toEqual({
      providerLabel: 'Claude excerpt',
      previewText: 'Thoughtful conversation and creative work.',
      redactedPreviewText: 'Thoughtful conversation and creative work.',
      replacements: 1,
      signals: ['thoughtful', 'creative'],
      alerts: [
        {
          id: 'contact',
          tone: 'warning',
          title: 'Contact-style details spotted',
          message: 'Review the excerpt yourself before continuing.'
        }
      ]
    });
  });

  it('matches the browser-side redaction behavior used before intake submission', () => {
    expect(redactSensitiveText('Reach me at user@example.com and 415-555-1212').text).toBe(
      'Reach me at [redacted_email] and [redacted_phone]'
    );
  });
});
