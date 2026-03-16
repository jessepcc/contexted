import { describe, expect, it } from 'vitest';
import { buildMemoryReview, buildPreviewSnapshot, deriveProviderLabel } from '../src/memoryReview.js';

describe('memory review helpers', () => {
  it('builds a redacted preview with meaningful signals', () => {
    const review = buildMemoryReview(
      'Email me at user@example.com. I keep returning to philosophy, music, and careful writing.'
    );

    expect(review.redactedPreviewText).toContain('[redacted_email]');
    expect(review.replacements).toBe(1);
    expect(review.signals).toEqual(expect.arrayContaining(['philosophy', 'writing', 'music']));
  });

  it('raises a stronger alert when a secret-like pattern appears', () => {
    const review = buildMemoryReview('The token is sk-testsecretvalue123456789 and should never be shared.');

    expect(review.alerts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'secret',
          tone: 'negative'
        })
      ])
    );
  });

  it('adds contact and length warnings for long excerpts that still need manual review', () => {
    const longExcerpt = `Call me at 415-555-1212. ${Array.from({ length: 705 }, () => 'curiosity').join(' ')}`;
    const review = buildMemoryReview(longExcerpt);

    expect(review.previewText.endsWith('…')).toBe(true);
    expect(review.alerts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'contact',
          tone: 'warning'
        }),
        expect.objectContaining({
          id: 'length',
          tone: 'warning'
        })
      ])
    );
  });

  it('derives readable provider labels for built-in and custom providers', () => {
    expect(deriveProviderLabel('chatgpt', '')).toBe('ChatGPT excerpt');
    expect(deriveProviderLabel('claude', '')).toBe('Claude excerpt');
    expect(deriveProviderLabel('other', 'Gemini')).toBe('Gemini excerpt');
    expect(deriveProviderLabel('other', '   ')).toBe('Reviewed excerpt');
  });

  it('builds a preview snapshot suitable for persistence', () => {
    const review = buildMemoryReview('I care about thoughtful conversation and calm honesty.');

    expect(buildPreviewSnapshot(review, 'claude', '')).toEqual({
      providerLabel: 'Claude excerpt',
      previewText: 'I care about thoughtful conversation and calm honesty.',
      redactedPreviewText: 'I care about thoughtful conversation and calm honesty.',
      replacements: 0,
      signals: expect.arrayContaining(['thoughtful', 'conversation', 'honesty']),
      alerts: []
    });
  });

  it('normalizes simple plural signal terms before surfacing them', () => {
    const review = buildMemoryReview('I value conversations, stories, and communities that reward honesty.');

    expect(review.signals).toEqual(expect.arrayContaining(['conversation', 'story', 'community']));
  });
});
