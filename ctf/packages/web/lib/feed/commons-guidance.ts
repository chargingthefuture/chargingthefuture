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
//   WHY IT IS OPEN. The design reason is that the owner takes no direct messages — her inbox was used to
//   harass her, and open posting removes that channel. The FINAL COPY states only the benefit (answered
//   once where the next person finds it, never waiting on the owner alone) and no longer explains the
//   harassment history; the owner cut that line on 2026-07-30. Keep it cut: the rule stands on the
//   benefit, and the notice does not owe a whole community an account of what was done to her.
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
//   TONE IS A PITCH, NOT A TELLING-OFF (owner, 2026-07-30). The message was right and the delivery read
//   as annoyed. It now leads with what makes this different from Quora — there you write into a void,
//   here you ask and someone answers — and the rules follow as consequences of that promise rather than
//   as complaints. Same content, same firmness on the exclusion; a newcomer should finish it wanting to
//   join, not braced for a warning.
//
//   THE WEAVER PERK IS THE PRIVATE ROOM, NOT THE COMMONS. An earlier draft said Weavers of the Commons
//   "post without restriction", which was false: the topic rule applies to the Commons for everyone. What
//   a Weaver earns is the private Weavers group chat room, where none of it applies. Do not restore that
//   wording — it promised members something the app does not do, which is worse than any tone problem.

export const COMMONS_GUIDANCE_TITLE = 'What the Commons is for';

export const COMMONS_GUIDANCE_BODY = [
  'On Quora you write into a void. You post, and maybe nobody comes. Here you ask, and someone answers —',
  'me, or another member when I am away. We span every timezone, so somebody is usually awake. That is',
  'the difference, and it is the point of the Commons.',
  '',
  'Ask in the open. It works better than it sounds. A public question gets answered once where the next',
  'person can find it, instead of sitting in one private thread — so you are never waiting on me alone to',
  'answer.',
  '',
  'You can say what is happening to you. Being targeted is why we are here, and nobody is asking you to',
  'keep it quiet. What we do differently is finish the thought: say what is going on and what you need,',
  'and someone helps with that part. A story with a question in it gets you somewhere. That is the only',
  'difference we are asking for.',
  '',
  'The work itself lives in the apps. Skills, trades, housing, rides, calls — each has its own place, and',
  'those are what build the economy and get counted. The Commons is how you find your way to them.',
  '',
  'Threads that never get to a question do come down, if they keep going. Not for tone, not for',
  'disagreement, and not for who anybody is. Keeping this a place with a purpose is also what keeps it',
  'safe: an open room about nothing is where traffickers go to blend in and harass Targets. They are not',
  'allowed here — not tolerated less, not allowed.',
  '',
  'Contribute for a while and you become a Weaver of the Commons, which comes with a private group chat',
  'room where none of this applies and you can talk about whatever you like.',
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
