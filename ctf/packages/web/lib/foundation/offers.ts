import { queryDb } from 'lib/db/postgres';

// Members offering their time through Foundation, newest first, for the "Offer · hours" cards on
// Today. An offer is the same thing Foundation search lists as a provider: a claimed Directory
// profile whose owner chose at least one skill to be contacted for. It is dated by the newest skill
// they added. Only what Foundation search shows a member: the profile id, the owner, the headline,
// their short line and the skill names. A provider blocked either way relative to the viewer is left
// out, as in search.

export type FoundationHoursOffer = {
  profileId: string;
  providerUserId: string;
  headline: string | null;
  shortDescription: string | null;
  skillNames: string[];
  offeredAtIso: string;
};

type Row = {
  profile_id: string;
  provider_user_id: string;
  headline: string | null;
  short_description: string | null;
  skill_names: string[] | null;
  offered_at: Date;
};

// `filter` and `tail` use $2: the row limit for the list, the profile id for the single read.
const offersSql = (filter: string, tail: string) => `
  SELECT dp.id::text AS profile_id,
         dp.claimed_by_user_id AS provider_user_id,
         dp.headline,
         fue.short_description,
         offer.skill_names,
         offer.offered_at
    FROM directory_profiles dp
    JOIN LATERAL (
      SELECT array_agg(s.name ORDER BY s.name) AS skill_names, MAX(fps.created_at) AS offered_at
        FROM foundation_provider_skills fps
        JOIN skills_taxonomy_skills s ON s.id = fps.skill_id
       WHERE fps.user_id = dp.claimed_by_user_id
    ) offer ON offer.offered_at IS NOT NULL
    LEFT JOIN foundation_user_extension fue ON fue.user_id = dp.claimed_by_user_id
   WHERE dp.claimed_by_user_id IS NOT NULL
     AND ($1::text IS NULL OR dp.claimed_by_user_id <> $1)
     AND (
       $1::text IS NULL
       OR NOT EXISTS (
         SELECT 1 FROM member_blocks
          WHERE (blocker_user_id = $1 AND blocked_user_id = dp.claimed_by_user_id)
             OR (blocker_user_id = dp.claimed_by_user_id AND blocked_user_id = $1)
       )
     )
     ${filter}
   ${tail}`;

function toOffer(row: Row): FoundationHoursOffer {
  return {
    profileId: row.profile_id,
    providerUserId: row.provider_user_id,
    headline: row.headline,
    shortDescription: row.short_description,
    skillNames: row.skill_names ?? [],
    offeredAtIso: new Date(row.offered_at).toISOString(),
  };
}

// `viewerUserId` leaves the viewer's own offer out and hides providers blocked either way; empty for
// a signed-out read.
export async function listHoursOffers(input: { limit: number; viewerUserId: string }): Promise<FoundationHoursOffer[]> {
  const viewer = input.viewerUserId.trim() || null;
  const result = await queryDb<Row>(offersSql('', 'ORDER BY offer.offered_at DESC LIMIT $2'), [viewer, input.limit]);
  return result.rows.map(toOffer);
}

// One offer by Directory profile id, for the card's own close and renew reads; null when the profile
// no longer offers any skill.
export async function getHoursOffer(profileId: string): Promise<FoundationHoursOffer | null> {
  const result = await queryDb<Row>(offersSql('AND dp.id::text = $2', ''), [null, profileId]);
  const row = result.rows[0];
  return row ? toOffer(row) : null;
}
