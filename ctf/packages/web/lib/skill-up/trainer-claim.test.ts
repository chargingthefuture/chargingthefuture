import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SKILL_UP_AUTO_COHORT_ACTOR_ID } from 'lib/skill-up/constants';

// claimCohortAsTrainer is a sequence of single statements, so these tests answer each statement by
// its SQL rather than running a database. `claimRowCount` is what the ownership UPDATE reports.
const executed: string[] = [];
let claimRowCount = 1;

vi.mock('lib/db/postgres', () => ({
  queryDb: vi.fn(async (sql: string) => {
    executed.push(sql);
    if (sql.includes('SELECT created_by_user_id, status FROM skill_up_cohorts')) {
      return { rows: [{ created_by_user_id: SKILL_UP_AUTO_COHORT_ACTOR_ID, status: 'open' }], rowCount: 1 };
    }
    if (sql.includes('SELECT job_title_id::text AS job_title_id')) {
      return { rows: [{ job_title_id: '00000000-0000-0000-0000-000000000001' }], rowCount: 1 };
    }
    if (sql.includes('FROM directory_profiles WHERE claimed_by_user_id')) {
      return { rows: [{ id: '00000000-0000-0000-0000-000000000002' }], rowCount: 1 };
    }
    if (sql.includes('FROM directory_profile_skills')) {
      return { rows: [{ skill_id: '00000000-0000-0000-0000-000000000003' }], rowCount: 1 };
    }
    if (sql.includes('UPDATE skill_up_cohorts')) {
      return { rows: [], rowCount: claimRowCount };
    }
    return { rows: [], rowCount: 0 };
  }),
}));

const insertSkillUpAudit = vi.fn(async () => undefined);
vi.mock('lib/skill-up/repository', () => ({ insertSkillUpAudit }));

const { claimCohortAsTrainer } = await import('lib/skill-up/trainer-claim');

const input = { cohortId: '00000000-0000-0000-0000-0000000000aa', trainerUserId: 'user_trainer' };

describe('claimCohortAsTrainer', () => {
  beforeEach(() => {
    executed.length = 0;
    insertSkillUpAudit.mockClear();
  });

  it('claims, backfills and audits when the ownership update lands', async () => {
    claimRowCount = 1;
    await expect(claimCohortAsTrainer(input)).resolves.toEqual({ status: 'claimed', cohortId: input.cohortId });
    expect(executed.some((sql) => sql.includes('UPDATE skill_up_enrollments'))).toBe(true);
    expect(insertSkillUpAudit).toHaveBeenCalledTimes(1);
  });

  // Two eligible people claiming at once both pass the ownership read; only the first UPDATE
  // matches. The second must not be told it is the trainer or be audited as one.
  it('answers already_claimed, with no backfill and no audit, when the update changed nothing', async () => {
    claimRowCount = 0;
    await expect(claimCohortAsTrainer(input)).resolves.toEqual({ status: 'already_claimed' });
    expect(executed.some((sql) => sql.includes('UPDATE skill_up_enrollments'))).toBe(false);
    expect(insertSkillUpAudit).not.toHaveBeenCalled();
  });
});
