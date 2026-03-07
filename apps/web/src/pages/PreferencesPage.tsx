import { useNavigate } from '@tanstack/react-router';
import type { ReactElement } from 'react';
import { useCallback, useState } from 'react';
import { motion } from 'motion/react';
import { apiRequest, HttpError } from '../api.js';
import { Button } from '../components/Button.js';
import { PageShell } from '../components/PageShell.js';
import { RadioPill } from '../components/RadioPill.js';
import { StepHeader } from '../components/StepHeader.js';
import { useReducedMotion, staggerItem } from '../hooks/useDelight.js';
import { clearIntakeDraft, draftToIntakePayload, loadIntakeDraft, setActiveJobId } from '../intakeDraft.js';

type IntakeSummaryResponse = {
  state: string;
  job_id: string;
  ingestion_id: string;
};

export function PreferencesPage(): ReactElement {
  const navigate = useNavigate();
  const reduced = useReducedMotion();
  const [genderIdentity, setGenderIdentity] = useState<'M' | 'F' | 'NB'>('M');
  const [attractedTo, setAttractedTo] = useState<Set<string>>(new Set(['F']));
  const [ageMin, setAgeMin] = useState(22);
  const [ageMax, setAgeMax] = useState(35);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ageRangeInvalid = ageMin > ageMax;

  const toggleAttracted = useCallback((value: string) => {
    setAttractedTo((prev) => {
      const next = new Set(prev);
      if (next.has(value)) {
        if (next.size > 1) next.delete(value);
      } else {
        next.add(value);
      }
      return next;
    });
  }, []);

  const onSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (ageMin > ageMax) {
        setError('Choose an age range where the minimum is lower than the maximum.');
        return;
      }
      setBusy(true);
      setError(null);

      try {
        await apiRequest('/v1/preferences', {
          method: 'POST',
          body: JSON.stringify({
            gender_identity: genderIdentity,
            attracted_to: [...attractedTo],
            age_min: ageMin,
            age_max: ageMax
          })
        });

        const draft = loadIntakeDraft();
        if (!draft) {
          throw new Error('Missing memory text. Please reopen the memory step on the landing page.');
        }

        const intake = await apiRequest<IntakeSummaryResponse>('/v1/intake/summary', {
          method: 'POST',
          body: JSON.stringify(draftToIntakePayload(draft))
        });

        setActiveJobId(intake.job_id);
        clearIntakeDraft();
        navigate({ to: '/app/processing', search: { jobId: intake.job_id } });
      } catch (reason) {
        setError(
          reason instanceof HttpError
            ? reason.payload.message
            : reason instanceof Error
              ? reason.message
              : 'Failed to save preferences.'
        );
      } finally {
        setBusy(false);
      }
    },
    [ageMax, ageMin, attractedTo, genderIdentity, navigate]
  );

  const allGenders = attractedTo.has('M') && attractedTo.has('F') && attractedTo.has('NB');

  return (
    <PageShell blobs="preferences">
      <StepHeader step={2} totalSteps={3} onBack={() => navigate({ to: '/' })} />

      <form
        className="flex flex-col gap-8 px-6 pt-6 pb-10"
        onSubmit={onSubmit}
        aria-describedby={error ? 'preferences-error' : undefined}
      >
        {/* Title */}
        <motion.div
          className="flex flex-col gap-2"
          {...(reduced ? {} : staggerItem(0))}
        >
          <h1 className="font-heading text-[28px] font-bold tracking-tight text-text-primary">
            A little context around who should feel nearby
          </h1>
          <p className="text-sm text-text-secondary leading-relaxed">
            Just enough to place your memory near the right orbit in the next alpha drop.
          </p>
        </motion.div>

        {/* I Identify As */}
        <motion.fieldset
          className="flex flex-col gap-3"
          {...(reduced ? {} : staggerItem(1))}
        >
          <legend className="text-[12px] font-bold tracking-[0.18em] text-text-muted">
            YOU MOVE THROUGH THE WORLD AS
          </legend>
          <div className="flex flex-wrap gap-3" role="radiogroup" aria-label="Gender identity">
            <RadioPill
              label="Man"
              selected={genderIdentity === 'M'}
              onClick={() => setGenderIdentity('M')}
              role="radio"
              aria-checked={genderIdentity === 'M'}
            />
            <RadioPill
              label="Woman"
              selected={genderIdentity === 'F'}
              onClick={() => setGenderIdentity('F')}
              role="radio"
              aria-checked={genderIdentity === 'F'}
            />
            <RadioPill
              label="Non-binary"
              selected={genderIdentity === 'NB'}
              onClick={() => setGenderIdentity('NB')}
              role="radio"
              aria-checked={genderIdentity === 'NB'}
            />
          </div>
        </motion.fieldset>

        {/* Interested In */}
        <motion.fieldset
          className="flex flex-col gap-3"
          {...(reduced ? {} : staggerItem(2))}
        >
          <legend className="text-[12px] font-bold tracking-[0.18em] text-text-muted">
            ASK US TO LOOK TOWARD
          </legend>
          <div className="flex flex-wrap gap-3" role="group" aria-label="Interested in">
            <RadioPill
              label="Men"
              selected={attractedTo.has('M')}
              onClick={() => toggleAttracted('M')}
              aria-pressed={attractedTo.has('M')}
            />
            <RadioPill
              label="Women"
              selected={attractedTo.has('F')}
              onClick={() => toggleAttracted('F')}
              aria-pressed={attractedTo.has('F')}
            />
            <RadioPill
              label="Non-binary"
              selected={attractedTo.has('NB')}
              onClick={() => toggleAttracted('NB')}
              aria-pressed={attractedTo.has('NB')}
            />
            <RadioPill
              label="Everyone"
              selected={allGenders}
              onClick={() => setAttractedTo(new Set(['M', 'F', 'NB']))}
              aria-pressed={allGenders}
            />
          </div>
        </motion.fieldset>

        {/* Age Range */}
        <motion.fieldset
          className="flex flex-col gap-3"
          {...(reduced ? {} : staggerItem(3))}
        >
          <legend className="text-[12px] font-bold tracking-[0.18em] text-text-muted">
            AGE WINDOW
          </legend>
          <div className="grid max-w-sm grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-end">
            <label className="flex flex-col gap-2 text-sm font-medium text-text-primary" htmlFor="age-min">
              Minimum age
              <input
                id="age-min"
                type="number"
                min={18}
                max={99}
                value={ageMin}
                aria-invalid={ageRangeInvalid}
                aria-describedby={error ? 'preferences-error' : undefined}
                onChange={(e) => setAgeMin(Number.parseInt(e.target.value, 10) || 18)}
                className="min-h-12 w-full rounded-lg border border-border-default bg-bg-card px-4 text-center font-heading text-lg font-bold text-text-primary focus:border-accent focus:outline-none"
              />
            </label>
            <span className="hidden pb-3 text-sm text-text-muted sm:block">to</span>
            <label className="flex flex-col gap-2 text-sm font-medium text-text-primary" htmlFor="age-max">
              Maximum age
              <input
                id="age-max"
                type="number"
                min={18}
                max={99}
                value={ageMax}
                aria-invalid={ageRangeInvalid}
                aria-describedby={error ? 'preferences-error' : undefined}
                onChange={(e) => setAgeMax(Number.parseInt(e.target.value, 10) || 40)}
                className="min-h-12 w-full rounded-lg border border-border-default bg-bg-card px-4 text-center font-heading text-lg font-bold text-text-primary focus:border-accent focus:outline-none"
              />
            </label>
          </div>
        </motion.fieldset>

        {/* Submit */}
        <motion.div {...(reduced ? {} : staggerItem(4))}>
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? 'Saving...' : 'Join the next drop'}
          </Button>
        </motion.div>

        {/* Error */}
        {error ? (
          <p id="preferences-error" role="alert" className="text-center text-sm text-negative">
            {error}
          </p>
        ) : null}
      </form>
    </PageShell>
  );
}
