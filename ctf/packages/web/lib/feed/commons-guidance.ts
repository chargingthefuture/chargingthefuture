import type { PoolClient } from 'pg';
import { FEED_COMMONS_GUIDANCE_INTERVAL } from 'lib/feed/constants';

// The automatic Commons guidance notice — published as an announcement every Nth community post
// (owner decision, 2026-07-30), so a newcomer meets the rule without anyone having to say it to them
// personally, and a regular is reminded without being singled out.
//
// Every paragraph below is load-bearing and was corrected by the owner. Do not "tidy" it:
//
//   WHAT THE COMMONS IS. A support channel — ask in the open, get an answer. It is NOT where exchanges
//   are arranged or recorded. Skills, trades, housing, rides and calls each live in their own plugin,
//   and those are what count toward the economy. An earlier draft said trades get "sorted out" here;
//   that was wrong and would have taught members to do their business in a public thread instead of in
//   the app that actually records it.
//
//   WHY IT IS OPEN. The owner takes no direct messages: her inbox was used to harass her. Open posting
//   removes that channel, and it means a question is answered once where the next person finds it, by
//   whichever member is awake — the community spans every timezone.
//
//   IT MUST NOT FRIGHTEN OFF REAL SURVIVORS. This is the constraint that shapes the tone. "No
//   storytelling" read alone tells a newly targeted person their experience is unwelcome, which is the
//   opposite of true. So the notice says outright that you can describe what is happening to you, and
//   draws the line at the retelling that goes nowhere and asks for nothing. The contrast with Quora is
//   the selling point, not a complaint: there you narrate into a void, here you ask and someone answers.
//   The Commons is a first filter, nothing heavier.
//
//   THE PUBLIC RULE IS TOPIC, NOT CHARACTER. Content is removed for repeatedly going nowhere — never
//   for who somebody is suspected of being. An accusation posted to a whole community cannot be
//   retracted, and being wrong about it lands on a survivor.
//
//   THE EXCLUSION IS STATED AS FACT, NOT FEELING. Traffickers are "not allowed", not "not tolerated".
//   The owner was explicit: these people kill with impunity, and no wording here should imply they are
//   merely unwelcome. Volume of off-topic chatter is not the problem being solved, and a perpetrator's
//   feelings are not a consideration.
//
// Weavers of the Commons post without restriction. That is the incentive doing the work the rule
// cannot: the way out of the topic limit is to contribute, not to argue.

export const COMMONS_GUIDANCE_TITLE = 'What the Commons is for';

export const COMMONS_GUIDANCE_BODY = [
  'The Commons is a support channel. Ask in the open and get an answer — from me, or from another',
  'member when I am not around. This community spans every timezone, so someone is usually awake.',
  '',
  'It is open on purpose. I do not take direct messages; my inbox was used to harass me and I am not',
  'running that again. In the open, that does not work. Your question also gets answered once, where',
  'the next person can find it, instead of me repeating myself in twenty private threads.',
  '',
  'If you are new and being targeted: you can say what is happening to you. Nobody is asking you to',
  'keep it to yourself. What this is not is the endless retelling — the story with no question in it,',
  'going nowhere, helping no one. Here you ask for something and someone answers. Quora does not offer',
  'that in the slightest. It is most of the reason this exists.',
  '',
  'This is also not where the work is recorded. Skills, trades, housing, rides, calls — each has its',
  'own app, and those are what count toward the economy. The Commons points you to them; it does not',
  'replace them.',
  '',
  'Threads that never come back to any of that are removed if they keep happening. Not for tone, and',
  'not for disagreement. The plain reason: an open room with no subject is where traffickers hide.',
  'They blend into general talk and use it to find people. They are not allowed here. Not tolerated',
  'less — not allowed.',
  '',
  'Weavers of the Commons post without restriction. It is earned by contributing.',
].join('\n');

// Should the notice go out now? True only when this post lands exactly on a multiple of the interval,
// so it appears once per milestone rather than for every post past a threshold.
//
// `postCount` is the total number of community posts AFTER the one just created.
export function isGuidanceMilestone(postCount: number): boolean {
  if (!Number.isInteger(postCount) || postCount <= 0) {
    return false;
  }
  return postCount % FEED_COMMONS_GUIDANCE_INTERVAL === 0;
}

// Claim a milestone. Returns true only for the caller that won it.
//
// The UNIQUE constraint on `milestone_count` is the whole concurrency story: two members posting at
// the same moment can both compute the same count, and both will try to claim it, but exactly one
// insert survives `ON CONFLICT DO NOTHING`. The loser skips silently rather than publishing a second
// copy of the same notice.
export async function claimGuidanceMilestone(client: PoolClient, milestoneCount: number): Promise<boolean> {
  const claimed = await client.query(
    `
      INSERT INTO feed_commons_guidance_milestones (milestone_count)
      VALUES ($1)
      ON CONFLICT (milestone_count) DO NOTHING
      RETURNING id
    `,
    [milestoneCount],
  );
  return claimed.rows.length > 0;
}

// Record which announcement a claimed milestone produced, for the audit trail and so an admin can find
// the notice that was posted. Best-effort: the claim already prevents a duplicate, so failing to stamp
// the id must not undo a notice that is already live.
export async function stampGuidanceAnnouncement(
  client: PoolClient,
  milestoneCount: number,
  announcementId: string,
): Promise<void> {
  await client.query(
    'UPDATE feed_commons_guidance_milestones SET announcement_id = $2::uuid WHERE milestone_count = $1',
    [milestoneCount, announcementId],
  );
}
