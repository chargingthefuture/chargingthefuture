import type { PoolClient } from 'pg';
import { SKILL_UP_AUTO_COHORT_ACTOR_ID } from './constants';

// A trainer deleting their account hands their open cohorts back (#2937). Without this the cohort
// kept the deleted account as its trainer: nobody else could claim it (a claim only takes cohorts
// held by the scheduler placeholder), learners could not leave once it started (a set
// assigned_trainer_id reads as somebody teaching), and a released milestone sent the trainer's
// credits to the removed account. Open cohorts go back to the placeholder, so they show as needing a
// trainer, and live enrollments lose the trainer. A completed cohort keeps its record as it was.
// Runs inside the deletion transaction, before the plan deletes the trainer's profile row.
export async function releaseTrainerCohortsForDeletion(client: PoolClient, userId: string): Promise<void> {
  await client.query(
    `UPDATE skill_up_cohorts
        SET created_by_user_id = $2, updated_at = NOW()
      WHERE created_by_user_id = $1 AND status <> 'completed'`,
    [userId, SKILL_UP_AUTO_COHORT_ACTOR_ID],
  );
  await client.query(
    `UPDATE skill_up_enrollments
        SET assigned_trainer_id = NULL, updated_at = NOW()
      WHERE assigned_trainer_id = $1 AND status IN ('enrolled', 'active')`,
    [userId],
  );
}
