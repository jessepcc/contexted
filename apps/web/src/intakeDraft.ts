export type IntakeProvider = 'chatgpt' | 'claude' | 'other';

export type IntakeDraft = {
  summaryText: string;
  provider: IntakeProvider;
  providerLabel: string;
};

type IntakeRequestPayload = {
  summary_text: string;
  source: 'chatgpt' | 'claude' | 'both';
  provider_label?: string;
};

const INTAKE_DRAFT_KEY = 'contexted_intake_draft';
const ACTIVE_JOB_KEY = 'contexted_active_job_id';

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

    if (!provider || !summaryText) {
      return null;
    }

    return {
      summaryText,
      provider,
      providerLabel
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
      providerLabel: draft.providerLabel.trim()
    })
  );
}

export function clearIntakeDraft(): void {
  localStorage.removeItem(INTAKE_DRAFT_KEY);
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
