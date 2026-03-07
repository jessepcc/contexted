import type { ReactElement } from 'react';

export function StepHeader({
  step,
  totalSteps,
  onBack,
}: {
  step: number;
  totalSteps: number;
  onBack: () => void;
}): ReactElement {
  return (
    <div className="flex items-center justify-between px-6 py-4">
      <button
        onClick={onBack}
        type="button"
        className="flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm text-text-primary transition-colors hover:bg-bg-card"
      >
        <span className="text-lg">&lsaquo;</span> Back
      </button>
      <span className="text-xs font-medium text-text-muted">
        Step {step} of {totalSteps}
      </span>
    </div>
  );
}
