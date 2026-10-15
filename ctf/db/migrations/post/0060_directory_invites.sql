-- post/0060: Invitations to people listed in the Directory, held in the app.
--
-- Why (owner decision, 2026-10-15): each invite post names one listed person as a self-identified
-- Targeted Individual, with their skills and their Directory listing. On the public blog the posts
-- together formed a public list of Targeted Individuals, which is the reason the Directory itself sits
-- behind a sign-in. They are now written in a private repository, whose job pushes each one into the
-- app, and the app shows a signed-out visitor only each person's name and the invite's opening words
-- for a private invite.
--
-- What it does: creates directory_invites (slug and Quora handle, each unique; the Quora address,
-- name, title, opening, the post in Markdown, the date, the Directory profile id when known, and an
-- optional picture with its type and alt text, and whether it is public with its blog address).
-- Invites already published on the blog stay there and are marked public; new ones are private.
-- Indexes the date for the newest-first wall.
--
-- Safe to re-run: IF NOT EXISTS on the table, every column and every index.
BEGIN;
CREATE TABLE IF NOT EXISTS directory_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL,
  quora_handle TEXT NOT NULL,
  quora_url TEXT NOT NULL,
  name TEXT NOT NULL,
  title TEXT NOT NULL,
  opening TEXT NOT NULL,
  body_markdown TEXT NOT NULL,
  published_on DATE NOT NULL,
  directory_profile_id TEXT,
  image BYTEA,
  image_type TEXT,
  image_alt TEXT,
  public BOOLEAN NOT NULL DEFAULT FALSE,
  blog_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS directory_invites ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();
ALTER TABLE IF EXISTS directory_invites ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE IF EXISTS directory_invites ADD COLUMN IF NOT EXISTS quora_handle TEXT;
ALTER TABLE IF EXISTS directory_invites ADD COLUMN IF NOT EXISTS quora_url TEXT;
ALTER TABLE IF EXISTS directory_invites ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE IF EXISTS directory_invites ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE IF EXISTS directory_invites ADD COLUMN IF NOT EXISTS opening TEXT;
ALTER TABLE IF EXISTS directory_invites ADD COLUMN IF NOT EXISTS body_markdown TEXT;
ALTER TABLE IF EXISTS directory_invites ADD COLUMN IF NOT EXISTS published_on DATE;
ALTER TABLE IF EXISTS directory_invites ADD COLUMN IF NOT EXISTS directory_profile_id TEXT;
ALTER TABLE IF EXISTS directory_invites ADD COLUMN IF NOT EXISTS image BYTEA;
ALTER TABLE IF EXISTS directory_invites ADD COLUMN IF NOT EXISTS image_type TEXT;
ALTER TABLE IF EXISTS directory_invites ADD COLUMN IF NOT EXISTS image_alt TEXT;
ALTER TABLE IF EXISTS directory_invites ADD COLUMN IF NOT EXISTS public BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE IF EXISTS directory_invites ADD COLUMN IF NOT EXISTS blog_url TEXT;
ALTER TABLE IF EXISTS directory_invites ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE IF EXISTS directory_invites ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE UNIQUE INDEX IF NOT EXISTS uq_directory_invites_slug ON directory_invites (slug);
CREATE UNIQUE INDEX IF NOT EXISTS uq_directory_invites_quora_handle ON directory_invites (quora_handle);
CREATE INDEX IF NOT EXISTS idx_directory_invites_published ON directory_invites (published_on DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_directory_invites_profile ON directory_invites (directory_profile_id);
COMMIT;
