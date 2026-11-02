-- Safe to re-run.
-- schema.sql creates the same table; this file brings an existing database up to date.
-- question_answer_audit: a record of every 21 Questions answer, every attempt to give a different
-- answer to a question already answered (the first answer stands, so the attempt is refused), and
-- every time matching is turned off or on. Read by the owner with
-- scripts/sql/twenty_one_questions_audit.sql, the same way SkillUp's skill log is read: somebody who
-- keeps switching matching on and off, or keeps trying other answers, may be fishing for matches
-- to reach people. Append-only; account deletion removes the member's rows with their answers.
CREATE TABLE IF NOT EXISTS question_answer_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('answered', 'answer_refused', 'matching_off', 'matching_on')),
  question_id TEXT,
  choice SMALLINT,
  -- The answer that stands, on an answer_refused row.
  prior_choice SMALLINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS question_answer_audit ADD COLUMN IF NOT EXISTS question_id TEXT;
ALTER TABLE IF EXISTS question_answer_audit ADD COLUMN IF NOT EXISTS choice SMALLINT;
ALTER TABLE IF EXISTS question_answer_audit ADD COLUMN IF NOT EXISTS prior_choice SMALLINT;
ALTER TABLE IF EXISTS question_answer_audit ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_question_answer_audit_user ON question_answer_audit (user_id, created_at DESC);
