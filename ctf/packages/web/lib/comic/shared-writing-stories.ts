import { SE_MEMBER_STORY_CONSENT_VERSION, type SeMemberStory } from '@ctf/shared';
import { queryDb } from 'lib/db/postgres';

// Members' own writing as Today stories (3.1.0 plan). Nothing new is stored: a story is a row the
// Knowledge Library already holds (comic_knowledge_entries) once a person has read and accepted the
// contribution it came from. Three things must all hold for it to show, and each has an owner:
//   1. the writer chose it, for that contribution (story_consent_at, set and cleared here);
//   2. a reviewer accepted the contribution, and the row is still on (the existing review; a
//      withdrawal switches the rows off and so takes the story off Today too);
//   3. the writer's Unlock is approved, checked when Today is built (lib/today/sources-member.ts),
//      because nothing an unapproved member writes is shown to others.

// Turn the Today choice on or off for one of the member's own contributions. Scoped to the caller in
// the query, so somebody else's id reads the same as one that does not exist. A withdrawn or declined
// contribution cannot be turned on: it has nothing left to show.
export async function setSharedWritingStory(userId: string, contributionId: string, show: boolean): Promise<boolean> {
  const result = await queryDb(
    `UPDATE comic_contributions
     SET story_consent_version = CASE WHEN $3 THEN $4 ELSE NULL END,
         story_consent_at = CASE WHEN $3 THEN NOW() ELSE NULL END,
         updated_at = NOW()
     WHERE id = $1::uuid AND user_id = $2 AND ($3 = FALSE OR status IN ('pending_review', 'accepted'))`,
    [contributionId, userId, show, SE_MEMBER_STORY_CONSENT_VERSION],
  );
  return (result.rowCount ?? 0) > 0;
}

export type MemberStoryRow = SeMemberStory & { userId: string };

type Row = {
  id: string;
  user_id: string;
  question: string | null;
  content: string;
  reviewed_at: Date | null;
  created_at: Date;
};

const TITLE_MAX = 90;

// A Quora answer keeps its question as the title; a post or comment takes its opening words.
export function memberStoryTitle(question: string | null, content: string): string {
  const source = (question ?? '').trim() || content.replace(/\s+/g, ' ').trim();
  if (source.length <= TITLE_MAX) return source;
  const cut = source.slice(0, TITLE_MAX);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), TITLE_MAX - 20)).trimEnd()}…`;
}

// Every accepted, still-on entry whose writer chose Today, oldest acceptance first. The writer's
// Unlock standing is not read here; the caller filters on it.
export async function listMemberStoryRows(): Promise<MemberStoryRow[]> {
  const result = await queryDb<Row>(
    `SELECT k.id, c.user_id, k.question, k.content, c.reviewed_at, k.created_at
     FROM comic_knowledge_entries k
     JOIN comic_contributions c ON c.id = k.contribution_id
     WHERE c.status = 'accepted' AND c.story_consent_at IS NOT NULL AND k.active = TRUE
     ORDER BY c.reviewed_at ASC NULLS LAST, k.created_at ASC, k.id ASC
     LIMIT 2000`,
  );
  return result.rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    title: memberStoryTitle(row.question, row.content),
    text: row.content,
    acceptedAtIso: new Date(row.reviewed_at ?? row.created_at).toISOString(),
  }));
}
