-- Fireside: threads, comments, reactions and audit. Safe to re-run; every object is IF NOT EXISTS.

-- ============================================================================
-- Fireside — threaded conversation on published blog posts (owner decision, 2026-09-13)
-- ----------------------------------------------------------------------------
-- One thread per blog post, comments under it, reactions on those comments.
--
-- Reading is public and needs no account. Writing needs a signed-in member, and nothing a member
-- writes is publicly visible until they are approved in Unlock — the same route-into-verification
-- the Knowledge Library contribution exception already runs on. Approval is per person, not per
-- comment: when somebody is approved, everything they have written becomes visible at once.
--
-- Deliberately separate from Commons. Commons is support and learning the app; Fireside is
-- conversation about trafficking and rebuilding, which needs its own moderation posture even
-- though an admin works both from one panel.
-- ============================================================================
CREATE TABLE IF NOT EXISTS fireside_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The blog post this thread belongs to, as the wiki-site article address: the repo namespace and
  -- the slug, matching the front matter that mints the URL. Stored rather than derived so a thread
  -- survives a post being renamed in the registry.
  post_repo TEXT NOT NULL,
  post_slug TEXT NOT NULL,
  post_title TEXT NOT NULL DEFAULT '',
  -- An admin can close a thread to new comments without removing what is already there.
  is_closed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS fireside_threads ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE IF EXISTS fireside_threads ADD COLUMN IF NOT EXISTS post_repo TEXT;
ALTER TABLE IF EXISTS fireside_threads ADD COLUMN IF NOT EXISTS post_slug TEXT;
ALTER TABLE IF EXISTS fireside_threads ADD COLUMN IF NOT EXISTS post_title TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS fireside_threads ADD COLUMN IF NOT EXISTS is_closed BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE IF EXISTS fireside_threads ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE IF EXISTS fireside_threads ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE UNIQUE INDEX IF NOT EXISTS fireside_threads_post_key ON fireside_threads (post_repo, post_slug);

CREATE TABLE IF NOT EXISTS fireside_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES fireside_threads(id) ON DELETE CASCADE,
  -- Threading is one level deep on purpose: a reply to a comment, and no reply to a reply. Deeper
  -- nesting is unreadable at phone width, which is the only width this app has.
  parent_comment_id UUID REFERENCES fireside_comments(id) ON DELETE CASCADE,
  author_user_id TEXT NOT NULL,
  -- The name printed beside the comment, written at creation the way other tables here denormalize
  -- an author_username. Stored rather than joined: the public read must not touch an identity table
  -- at all, and a later rename should not rewrite what an old comment was signed with.
  author_username TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL,
  -- Moderation state, which is separate from whether the author is approved. A comment is publicly
  -- visible only when BOTH hold: status 'visible', and the author approved in Unlock. Keeping them
  -- apart means approving a person does not un-remove something an admin took down.
  status TEXT NOT NULL DEFAULT 'visible' CHECK (status IN ('visible','removed','withdrawn')),
  removed_by TEXT,
  removed_at TIMESTAMPTZ,
  removal_reason TEXT,
  -- Whether the author chose to let this comment be copied into the blog's own published build,
  -- where it becomes searchable and is captured by the Internet Archive. Off by default: the words
  -- are the author's, permanence is their call, and a capture cannot be withdrawn later.
  export_to_blog BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS fireside_comments ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE IF EXISTS fireside_comments ADD COLUMN IF NOT EXISTS thread_id UUID;
ALTER TABLE IF EXISTS fireside_comments ADD COLUMN IF NOT EXISTS parent_comment_id UUID;
ALTER TABLE IF EXISTS fireside_comments ADD COLUMN IF NOT EXISTS author_user_id TEXT;
ALTER TABLE IF EXISTS fireside_comments ADD COLUMN IF NOT EXISTS author_username TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS fireside_comments ADD COLUMN IF NOT EXISTS body TEXT;
ALTER TABLE IF EXISTS fireside_comments ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'visible';
ALTER TABLE IF EXISTS fireside_comments ADD COLUMN IF NOT EXISTS removed_by TEXT;
ALTER TABLE IF EXISTS fireside_comments ADD COLUMN IF NOT EXISTS removed_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS fireside_comments ADD COLUMN IF NOT EXISTS removal_reason TEXT;
ALTER TABLE IF EXISTS fireside_comments ADD COLUMN IF NOT EXISTS export_to_blog BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE IF EXISTS fireside_comments ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE IF EXISTS fireside_comments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS fireside_comments_thread_idx ON fireside_comments (thread_id, created_at);
CREATE INDEX IF NOT EXISTS fireside_comments_author_idx ON fireside_comments (author_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS fireside_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES fireside_comments(id) ON DELETE CASCADE,
  reactor_user_id TEXT NOT NULL,
  -- A short fixed set rather than free emoji, so the counts mean the same thing on every comment.
  kind TEXT NOT NULL CHECK (kind IN ('recognize','helpful','same_here')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS fireside_reactions ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE IF EXISTS fireside_reactions ADD COLUMN IF NOT EXISTS comment_id UUID;
ALTER TABLE IF EXISTS fireside_reactions ADD COLUMN IF NOT EXISTS reactor_user_id TEXT;
ALTER TABLE IF EXISTS fireside_reactions ADD COLUMN IF NOT EXISTS kind TEXT;
ALTER TABLE IF EXISTS fireside_reactions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE UNIQUE INDEX IF NOT EXISTS fireside_reactions_one_per_person ON fireside_reactions (comment_id, reactor_user_id, kind);

CREATE TABLE IF NOT EXISTS fireside_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id TEXT NOT NULL,
  command TEXT NOT NULL,
  policy_status TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  target_type TEXT NOT NULL DEFAULT '',
  target_id TEXT NOT NULL DEFAULT '',
  result TEXT NOT NULL DEFAULT '',
  error_category TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS fireside_audit_events ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE IF EXISTS fireside_audit_events ADD COLUMN IF NOT EXISTS actor_id TEXT;
ALTER TABLE IF EXISTS fireside_audit_events ADD COLUMN IF NOT EXISTS command TEXT;
ALTER TABLE IF EXISTS fireside_audit_events ADD COLUMN IF NOT EXISTS policy_status TEXT;
ALTER TABLE IF EXISTS fireside_audit_events ADD COLUMN IF NOT EXISTS reason TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS fireside_audit_events ADD COLUMN IF NOT EXISTS target_type TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS fireside_audit_events ADD COLUMN IF NOT EXISTS target_id TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS fireside_audit_events ADD COLUMN IF NOT EXISTS result TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS fireside_audit_events ADD COLUMN IF NOT EXISTS error_category TEXT;
ALTER TABLE IF EXISTS fireside_audit_events ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE IF EXISTS fireside_audit_events ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS fireside_audit_events_created_idx ON fireside_audit_events (created_at DESC);
