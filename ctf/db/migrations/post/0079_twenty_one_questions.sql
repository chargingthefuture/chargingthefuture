-- Safe to re-run.
-- question_answers and question_match_messages: 21 Questions (3.1.0 plan, task 18). A member's
-- answers to the day's questions (the first answer stands), and the messages inside a match card
-- between two members who answered at least three the same. A pair is stored low id first, so one
-- conversation has one key. Account deletion removes a member's answers and every conversation
-- they were in.
CREATE TABLE IF NOT EXISTS question_answers (
  user_id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  choice SMALLINT NOT NULL CHECK (choice >= 0),
  answered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, question_id)
);
ALTER TABLE IF EXISTS question_answers ADD COLUMN IF NOT EXISTS answered_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_question_answers_question ON question_answers(question_id, choice);

CREATE TABLE IF NOT EXISTS question_match_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_low TEXT NOT NULL,
  user_high TEXT NOT NULL,
  sender_user_id TEXT NOT NULL,
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at TIMESTAMPTZ,
  CONSTRAINT question_match_messages_pair_order CHECK (user_low < user_high),
  CONSTRAINT question_match_messages_sender_in_pair CHECK (sender_user_id IN (user_low, user_high))
);
ALTER TABLE IF EXISTS question_match_messages ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_question_match_messages_pair ON question_match_messages(user_low, user_high, created_at);
CREATE INDEX IF NOT EXISTS idx_question_match_messages_high ON question_match_messages(user_high);
