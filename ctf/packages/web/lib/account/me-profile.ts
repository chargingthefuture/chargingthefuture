import { queryDb } from 'lib/db/postgres';
import { getWeaversBadgeHolders } from 'lib/contributor-access/badge';
import { hasSurveyResponse } from 'lib/quora-deletion-survey/repository';
import { SE_ME_EMPTY_PROMPTS, type SeMeBadge, type SeMeProfile, type SeMePrompts } from '@ctf/shared';

// The top of a member's own 3.1 Me screen: since when they have been here (their first sign-in,
// login_events, as lib/unlock/standing.ts reads it), their badges (System Architect for an admin,
// Weavers of the Commons from Contributor Access), their three profile prompts
// (member_profile_prompts) and whether they answered the Quora census. Every query is scoped to the one account.

type PromptsRow = { can_help_with: string; needs: string; ask_me_about: string };

function mapPrompts(row: PromptsRow | undefined): SeMePrompts {
  if (!row) return { ...SE_ME_EMPTY_PROMPTS };
  return { canHelpWith: row.can_help_with, needs: row.needs, askMeAbout: row.ask_me_about };
}

// `viewer` is the caller's own access decision: its account id, and whether it is an admin.
export async function readMeProfile(viewer: { userId: string; isAdmin: boolean }): Promise<SeMeProfile> {
  const { userId, isAdmin } = viewer;
  const [since, prompts, weavers, censusAdded] = await Promise.all([
    queryDb<{ first_seen: Date | null }>(`SELECT MIN(created_at) AS first_seen FROM login_events WHERE user_id = $1`, [userId]),
    queryDb<PromptsRow>(`SELECT can_help_with, needs, ask_me_about FROM member_profile_prompts WHERE account_id = $1`, [userId]),
    getWeaversBadgeHolders([userId]),
    hasSurveyResponse(userId),
  ]);
  const firstSeen = since.rows[0]?.first_seen;
  const badges: SeMeBadge[] = [];
  if (isAdmin) badges.push('architect');
  if (weavers.has(userId)) badges.push('weaver');
  return { sinceIso: firstSeen ? new Date(firstSeen).toISOString() : null, badges, prompts: mapPrompts(prompts.rows[0]), censusAdded };
}

export async function saveMePrompts(userId: string, prompts: SeMePrompts): Promise<SeMePrompts> {
  const result = await queryDb<PromptsRow>(
    `INSERT INTO member_profile_prompts (account_id, can_help_with, needs, ask_me_about, updated_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (account_id) DO UPDATE SET
       can_help_with = EXCLUDED.can_help_with, needs = EXCLUDED.needs, ask_me_about = EXCLUDED.ask_me_about, updated_at = NOW()
     RETURNING can_help_with, needs, ask_me_about`,
    [userId, prompts.canHelpWith, prompts.needs, prompts.askMeAbout],
  );
  return mapPrompts(result.rows[0]);
}
