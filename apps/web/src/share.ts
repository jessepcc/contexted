export type ShareOutcome = 'shared' | 'copied' | 'cancelled';

export async function shareOrCopy(input: {
  title: string;
  text: string;
  url?: string;
}): Promise<ShareOutcome> {
  const shareData = {
    title: input.title,
    text: input.text,
    url: input.url
  };

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share(shareData);
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return 'cancelled';
      }
    }
  }

  const fallbackText = [input.text, input.url].filter(Boolean).join(' ');
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(fallbackText);
    return 'copied';
  }

  throw new Error('Sharing is not available on this device.');
}
