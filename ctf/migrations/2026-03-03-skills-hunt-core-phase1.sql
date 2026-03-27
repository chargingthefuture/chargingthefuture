BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS skills_hunt_rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'closed', 'archived')),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  scoring_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id TEXT NOT NULL,
  updated_by_user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (ends_at > starts_at)
);

CREATE TABLE IF NOT EXISTS skills_hunt_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id UUID NOT NULL REFERENCES skills_hunt_rounds(id) ON DELETE CASCADE,
  submitter_user_id TEXT NOT NULL,
  submitter_username TEXT NULL,
  display_name TEXT NOT NULL,
  bio TEXT NOT NULL,
  quora_profile_url TEXT NOT NULL,
  quora_profile_url_normalized TEXT NOT NULL,
  skills JSONB NOT NULL DEFAULT '[]'::jsonb,
  claimed_professions JSONB NOT NULL DEFAULT '[]'::jsonb,
  signature_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'flagged')),
  review_action TEXT NULL CHECK (review_action IN ('accept', 'reject', 'edit', 'flag')),
  reviewed_by_user_id TEXT NULL,
  review_notes TEXT NULL,
  score_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
  points_awarded INTEGER NOT NULL DEFAULT 0,
  reviewed_at TIMESTAMPTZ NULL,
  directory_profile_generated_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (round_id, signature_hash)
);

CREATE TABLE IF NOT EXISTS skills_hunt_leaderboard (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id UUID NOT NULL REFERENCES skills_hunt_rounds(id) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK (mode IN ('individual', 'team')),
  rank INTEGER NOT NULL,
  score INTEGER NOT NULL,
  accepted_count INTEGER NOT NULL DEFAULT 0,
  rare_skill_bonus INTEGER NOT NULL DEFAULT 0,
  user_id TEXT NULL,
  username_snapshot TEXT NULL,
  team_key TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (round_id, mode, rank)
);

CREATE TABLE IF NOT EXISTS skills_hunt_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  code TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  awarded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, code)
);

CREATE TABLE IF NOT EXISTS skills_hunt_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  read_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS skills_hunt_feature_reward_card (
  singleton_key BOOLEAN PRIMARY KEY DEFAULT TRUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  cta_label TEXT NOT NULL,
  cta_url TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  updated_by_user_id TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS skills_hunt_rare_skills_lookup (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id UUID NOT NULL REFERENCES skills_hunt_rounds(id) ON DELETE CASCADE,
  skill_name TEXT NOT NULL,
  bonus_points INTEGER NOT NULL DEFAULT 3,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (round_id, skill_name)
);

CREATE TABLE IF NOT EXISTS skills_hunt_directory_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES skills_hunt_submissions(id) ON DELETE CASCADE,
  directory_profile_id TEXT NOT NULL,
  invited_by_username TEXT NOT NULL,
  created_by_user_id TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (submission_id),
  UNIQUE (directory_profile_id)
);

CREATE TABLE IF NOT EXISTS skills_hunt_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id TEXT NOT NULL,
  command TEXT NOT NULL,
  policy_status TEXT NOT NULL CHECK (policy_status IN ('allow', 'deny')),
  reason TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_skills_hunt_rounds_status_window
  ON skills_hunt_rounds (status, starts_at DESC, ends_at DESC);

CREATE INDEX IF NOT EXISTS idx_skills_hunt_submissions_round_status_created
  ON skills_hunt_submissions (round_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_skills_hunt_submissions_submitter_created
  ON skills_hunt_submissions (submitter_user_id, created_at DESC);

ALTER TABLE IF EXISTS skills_hunt_leaderboard
  ADD COLUMN IF NOT EXISTS mode TEXT;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'skills_hunt_leaderboard' AND column_name = 'mode'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_skills_hunt_leaderboard_lookup ON skills_hunt_leaderboard (round_id, mode, rank ASC, score DESC)';
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_skills_hunt_notifications_user_unread
  ON skills_hunt_notifications (user_id, is_read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_skills_hunt_audit_log_lookup
  ON skills_hunt_audit_log (created_at DESC, actor_id, command);

INSERT INTO skills_hunt_feature_reward_card (
  singleton_key,
  title,
  description,
  cta_label,
  cta_url,
  is_active,
  updated_by_user_id
)
VALUES (
  TRUE,
  'Skills Hunt Reward Spotlight',
  'Top contributors unlock community recognition and feature access rewards.',
  'View rewards',
  '/plugin?plugin=skills-hunt',
  TRUE,
  'system-seed'
)
ON CONFLICT (singleton_key)
DO NOTHING;

COMMIT;
