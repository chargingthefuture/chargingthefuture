import { SE_STORY_REPLIES_VISITORS_VERSION, SE_STORY_REPLIES_VISITORS_VERSIONS, type SeStoryRepliesVisitorsState } from '@ctf/shared';
import { queryDb } from 'lib/db/postgres';

// A member's agreement that visitors without an account may read what they write in the conversation
// on members' stories (owner decision, 2026-11-16), kept on user_ui_preferences with the version of
// the words and when they agreed. Turning it off clears both. Turning it on again starts a new time,
// so nothing written while it was off is shown.

export async function readStoryRepliesVisitors(userId: string): Promise<SeStoryRepliesVisitorsState> {
  const result = await queryDb<{ version: string | null; agreed_at: Date | null }>(
    `SELECT story_replies_visitors_version AS version, story_replies_visitors_at AS agreed_at
       FROM user_ui_preferences WHERE user_id = $1 LIMIT 1`,
    [userId],
  );
  const row = result.rows[0];
  return { agreed: Boolean(row?.agreed_at) && SE_STORY_REPLIES_VISITORS_VERSIONS.includes(row?.version ?? '') };
}

// On keeps the time already recorded for the current words; anything else starts from now.
export async function setStoryRepliesVisitors(userId: string, agreed: boolean): Promise<void> {
  await queryDb(
    `INSERT INTO user_ui_preferences (user_id, story_replies_visitors_version, story_replies_visitors_at, updated_at)
     VALUES ($1, CASE WHEN $2 THEN $3 END, CASE WHEN $2 THEN NOW() END, NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       story_replies_visitors_version = CASE WHEN $2 THEN $3 END,
       story_replies_visitors_at = CASE
         WHEN NOT $2 THEN NULL
         WHEN user_ui_preferences.story_replies_visitors_version = $3 AND user_ui_preferences.story_replies_visitors_at IS NOT NULL
           THEN user_ui_preferences.story_replies_visitors_at
         ELSE NOW() END,
       updated_at = NOW()`,
    [userId, agreed, SE_STORY_REPLIES_VISITORS_VERSION],
  );
}
