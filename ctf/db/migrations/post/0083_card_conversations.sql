-- Safe to re-run.
-- card_answers, card_messages and card_pair_requests: card conversations (3.1, the board "a card
-- opened in place"). One store for every Today card of kind ask, offer or story, keyed by the card
-- id (`<source>:<id>`, e.g. `trust-transport:123`), so the cards from every feature work the same.
-- An answer is one member saying "can help", "knows someone", "would like this" or "this helped"
-- on a card, once per kind. A message is public (pair_low and pair_high empty) or belongs to "Just
-- us two", a private conversation between exactly two members on one card (the pair stored lower
-- id first), which opens only after the second member agrees to the request. Account deletion
-- removes a member's answers, the messages they wrote, and every Just us two conversation and
-- request they were part of.
CREATE TABLE IF NOT EXISTS card_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id TEXT NOT NULL CHECK (char_length(card_id) BETWEEN 3 AND 200),
  account_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('help', 'know-someone', 'want', 'helped-me')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT card_answers_once UNIQUE (card_id, account_id, kind)
);
ALTER TABLE IF EXISTS card_answers ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();
ALTER TABLE IF EXISTS card_answers ADD COLUMN IF NOT EXISTS card_id TEXT;
ALTER TABLE IF EXISTS card_answers ADD COLUMN IF NOT EXISTS account_id TEXT;
ALTER TABLE IF EXISTS card_answers ADD COLUMN IF NOT EXISTS kind TEXT;
ALTER TABLE IF EXISTS card_answers ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_card_answers_card ON card_answers(card_id, created_at);
CREATE INDEX IF NOT EXISTS idx_card_answers_account ON card_answers(account_id);

CREATE TABLE IF NOT EXISTS card_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id TEXT NOT NULL CHECK (char_length(card_id) BETWEEN 3 AND 200),
  author_id TEXT NOT NULL,
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 1000),
  pair_low TEXT,
  pair_high TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT card_messages_pair_both CHECK ((pair_low IS NULL) = (pair_high IS NULL)),
  CONSTRAINT card_messages_pair_order CHECK (pair_low IS NULL OR pair_low < pair_high),
  CONSTRAINT card_messages_author_in_pair CHECK (pair_low IS NULL OR author_id IN (pair_low, pair_high))
);
ALTER TABLE IF EXISTS card_messages ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();
ALTER TABLE IF EXISTS card_messages ADD COLUMN IF NOT EXISTS card_id TEXT;
ALTER TABLE IF EXISTS card_messages ADD COLUMN IF NOT EXISTS author_id TEXT;
ALTER TABLE IF EXISTS card_messages ADD COLUMN IF NOT EXISTS body TEXT;
ALTER TABLE IF EXISTS card_messages ADD COLUMN IF NOT EXISTS pair_low TEXT;
ALTER TABLE IF EXISTS card_messages ADD COLUMN IF NOT EXISTS pair_high TEXT;
ALTER TABLE IF EXISTS card_messages ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_card_messages_card ON card_messages(card_id, pair_low, pair_high, created_at);
CREATE INDEX IF NOT EXISTS idx_card_messages_author ON card_messages(author_id);
CREATE INDEX IF NOT EXISTS idx_card_messages_pair_high ON card_messages(pair_high) WHERE pair_high IS NOT NULL;

CREATE TABLE IF NOT EXISTS card_pair_requests (
  card_id TEXT NOT NULL CHECK (char_length(card_id) BETWEEN 3 AND 200),
  user_low TEXT NOT NULL,
  user_high TEXT NOT NULL,
  requester_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  agreed_at TIMESTAMPTZ,
  PRIMARY KEY (card_id, user_low, user_high),
  CONSTRAINT card_pair_requests_pair_order CHECK (user_low < user_high),
  CONSTRAINT card_pair_requests_requester_in_pair CHECK (requester_id IN (user_low, user_high))
);
ALTER TABLE IF EXISTS card_pair_requests ADD COLUMN IF NOT EXISTS requester_id TEXT;
ALTER TABLE IF EXISTS card_pair_requests ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE IF EXISTS card_pair_requests ADD COLUMN IF NOT EXISTS agreed_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_card_pair_requests_low ON card_pair_requests(user_low);
CREATE INDEX IF NOT EXISTS idx_card_pair_requests_high ON card_pair_requests(user_high);
