export type IntakeProvider = 'chatgpt' | 'claude' | 'other';

export type IntakeDraft = {
  summaryText: string;
  provider: IntakeProvider;
  providerLabel: string;
  reviewConfirmed: boolean;
};

export type LastIntakePreview = {
  providerLabel: string;
  previewText: string;
  redactedPreviewText: string;
  replacements: number;
  signals: string[];
  alerts: Array<{
    id: 'contact' | 'secret' | 'length';
    tone: 'warning' | 'negative';
    title: string;
    message: string;
  }>;
};

type IntakeRequestPayload = {
  summary_text: string;
  source: 'chatgpt' | 'claude' | 'both';
  provider_label?: string;
};

const INTAKE_DRAFT_KEY = 'contexted_intake_draft';
const ACTIVE_JOB_KEY = 'contexted_active_job_id';
const LAST_PREVIEW_KEY = 'contexted_last_intake_preview';

function asProvider(value: unknown): IntakeProvider | null {
  return value === 'chatgpt' || value === 'claude' || value === 'other' ? value : null;
}

export function loadIntakeDraft(): IntakeDraft | null {
  const raw = localStorage.getItem(INTAKE_DRAFT_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<IntakeDraft>;
    const provider = asProvider(parsed.provider);
    const summaryText = typeof parsed.summaryText === 'string' ? parsed.summaryText.trim() : '';
    const providerLabel = typeof parsed.providerLabel === 'string' ? parsed.providerLabel.trim() : '';
    const reviewConfirmed = parsed.reviewConfirmed === true;

    if (!provider || !summaryText) {
      return null;
    }

    return {
      summaryText,
      provider,
      providerLabel,
      reviewConfirmed
    };
  } catch {
    return null;
  }
}

export function saveIntakeDraft(draft: IntakeDraft): void {
  localStorage.setItem(
    INTAKE_DRAFT_KEY,
    JSON.stringify({
      summaryText: draft.summaryText.trim(),
      provider: draft.provider,
      providerLabel: draft.providerLabel.trim(),
      reviewConfirmed: draft.reviewConfirmed
    })
  );
}

export function clearIntakeDraft(): void {
  localStorage.removeItem(INTAKE_DRAFT_KEY);
}

export function loadLastIntakePreview(): LastIntakePreview | null {
  const raw = localStorage.getItem(LAST_PREVIEW_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<LastIntakePreview>;
    if (
      typeof parsed.providerLabel !== 'string' ||
      typeof parsed.previewText !== 'string' ||
      typeof parsed.redactedPreviewText !== 'string' ||
      typeof parsed.replacements !== 'number' ||
      !Array.isArray(parsed.signals) ||
      !Array.isArray(parsed.alerts)
    ) {
      return null;
    }

    return {
      providerLabel: parsed.providerLabel,
      previewText: parsed.previewText,
      redactedPreviewText: parsed.redactedPreviewText,
      replacements: parsed.replacements,
      signals: parsed.signals.filter((value): value is string => typeof value === 'string'),
      alerts: parsed.alerts.filter(
        (value): value is LastIntakePreview['alerts'][number] =>
          Boolean(value) &&
          typeof value === 'object' &&
          (value.id === 'contact' || value.id === 'secret' || value.id === 'length') &&
          (value.tone === 'warning' || value.tone === 'negative') &&
          typeof value.title === 'string' &&
          typeof value.message === 'string'
      )
    };
  } catch {
    return null;
  }
}

export function saveLastIntakePreview(preview: LastIntakePreview): void {
  localStorage.setItem(
    LAST_PREVIEW_KEY,
    JSON.stringify({
      providerLabel: preview.providerLabel.trim(),
      previewText: preview.previewText.trim(),
      redactedPreviewText: preview.redactedPreviewText.trim(),
      replacements: preview.replacements,
      signals: preview.signals,
      alerts: preview.alerts
    })
  );
}

export function clearLastIntakePreview(): void {
  localStorage.removeItem(LAST_PREVIEW_KEY);
}

export function getActiveJobId(): string | null {
  const raw = localStorage.getItem(ACTIVE_JOB_KEY);
  if (!raw) {
    return null;
  }

  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function setActiveJobId(jobId: string): void {
  localStorage.setItem(ACTIVE_JOB_KEY, jobId);
}

export function clearActiveJobId(): void {
  localStorage.removeItem(ACTIVE_JOB_KEY);
}

export function draftToIntakePayload(draft: IntakeDraft): IntakeRequestPayload {
  const summaryText = draft.summaryText.trim();
  const providerLabel = draft.providerLabel.trim();

  if (draft.provider === 'chatgpt') {
    return {
      summary_text: summaryText,
      source: 'chatgpt'
    };
  }

  if (draft.provider === 'claude') {
    return {
      summary_text: summaryText,
      source: 'claude'
    };
  }

  return {
    summary_text: summaryText,
    source: 'both',
    provider_label: providerLabel
  };
}
