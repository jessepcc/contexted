/**
 * Demo seed data for Contexted showcase.
 *
 * Populates the in-memory repository with a compelling match scenario:
 * two users matched via AI memory, synergy points visible, confessions exchanged,
 * and a warm chat exchange in progress.
 *
 * Usage: imported by dev-server.ts when DEMO_MODE env var is set.
 *   DEMO_MODE=reveal  → pending_confession (shows Reveal page)
 *   DEMO_MODE=chat    → unlocked with messages (shows Chat page)
 */

import type { InMemoryRepository } from './in-memory-repository.js';

const DEMO_USER_ID = '00000000-0000-4000-8000-000000000001';
const PARTNER_ID = '00000000-0000-4000-8000-000000000002';
const MATCH_ID = '00000000-0000-4000-8000-0000000000a1';
const DROP_ID = '00000000-0000-4000-8000-0000000000d1';

const now = new Date();
const iso = (offset = 0) => new Date(now.getTime() + offset).toISOString();
const hours = (h: number) => h * 60 * 60 * 1000;

const SYNERGY_POINTS = [
  'You both navigate big decisions by writing through them — not for an audience, but to hear your own thinking land.',
  'A shared instinct to build before you theorize. Ideas feel real to both of you only after they have shape.',
  'Both drawn to quiet depth over loud connection — the kind of attention that holds still before it moves.',
  'You each carry a tension between independence and intimacy, and you both tend to choose honesty over comfort when it matters.'
];

const CONFESSION_PROMPT =
  "What's one thing you wish people understood about you without having to explain it?";

const MY_CONFESSION =
  "That when I go quiet, it usually means I'm processing something I care about — not pulling away. The silence is where I do my most honest thinking.";

const PARTNER_CONFESSION =
  "I think people read my directness as certainty, but most of the time I'm just trying to skip the part where we pretend. I'd rather be real and wrong than polished and evasive.";

export type DemoMode = 'reveal' | 'chat';

export async function seedDemoData(
  repo: InMemoryRepository,
  mode: DemoMode
): Promise<void> {
  // Users
  await repo.upsertUser({
    id: DEMO_USER_ID,
    email: 'dev@contexted.local',
    status: 'matched',
    createdAt: iso(-hours(48)),
    lastActiveAt: iso()
  });

  await repo.upsertUser({
    id: PARTNER_ID,
    email: 'partner@contexted.local',
    status: 'matched',
    createdAt: iso(-hours(72)),
    lastActiveAt: iso(-hours(1))
  });

  // Profiles
  const embedding = new Array(1536).fill(0.5);

  await repo.upsertProfile({
    userId: DEMO_USER_ID,
    source: 'chatgpt',
    matchText: 'Reflective builder who processes through writing and values depth over performance.',
    sanitizedSummary:
      'You process the world through writing and building. Your AI conversations reveal a pattern of reflective decision-making, a pull toward creative projects with meaning, and a quiet intensity that prefers depth over breadth in both ideas and relationships.',
    embedding,
    embeddingModel: 'text-embedding-3-small',
    piiRiskScore: 0,
    createdAt: iso(-hours(47)),
    updatedAt: iso(-hours(47))
  });

  await repo.upsertProfile({
    userId: PARTNER_ID,
    source: 'claude',
    matchText: 'Direct communicator who builds to understand and values honest connection.',
    sanitizedSummary:
      'Your conversations suggest someone who thinks by doing — ideas become real once they take shape. You value directness and tend toward depth in your connections, often choosing candor over comfort.',
    embedding,
    embeddingModel: 'text-embedding-3-small',
    piiRiskScore: 0,
    createdAt: iso(-hours(70)),
    updatedAt: iso(-hours(70))
  });

  // Drop
  await repo.upsertDrop({
    id: DROP_ID,
    scheduledAt: iso(-hours(2)),
    status: 'published',
    mode: 'standard',
    poolSize: 24,
    startedAt: iso(-hours(2)),
    finishedAt: iso(-hours(2)),
    createdAt: iso(-hours(24))
  });

  if (mode === 'reveal') {
    // pending_confession — user hasn't answered yet, partner hasn't either
    await repo.upsertMatch({
      id: MATCH_ID,
      dropId: DROP_ID,
      userAId: DEMO_USER_ID,
      userBId: PARTNER_ID,
      status: 'pending_confession',
      synergyPoints: SYNERGY_POINTS,
      confessionPrompt: CONFESSION_PROMPT,
      responseDeadline: iso(hours(22)),
      expiresAt: iso(hours(46)),
      version: 0,
      createdAt: iso(-hours(1))
    });
  } else {
    // unlocked — both confessed, chat open with messages
    await repo.upsertMatch({
      id: MATCH_ID,
      dropId: DROP_ID,
      userAId: DEMO_USER_ID,
      userBId: PARTNER_ID,
      status: 'unlocked',
      synergyPoints: SYNERGY_POINTS,
      confessionPrompt: CONFESSION_PROMPT,
      userAConfession: MY_CONFESSION,
      userBConfession: PARTNER_CONFESSION,
      responseDeadline: iso(-hours(1)),
      unlockedAt: iso(-hours(1)),
      expiresAt: iso(hours(23)),
      version: 2,
      createdAt: iso(-hours(2))
    });

    // Chat messages — a warm, curious exchange
    const msgs = [
      {
        senderId: DEMO_USER_ID,
        body: "Reading your note, I felt that. The directness thing — I think that's what made the system flag us as similar.",
        offset: -50
      },
      {
        senderId: PARTNER_ID,
        body: "Ha, maybe. I think it's less about directness and more about not wanting to waste the window on small talk. This is 24 hours. I'd rather know what's real.",
        offset: -47
      },
      {
        senderId: DEMO_USER_ID,
        body: "Okay, real: the synergy point about writing through decisions — do you actually do that? Because I have like 40 docs that are just me arguing with myself.",
        offset: -42
      },
      {
        senderId: PARTNER_ID,
        body: "Same. Except mine are voice memos at 2am that I re-listen to while making coffee. It's embarrassing how much clarity comes from just hearing your own confusion out loud.",
        offset: -38
      },
      {
        senderId: DEMO_USER_ID,
        body: "That's beautiful honestly. The \"hearing your own confusion\" part. I think that's what my AI conversations became — a way to hear myself think without performing for anyone.",
        offset: -32
      },
      {
        senderId: PARTNER_ID,
        body: "Exactly. And now here we are, matched because of the patterns in those conversations. There's something poetic about that. Or unsettling. Maybe both.",
        offset: -25
      }
    ];

    for (let i = 0; i < msgs.length; i++) {
      const m = msgs[i];
      await repo.createMessage({
        id: `00000000-0000-4000-8000-00000000m${String(i + 1).padStart(3, '0')}`,
        matchId: MATCH_ID,
        senderId: m.senderId,
        clientMessageId: `demo-msg-${i + 1}`,
        body: m.body,
        createdAt: iso(m.offset * 60 * 1000),
        expiresAt: iso(hours(23))
      });
    }
  }

  console.log(`[demo] seeded ${mode} scenario for dev@contexted.local`);
}
