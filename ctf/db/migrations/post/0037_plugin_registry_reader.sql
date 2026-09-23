-- The Reader tile in the apps list.
--
-- The reader itself is a separate service on its own address. What this row adds is the tile and
-- the page behind it, where a member reads what the reader is and what a place on it costs before
-- they meet another address and a sign-in prompt.
--
-- schema.sql carries the same row in its registry seed. An existing database is not re-seeded from
-- that file, so this migration is what makes the tile appear in production.
INSERT INTO ctf_plugin_registry (plugin_slug, display_name, summary, availability_state, nav_rank, is_visible) VALUES
  ('reader', 'Reader', 'A feed reader on a server this project pays for. Sign in with this account; your subscriptions are yours alone and nobody else on it can see them.', 'implemented_shell', 280, TRUE)
ON CONFLICT (plugin_slug) DO UPDATE SET
  display_name       = EXCLUDED.display_name,
  summary            = EXCLUDED.summary,
  availability_state = EXCLUDED.availability_state,
  nav_rank           = EXCLUDED.nav_rank,
  is_visible         = EXCLUDED.is_visible,
  updated_at         = NOW();
