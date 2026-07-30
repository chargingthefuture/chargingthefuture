import type { PoolClient } from 'pg';
import { FEED_COMMONS_GUIDANCE_INTERVAL } from 'lib/feed/constants';

// The automatic Commons guidance notice — published as an announcement every Nth community post
// (owner decision, 2026-07-30), so a newcomer meets the rule without anyone having to say it to them
// personally, and a regular is reminded without being singled out.
//
// The wording carries a decision the owner made explicitly, and it should not be "tidied" later by
// someone who misses the point:
//
//   The public rule is TOPIC, not character. Content is removed for repeatedly being off topic — never
//   for who somebody is suspected of being. That is deliberately the gentler framing, and it is also
//   the only one that is safe: an accusation posted to a whole community is unretractable, and being
//   wrong about it lands on a survivor.
//
//   The stated reason underneath it is not softened, because it is the point: an open chat room with no
//   subject is where traffickers hide. They blend into general conversation and use it to find people.
//   Keeping the Commons to its purpose is what makes that hard, and there is no tolerance for them
//   here. The notice says that plainly while accusing nobody in particular.
//
// Weavers of the Commons post without restriction. That is the incentive doing the work the rule
// cannot: the way out of the topic limit is to contribute, not to argue.

export const COMMONS_GUIDANCE_TITLE = 'What the Commons is for';

export const COMMONS_GUIDANCE_BODY = [
  'This app is a working economy. Survivors list real skills, trade them with each other, and build a',
  'record of that work that holds up outside here. The Commons is where it gets arranged — asking for',
  'a skill, offering one, sorting out an exchange.',
  '',
  'It is not a general discussion board. Conversations with nothing to do with the economy are removed',
  'if they keep happening. This is not about tone, and it is not about disagreement — post something',
  'unpopular about the work and it stays.',
  '',
  'The reason, said plainly: an open room with no subject is where traffickers hide. They blend into',
  'general conversation and use it to find people. Keeping the Commons to what it is for is what makes',
  'that hard to do. There is no tolerance for it here.',
  '',
  'Weavers of the Commons post without restriction. It is earned by contributing, and once you have it,',
  'none of the above applies to you.',
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
