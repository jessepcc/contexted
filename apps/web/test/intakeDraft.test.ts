import { afterEach, describe, expect, it } from 'vitest';
import {
  clearActiveJobId,
  clearIntakeDraft,
  draftToIntakePayload,
  getActiveJobId,
  loadIntakeDraft,
  saveIntakeDraft,
  setActiveJobId
} from '../src/intakeDraft.js';

describe('intake draft helpers', () => {
  afterEach(() => {
    clearIntakeDraft();
    clearActiveJobId();
  });

  it('round-trips intake draft in localStorage', () => {
    saveIntakeDraft({
      summaryText: '  My memory summary  ',
      provider: 'chatgpt',
      providerLabel: 'ignored'
    });

    expect(loadIntakeDraft()).toEqual({
      summaryText: 'My memory summary',
      provider: 'chatgpt',
      providerLabel: 'ignored'
    });
  });

  it('maps custom provider to source=both with provider_label', () => {
    const payload = draftToIntakePayload({
      summaryText: 'summary',
      provider: 'other',
      providerLabel: 'Gemini'
    });

    expect(payload).toEqual({
      summary_text: 'summary',
      source: 'both',
      provider_label: 'Gemini'
    });
  });

  it('stores and loads active processing job id', () => {
    expect(getActiveJobId()).toBeNull();
    setActiveJobId('job-123');
    expect(getActiveJobId()).toBe('job-123');
  });
});
