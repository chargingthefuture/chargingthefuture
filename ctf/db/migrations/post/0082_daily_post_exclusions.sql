-- admin_daily_post_exclusions: blog posts the owner left out of the rotation (Daily Posts, owner
-- request 2026-11-02). A post here stays on the blog; it leaves the Daily Posts rotation, its theme
-- groups and Today's story cards until it is brought back. Names no member. Safe to re-run.
CREATE TABLE IF NOT EXISTS admin_daily_post_exclusions (
  post_slug TEXT PRIMARY KEY,
  excluded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS admin_daily_post_exclusions ADD COLUMN IF NOT EXISTS excluded_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
