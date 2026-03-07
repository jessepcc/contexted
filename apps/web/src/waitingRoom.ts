import type { BootstrapResponse } from './types.js';

type WaitingTone = 'neutral' | 'accent' | 'positive' | 'negative';

export type WaitingRoomContent = {
  statusLabel: string;
  title: string;
  body: string;
  pills: string[];
  facts: string[];
  statusTitle: string;
  statusBody: string;
  tone: WaitingTone;
};

const BASELINE_FACTS = [
  'We process matches in deliberate batches, not a live swipe feed.',
  'If this batch misses you, your place carries into the next one automatically.',
  'Your memory stays the center of gravity — not a profile photo carousel.'
] as const;

function formatDropDay(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  }).format(new Date(iso));
}

function formatDropMoment(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(new Date(iso));
}

function formatPoolSize(poolSize: number | null): string | null {
  if (poolSize === null) {
    return null;
  }

  return `${poolSize.toLocaleString()} ${poolSize === 1 ? 'person' : 'people'} in this batch.`;
}

function withReason(prefix: string, reason: string | null): string {
  if (!reason) {
    return prefix;
  }

  const cleaned = reason.trim().replace(/[. ]+$/u, '');
  return `${prefix} ${cleaned}.`;
}

export function getWaitingRoomContent(drop: BootstrapResponse['drop']): WaitingRoomContent {
  if (!drop) {
    return {
      statusLabel: 'No drop scheduled',
      title: 'You’re in the waiting room',
      body: 'We do not have a live batch to point at yet. Your place is held, and this page gets more specific the second the next drop is real.',
      pills: ['Place in line held.', 'Email when it’s ready.'],
      facts: [...BASELINE_FACTS],
      statusTitle: 'Nothing is actively running yet.',
      statusBody: 'This is the honest idle state: no fake countdown, no invented urgency, just your spot held for the next real batch.',
      tone: 'neutral'
    };
  }

  const when = formatDropMoment(drop.scheduled_at);
  const day = formatDropDay(drop.scheduled_at);
  const poolPill = formatPoolSize(drop.pool_size);

  switch (drop.status) {
    case 'scheduled':
      return {
        statusLabel: 'Scheduled',
        title: `Next drop: ${day}`,
        body: `The next batch is scheduled for ${when}. Until then, we keep the queue warm and your place intact.`,
        pills: [poolPill ?? 'Queue still forming.', 'We’ll email when it unlocks.'],
        facts: [
          'Preferences still gate who we consider for this drop.',
          'We keep intake open until the batch locks.',
          'Missing one batch does not kick you out of line.'
        ],
        statusTitle: 'Scheduled, not spinning yet.',
        statusBody: 'There is a real drop on the calendar. Matching has not started.',
        tone: 'accent'
      };
    case 'ingest_closed':
      return {
        statusLabel: 'Intake closed',
        title: 'This batch just locked',
        body: `The current drop is frozen for intake. We’re cleaning the pool before matching starts for ${when}.`,
        pills: [poolPill ?? 'Pool locked for this run.', 'No need to rejoin.'],
        facts: [
          'New memory submissions wait for the following drop, not this one.',
          'We sanity-check the pool before any pairing happens.',
          'Your place stays intact while the batch gets finalized.'
        ],
        statusTitle: 'We’ve stopped taking new entries for this batch.',
        statusBody: 'Now the system shifts from collecting entries to preparing the actual match run.',
        tone: 'accent'
      };
    case 'matching':
      return {
        statusLabel: 'Matching live',
        title: 'We’re pairing this batch now',
        body: 'The matching run is live. This is the part where we compare recurring themes, tone, and how you think with AI.',
        pills: [poolPill ?? 'Matcher is running.', 'No swiping, no scramble.'],
        facts: [
          'This is a batch run, not a first-come race.',
          'We compare patterns in memory, not profile polish.',
          'If you’re not in this one, you roll forward automatically.'
        ],
        statusTitle: 'The current batch is actively being paired.',
        statusBody: 'The system is actively comparing memories right now — this is no longer a generic waiting screen.',
        tone: 'accent'
      };
    case 'content_ready':
      return {
        statusLabel: 'Preparing reveals',
        title: 'Pairs are set. Reveal notes are next.',
        body: 'The matches are chosen. We’re generating the overlap notes and opening prompt before anything goes out.',
        pills: [poolPill ?? 'Pairs already chosen.', 'Final copy in progress.'],
        facts: [
          'Pairing is done for this batch.',
          'We generate the human-readable reveal after the match itself is set.',
          'Nothing gets published until the package is ready.'
        ],
        statusTitle: 'Matching is done; reveal notes are being written.',
        statusBody: 'This is the finishing-work state between “we found a pair” and “you can unlock it.”',
        tone: 'accent'
      };
    case 'published':
    case 'notified':
      return {
        statusLabel: 'Drop is live',
        title: 'This drop is landing now',
        body: 'Reveals are going out for this batch. If you’re not in it, you roll forward automatically — no re-entry ritual required.',
        pills: [poolPill ?? 'Current batch is going out.', 'Your place persists either way.'],
        facts: [
          'Some pairs are unlocking their reveal right now.',
          'Missing this round does not reset your queue position.',
          'We email as soon as you have something actionable.'
        ],
        statusTitle: 'The current batch is out in the world.',
        statusBody: 'This is the honest “it shipped, but not necessarily to you” state.',
        tone: 'positive'
      };
    case 'paused':
      return {
        statusLabel: 'Paused',
        title: 'We paused this batch',
        body: withReason(
          'Something looked off, so we paused the run instead of faking certainty. Your place is still held.',
          drop.failure_reason
        ),
        pills: [poolPill ?? 'Manual review in progress.', 'Your place stays held.'],
        facts: [
          'We would rather pause than ship a strange match.',
          'A human is checking the pipeline before we move again.',
          'You do not need to resubmit your memory or rejoin the queue.'
        ],
        statusTitle: 'Manual review beats a weird match.',
        statusBody: withReason('Current note:', drop.failure_reason),
        tone: 'negative'
      };
    case 'failed':
      return {
        statusLabel: 'Failed',
        title: 'This batch missed',
        body: withReason(
          'The run failed on our side. We won’t dress it up. Your place is still held while we reset.',
          drop.failure_reason
        ),
        pills: [poolPill ?? 'Batch failed on our side.', 'Queue remains intact.'],
        facts: [
          'Something failed on our side, and we won’t hide it behind a polite spinner.',
          'We keep the queue intact instead of pretending nothing happened.',
          'You do not need to resubmit anything to stay in line.'
        ],
        statusTitle: 'This drop failed on our side.',
        statusBody: withReason('Current note:', drop.failure_reason),
        tone: 'negative'
      };
    case 'closed':
    default:
      return {
        statusLabel: 'Between drops',
        title: 'That batch wrapped',
        body: 'The last drop is closed, and the next one has not been published yet. Your place stays warm in the meantime.',
        pills: ['Waiting for the next real batch.', 'Queue position preserved.'],
        facts: [...BASELINE_FACTS],
        statusTitle: 'We’re between live drops.',
        statusBody: 'No active run, no fake urgency — just a held place until the next schedule lands.',
        tone: 'neutral'
      };
  }
}
