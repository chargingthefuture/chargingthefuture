-- Fireside: make the comment bodies searchable.
--
-- Being searchable is one of the four reasons these comments are in Postgres rather than in a chat
-- product, and nothing indexed them — every search would have been a sequential scan of the table,
-- getting slower for the rest of the app as the conversation grew. Cheaper to add before there is
-- volume than after.
--
-- An expression index rather than a stored tsvector column: the body is the only input, the
-- expression is deterministic, and a generated column would have to be kept in step by every write
-- path. `english` is the configuration the search query uses, and the two have to match or the
-- index is not used at all.

CREATE INDEX IF NOT EXISTS fireside_comments_body_search_idx
  ON fireside_comments
  USING GIN (to_tsvector('english', body));
