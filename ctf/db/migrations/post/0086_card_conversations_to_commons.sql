-- post/0086: Card conversations move to Commons, one row per plugin item.
--
-- Owner decision, 2026-11-10: nothing in 3.1 stands apart from a plugin. The conversation under a
-- Today card belongs to the plugin behind the card (a ride's to TrustTransport, a place's to
-- LightHouse, and Commons' when there is no other), so Commons holds one store whose rows name the
-- plugin and the item: commons_item_answers, commons_item_messages and commons_item_pair_requests.
-- card_answers, card_messages and card_pair_requests are dropped with their rows, in production and
-- the demo schema; they held only the owner's own test posts, which the owner reposts. Safe to
-- re-run.
CREATE TABLE IF NOT EXISTS commons_item_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plugin TEXT NOT NULL CHECK (plugin ~ '^[a-z][a-z0-9-]{0,39}$'),
  item_id TEXT NOT NULL CHECK (char_length(item_id) BETWEEN 1 AND 200),
  account_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('help', 'know-someone', 'want', 'helped-me')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT commons_item_answers_once UNIQUE (plugin, item_id, account_id, kind)
);
ALTER TABLE IF EXISTS commons_item_answers ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();
ALTER TABLE IF EXISTS commons_item_answers ADD COLUMN IF NOT EXISTS plugin TEXT;
ALTER TABLE IF EXISTS commons_item_answers ADD COLUMN IF NOT EXISTS item_id TEXT;
ALTER TABLE IF EXISTS commons_item_answers ADD COLUMN IF NOT EXISTS account_id TEXT;
ALTER TABLE IF EXISTS commons_item_answers ADD COLUMN IF NOT EXISTS kind TEXT;
ALTER TABLE IF EXISTS commons_item_answers ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_commons_item_answers_item ON commons_item_answers(plugin, item_id, created_at);
CREATE INDEX IF NOT EXISTS idx_commons_item_answers_account ON commons_item_answers(account_id);

CREATE TABLE IF NOT EXISTS commons_item_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plugin TEXT NOT NULL CHECK (plugin ~ '^[a-z][a-z0-9-]{0,39}$'),
  item_id TEXT NOT NULL CHECK (char_length(item_id) BETWEEN 1 AND 200),
  author_id TEXT NOT NULL,
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 1000),
  pair_low TEXT,
  pair_high TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  edited_at TIMESTAMPTZ,
  CONSTRAINT commons_item_messages_pair_both CHECK ((pair_low IS NULL) = (pair_high IS NULL)),
  CONSTRAINT commons_item_messages_pair_order CHECK (pair_low IS NULL OR pair_low < pair_high),
  CONSTRAINT commons_item_messages_author_in_pair CHECK (pair_low IS NULL OR author_id IN (pair_low, pair_high))
);
ALTER TABLE IF EXISTS commons_item_messages ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();
ALTER TABLE IF EXISTS commons_item_messages ADD COLUMN IF NOT EXISTS plugin TEXT;
ALTER TABLE IF EXISTS commons_item_messages ADD COLUMN IF NOT EXISTS item_id TEXT;
ALTER TABLE IF EXISTS commons_item_messages ADD COLUMN IF NOT EXISTS author_id TEXT;
ALTER TABLE IF EXISTS commons_item_messages ADD COLUMN IF NOT EXISTS body TEXT;
ALTER TABLE IF EXISTS commons_item_messages ADD COLUMN IF NOT EXISTS pair_low TEXT;
ALTER TABLE IF EXISTS commons_item_messages ADD COLUMN IF NOT EXISTS pair_high TEXT;
ALTER TABLE IF EXISTS commons_item_messages ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE IF EXISTS commons_item_messages ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_commons_item_messages_item ON commons_item_messages(plugin, item_id, pair_low, pair_high, created_at);
CREATE INDEX IF NOT EXISTS idx_commons_item_messages_author ON commons_item_messages(author_id);
CREATE INDEX IF NOT EXISTS idx_commons_item_messages_pair_high ON commons_item_messages(pair_high) WHERE pair_high IS NOT NULL;

CREATE TABLE IF NOT EXISTS commons_item_pair_requests (
  plugin TEXT NOT NULL CHECK (plugin ~ '^[a-z][a-z0-9-]{0,39}$'),
  item_id TEXT NOT NULL CHECK (char_length(item_id) BETWEEN 1 AND 200),
  user_low TEXT NOT NULL,
  user_high TEXT NOT NULL,
  requester_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  agreed_at TIMESTAMPTZ,
  PRIMARY KEY (plugin, item_id, user_low, user_high),
  CONSTRAINT commons_item_pair_requests_pair_order CHECK (user_low < user_high),
  CONSTRAINT commons_item_pair_requests_requester_in_pair CHECK (requester_id IN (user_low, user_high))
);
ALTER TABLE IF EXISTS commons_item_pair_requests ADD COLUMN IF NOT EXISTS requester_id TEXT;
ALTER TABLE IF EXISTS commons_item_pair_requests ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE IF EXISTS commons_item_pair_requests ADD COLUMN IF NOT EXISTS agreed_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_commons_item_pair_requests_low ON commons_item_pair_requests(user_low);
CREATE INDEX IF NOT EXISTS idx_commons_item_pair_requests_high ON commons_item_pair_requests(user_high);

DROP TABLE IF EXISTS card_answers;
DROP TABLE IF EXISTS card_messages;
DROP TABLE IF EXISTS card_pair_requests;
DROP TABLE IF EXISTS demo.card_answers;
DROP TABLE IF EXISTS demo.card_messages;
DROP TABLE IF EXISTS demo.card_pair_requests;
