export const SKILLS_HUNT_DEFAULT_PAGE = 1;
export const SKILLS_HUNT_DEFAULT_PAGE_SIZE = 20;
export const SKILLS_HUNT_MAX_PAGE_SIZE = 100;

export const SKILLS_HUNT_MAX_ROUND_NAME_LENGTH = 120;
export const SKILLS_HUNT_MAX_ROUND_DESCRIPTION_LENGTH = 1200;
// Submission field limits aligned with locked owner spec (2026-05-11). See
// ctf-skills-hunt-session-continuity.md §3.2 for prior drift history.
export const SKILLS_HUNT_MIN_FULL_NAME_LENGTH = 2;
export const SKILLS_HUNT_MAX_FULL_NAME_LENGTH = 100;
export const SKILLS_HUNT_FULL_NAME_PATTERN = /^[A-Za-z0-9 ]+$/;
export const SKILLS_HUNT_MAX_BIO_LENGTH = 280;
export const SKILLS_HUNT_MAX_URL_LENGTH = 512;
export const SKILLS_HUNT_MAX_REVIEW_NOTES_LENGTH = 1000;
// Nominee location (city / state or region / country). Country is required at submit time; state/city
// optional. Capped at 100 to match the directory_profiles location columns (varchar(100) on cloned
// data) these carry into on accept.
export const SKILLS_HUNT_MAX_LOCATION_LENGTH = 100;
// Taxonomy-first skills field: user picks N chips from skills_taxonomy_skills
// and may type up to M free-text proposed skills (each ≤ 40 chars). Both go
// into the same submission record but live in different columns.
export const SKILLS_HUNT_MAX_SKILLS_PER_SUBMISSION = 10;
export const SKILLS_HUNT_MAX_PROPOSED_SKILLS_PER_SUBMISSION = 10;
export const SKILLS_HUNT_MAX_SKILL_LABEL_LENGTH = 40;
// Taxonomy-picked skills carry the canonical taxonomy name, which may be longer than the
// short free-text cap above (the taxonomy allows up to 120 chars). Validate picked skills
// against this larger bound so a legitimate long skill name does not fail the submission.
export const SKILLS_HUNT_MAX_TAXONOMY_SKILL_LABEL_LENGTH = 120;

export const SKILLS_HUNT_REJECTION_GUARD_SAMPLE_SIZE = 10;
export const SKILLS_HUNT_REJECTION_GUARD_THRESHOLD = 0.8;

// Reputation tiers. Read by resolveReputationTier() in repository.ts to set a
// scout's rolling 7-day submission limit and whether they need pre-approval.
export const SKILLS_HUNT_REPUTATION = {
  newUserSubmissionLimit7d: 3,
  trustedUserSubmissionLimit7d: 10,
  preApprovalRejectionRateThreshold: 0.2,
  trustedAcceptanceRateThreshold: 0.8,
  preApprovalMinSampleSize: 5,
  trustedMinSampleSize: 5,
} as const;

// URL liveness check (HEAD only; no body fetched — Quora ToS compliance).
export const SKILLS_HUNT_URL_VALIDATION_TIMEOUT_MS = 5_000;

// Scoring weights aligned with locked owner spec (2026-05-11). Read by
// scoreSubmission() merged with per-round scoring_config overrides.
export const SKILLS_HUNT_SCORE_WEIGHTS_SPEC = {
  matchBase: 10,
  firstMatchBonus: 5,
  rareSkillBonus: 7,
  qualityBonus: 2,
  participationOnReject: 1,
} as const;

// Auto-opened missions from Workforce sector gaps (owner decision 2026-08-27). The generator in
// lib/skills-hunt/auto-missions.ts stamps this sentinel as the creating actor so generated
// missions are distinguishable from admin-authored ones. Defaults apply until an admin writes the
// skills_hunt_auto_mission_config singleton row.
export const SKILLS_HUNT_AUTO_MISSION_ACTOR_ID = 'skills-hunt-auto-mission-scheduler';
export const SKILLS_HUNT_AUTO_MISSION_DEFAULTS = {
  enabled: true,
  minGapThreshold: 25,
  maxPerRound: 3,
  defaultGoalTarget: 3,
  defaultBonusPoints: 0,
} as const;

// Rare-skill snapshot cap. The live Workforce model marks nearly every occupation under-recruited
// while the member base is small (demand comes from the population model), so the round-create
// snapshot keeps only the occupations with the largest gaps to preserve "rare" meaning something.
export const SKILLS_HUNT_RARE_SKILL_SNAPSHOT_LIMIT = 25;

export const SKILLS_HUNT_ERROR_CODE = {
  invalidPayload: 'SKILLS_HUNT_INVALID_PAYLOAD',
  persistenceUnavailable: 'SKILLS_HUNT_PERSISTENCE_UNAVAILABLE',
  csrfDenied: 'SKILLS_HUNT_CSRF_DENIED',
  roundNotFound: 'SKILLS_HUNT_ROUND_NOT_FOUND',
  roundNotActive: 'SKILLS_HUNT_ROUND_NOT_ACTIVE',
  duplicateSubmission: 'SKILLS_HUNT_DUPLICATE_SUBMISSION',
  submissionLimitExceeded: 'SKILLS_HUNT_SUBMISSION_LIMIT_EXCEEDED',
  rejectionGuardViolation: 'SKILLS_HUNT_REJECTION_GUARD_VIOLATION',
  submissionNotFound: 'SKILLS_HUNT_SUBMISSION_NOT_FOUND',
  invalidReviewAction: 'SKILLS_HUNT_INVALID_REVIEW_ACTION',
  profileAlreadyGenerated: 'SKILLS_HUNT_PROFILE_ALREADY_GENERATED',
  urlValidationFailed: 'SKILLS_HUNT_URL_VALIDATION_FAILED',
  reservedUsername: 'SKILLS_HUNT_RESERVED_USERNAME',
  preApprovalRequired: 'SKILLS_HUNT_PRE_APPROVAL_REQUIRED',
} as const;
