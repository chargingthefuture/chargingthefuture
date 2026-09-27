import { queryDb } from 'lib/db/postgres';

// The one @comic setting an admin can change from the app: whether an answer to an Unlock question
// from a member not yet approved is sent without review (comic_runtime_config).
//
// Owner decision, 2026-09-26: yes, because volume is low and the assistant cannot approve anybody, so
// the worst case is a wrong instruction rather than a wrong approval. The decision is meant to be
// reversible on the evidence in the Unlock help log, so the switch lives next to that log
// (/admin/comic/unlock-help). Turning it off puts those answers back in the review queue with a draft
// already attached; nothing else changes. Every other @comic answer is held for review either way —
// see forceHumanReview() in policy.ts.

// The owner's decision, used when no row has been written yet.
export const UNLOCK_HELP_WITHOUT_REVIEW_DEFAULT = true;

export type UnlockHelpReviewSetting = {
  withoutReview: boolean;
  updatedByUserId: string | null;
  updatedAtIso: string | null;
};

type ConfigRow = {
  unlock_help_without_review: boolean;
  updated_by_user_id: string | null;
  updated_at: Date | string;
};

export async function getUnlockHelpReviewSetting(): Promise<UnlockHelpReviewSetting> {
  const result = await queryDb<ConfigRow>(
    `SELECT unlock_help_without_review, updated_by_user_id, updated_at FROM comic_runtime_config WHERE singleton_id LIMIT 1`,
  );
  const row = result.rows[0];
  if (!row) {
    return { withoutReview: UNLOCK_HELP_WITHOUT_REVIEW_DEFAULT, updatedByUserId: null, updatedAtIso: null };
  }
  return {
    withoutReview: row.unlock_help_without_review,
    updatedByUserId: row.updated_by_user_id,
    updatedAtIso: new Date(row.updated_at).toISOString(),
  };
}

// Read on the message path. If the setting cannot be read, the answer is held for review: a read
// failure must never be what sends an unreviewed answer.
export async function isUnlockHelpSentWithoutReview(): Promise<boolean> {
  try {
    return (await getUnlockHelpReviewSetting()).withoutReview;
  } catch (error) {
    console.error('[comic/runtime-config] could not read the Unlock help setting; holding for review', error);
    return false;
  }
}

export async function setUnlockHelpSentWithoutReview(actorId: string, withoutReview: boolean): Promise<UnlockHelpReviewSetting> {
  await queryDb(
    `INSERT INTO comic_runtime_config (singleton_id, unlock_help_without_review, updated_by_user_id, updated_at)
     VALUES (TRUE, $1, $2, NOW())
     ON CONFLICT (singleton_id) DO UPDATE
       SET unlock_help_without_review = EXCLUDED.unlock_help_without_review,
           updated_by_user_id = EXCLUDED.updated_by_user_id,
           updated_at = NOW()`,
    [withoutReview, actorId],
  );
  return getUnlockHelpReviewSetting();
}
