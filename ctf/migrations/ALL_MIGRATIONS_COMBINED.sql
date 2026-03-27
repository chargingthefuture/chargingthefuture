-- GENERATED: ALL_MIGRATIONS_COMBINED.sql - concatenated on 2026-03-27T00:35:14Z

-- ==== FILE: 2026-03-01-chyme-core-phase0.sql ====
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS chyme_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_key TEXT NOT NULL UNIQUE,
  room_name TEXT NOT NULL,
  call_active BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE IF EXISTS chyme_rooms
  ADD COLUMN IF NOT EXISTS room_key TEXT,
  ADD COLUMN IF NOT EXISTS room_name TEXT,
  ADD COLUMN IF NOT EXISTS call_active BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE UNIQUE INDEX IF NOT EXISTS uq_chyme_rooms_room_key ON chyme_rooms(room_key);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'chyme_rooms'
      AND column_name = 'name'
  ) THEN
    EXECUTE 'ALTER TABLE chyme_rooms ALTER COLUMN name SET DEFAULT ''Chyme Main Room''';
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS chyme_service_profiles (
  user_id TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('active', 'deleted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL
);

ALTER TABLE IF EXISTS chyme_service_profiles
  ADD COLUMN IF NOT EXISTS status TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;

CREATE TABLE IF NOT EXISTS chyme_room_members (
  room_id TEXT NOT NULL REFERENCES chyme_rooms(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  username TEXT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT NULL,
  role TEXT NOT NULL CHECK (role IN ('speaker', 'listener')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (room_id, user_id)
);

ALTER TABLE IF EXISTS chyme_room_members
  ADD COLUMN IF NOT EXISTS username TEXT NULL,
  ADD COLUMN IF NOT EXISTS display_name TEXT NULL,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT NULL,
  ADD COLUMN IF NOT EXISTS role TEXT NULL,
  ADD COLUMN IF NOT EXISTS joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_chyme_room_members_room_id ON chyme_room_members(room_id);
CREATE INDEX IF NOT EXISTS idx_chyme_room_members_user_id ON chyme_room_members(user_id);

CREATE TABLE IF NOT EXISTS chyme_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id TEXT NOT NULL REFERENCES chyme_rooms(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  username TEXT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT NULL,
  text TEXT NOT NULL CHECK (char_length(text) BETWEEN 1 AND 1000),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE IF EXISTS chyme_messages
  ADD COLUMN IF NOT EXISTS username TEXT NULL,
  ADD COLUMN IF NOT EXISTS display_name TEXT NULL,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT NULL,
  ADD COLUMN IF NOT EXISTS text TEXT NULL,
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_chyme_messages_room_sent_at ON chyme_messages(room_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_chyme_messages_user_id ON chyme_messages(user_id);

CREATE TABLE IF NOT EXISTS chyme_deletion_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  scope TEXT NOT NULL CHECK (scope IN ('service', 'account')),
  service_name TEXT NOT NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL CHECK (status IN ('requested', 'processing', 'completed', 'failed')),
  metadata JSONB NULL DEFAULT '{}'::jsonb
);

ALTER TABLE IF EXISTS chyme_deletion_events
  ADD COLUMN IF NOT EXISTS service_name TEXT NULL,
  ADD COLUMN IF NOT EXISTS requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS status TEXT NULL,
  ADD COLUMN IF NOT EXISTS metadata JSONB NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_chyme_deletion_events_user_scope ON chyme_deletion_events(user_id, scope, requested_at DESC);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'chyme_rooms'
      AND column_name = 'room_key'
  ) AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'chyme_rooms'
      AND column_name = 'room_name'
  ) THEN
    BEGIN
      INSERT INTO chyme_rooms (room_key, room_name, call_active)
      VALUES ('chyme-main-room', 'Chyme Main Room', FALSE)
      ON CONFLICT (room_key) DO UPDATE
      SET room_name = EXCLUDED.room_name,
          updated_at = NOW();
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;
END
$$;

COMMIT;

-- ==== FILE: 2026-03-01-clerk-username-handle-baseline.sql ====
-- Migration: Clerk username handle baseline propagation
-- Date: 2026-03-01
-- Scope: Shared DB used by platform + ctf (additive, idempotent)
-- Notes:
--   - Safe to re-run.
--   - Uses guarded DDL for existing columns/indexes/constraints.

-- 1) Canonical username handle column on users
ALTER TABLE IF EXISTS public.users
  ADD COLUMN IF NOT EXISTS username VARCHAR(64);

-- 2) Guardrail: disallow whitespace-only usernames when present
DO $$
BEGIN
  IF to_regclass('public.users') IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'users'
         AND column_name = 'username'
     )
     AND NOT EXISTS (
       SELECT 1
       FROM pg_constraint c
       JOIN pg_class t ON t.oid = c.conrelid
       JOIN pg_namespace n ON n.oid = t.relnamespace
       WHERE n.nspname = 'public'
         AND t.relname = 'users'
         AND c.conname = 'users_username_not_blank_chk'
     )
  THEN
    EXECUTE $sql$
      ALTER TABLE public.users
      ADD CONSTRAINT users_username_not_blank_chk
      CHECK (username IS NULL OR btrim(username) <> '')
    $sql$;
  END IF;
END
$$;

-- 3) Case-insensitive uniqueness for non-null, non-blank usernames
DO $$
BEGIN
  IF to_regclass('public.users') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM pg_class i
       JOIN pg_namespace n ON n.oid = i.relnamespace
       WHERE n.nspname = 'public'
         AND i.relname = 'idx_users_username_ci_unique'
     )
  THEN
    EXECUTE $sql$
      CREATE UNIQUE INDEX idx_users_username_ci_unique
      ON public.users (lower(username))
      WHERE username IS NOT NULL AND btrim(username) <> ''
    $sql$;
  END IF;
END
$$;

-- 4) Fast direct username lookup index
DO $$
BEGIN
  IF to_regclass('public.users') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM pg_class i
       JOIN pg_namespace n ON n.oid = i.relnamespace
       WHERE n.nspname = 'public'
         AND i.relname = 'idx_users_username_lookup'
     )
  THEN
    EXECUTE $sql$
      CREATE INDEX idx_users_username_lookup
      ON public.users (username)
      WHERE username IS NOT NULL AND btrim(username) <> ''
    $sql$;
  END IF;
END
$$;

-- 5) Chyme username snapshots (only when tables are present)
ALTER TABLE IF EXISTS public.chyme_room_members
  ADD COLUMN IF NOT EXISTS username VARCHAR(64);

ALTER TABLE IF EXISTS public.chyme_messages
  ADD COLUMN IF NOT EXISTS author_username VARCHAR(64);

-- 6) Snapshot lookup indexes where appropriate
DO $$
BEGIN
  IF to_regclass('public.chyme_room_members') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM pg_class i
       JOIN pg_namespace n ON n.oid = i.relnamespace
       WHERE n.nspname = 'public'
         AND i.relname = 'idx_chyme_room_members_username_ci'
     )
  THEN
    EXECUTE $sql$
      CREATE INDEX idx_chyme_room_members_username_ci
      ON public.chyme_room_members (lower(username))
      WHERE username IS NOT NULL AND btrim(username) <> ''
    $sql$;
  END IF;
END
$$;

DO $$
BEGIN
  IF to_regclass('public.chyme_messages') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM pg_class i
       JOIN pg_namespace n ON n.oid = i.relnamespace
       WHERE n.nspname = 'public'
         AND i.relname = 'idx_chyme_messages_author_username_ci'
     )
  THEN
    EXECUTE $sql$
      CREATE INDEX idx_chyme_messages_author_username_ci
      ON public.chyme_messages (lower(author_username))
      WHERE author_username IS NOT NULL AND btrim(author_username) <> ''
    $sql$;
  END IF;
END
$$;

-- ==== FILE: 2026-03-02-directory-core-phase0.sql ====
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS directory_user_extension (
  user_id TEXT PRIMARY KEY,
  profile_visibility TEXT NOT NULL DEFAULT 'workspace' CHECK (profile_visibility IN ('private', 'workspace', 'public')),
  contact_preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  service_deleted_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS directory_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claimed_by_user_id TEXT NULL,
  display_name TEXT NOT NULL,
  headline TEXT NULL,
  bio TEXT NULL,
  profile_url TEXT NULL,
  is_public BOOLEAN NOT NULL DEFAULT FALSE,
  sector_id UUID NULL,
  job_title_id UUID NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE IF EXISTS directory_profiles
  ADD COLUMN IF NOT EXISTS claimed_by_user_id TEXT NULL,
  ADD COLUMN IF NOT EXISTS display_name TEXT NULL,
  ADD COLUMN IF NOT EXISTS headline TEXT NULL,
  ADD COLUMN IF NOT EXISTS bio TEXT NULL,
  ADD COLUMN IF NOT EXISTS profile_url TEXT NULL,
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS sector_id UUID NULL,
  ADD COLUMN IF NOT EXISTS job_title_id UUID NULL,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS directory_profile_skills (
  profile_id TEXT NOT NULL,
  skill_id UUID NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (profile_id, skill_id)
);

ALTER TABLE IF EXISTS directory_profile_skills
  ADD COLUMN IF NOT EXISTS profile_id TEXT,
  ADD COLUMN IF NOT EXISTS skill_id UUID,
  ADD COLUMN IF NOT EXISTS display_order INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS directory_profile_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id TEXT NOT NULL,
  tag_kind TEXT NOT NULL,
  tag_value TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE IF EXISTS directory_profile_tags
  ADD COLUMN IF NOT EXISTS profile_id TEXT,
  ADD COLUMN IF NOT EXISTS tag_kind TEXT,
  ADD COLUMN IF NOT EXISTS tag_value TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS directory_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NULL,
  created_by_user_id TEXT NOT NULL,
  updated_by_user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE IF EXISTS directory_announcements
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS body TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS created_by_user_id TEXT,
  ADD COLUMN IF NOT EXISTS updated_by_user_id TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS directory_profile_change_events (
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

CREATE TABLE IF NOT EXISTS directory_deletion_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  scope TEXT NOT NULL CHECK (scope IN ('service', 'account')),
  plugin_id TEXT NOT NULL DEFAULT 'directory',
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ NULL,
  result TEXT NOT NULL CHECK (result IN ('requested', 'processing', 'completed', 'failed')),
  request_id TEXT NULL,
  trace_id TEXT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_directory_profiles_claimed_user
  ON directory_profiles (claimed_by_user_id)
  WHERE claimed_by_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_directory_profiles_visibility
  ON directory_profiles (is_active, is_public, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_directory_profiles_selectors
  ON directory_profiles (sector_id, job_title_id, is_active, is_public);

CREATE INDEX IF NOT EXISTS idx_directory_profile_skills_skill
  ON directory_profile_skills (skill_id, display_order, profile_id);

CREATE INDEX IF NOT EXISTS idx_directory_profile_tags_lookup
  ON directory_profile_tags (tag_kind, lower(tag_value));

CREATE UNIQUE INDEX IF NOT EXISTS uq_directory_profile_tags_profile_kind_value_ci
  ON directory_profile_tags (profile_id, tag_kind, lower(tag_value));

CREATE INDEX IF NOT EXISTS idx_directory_announcements_active_window
  ON directory_announcements (is_active, published_at DESC, expires_at);

CREATE INDEX IF NOT EXISTS idx_directory_change_events_target
  ON directory_profile_change_events (target_type, target_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_directory_deletion_events_user_scope
  ON directory_deletion_events (user_id, scope, requested_at DESC);

DO $$
BEGIN
  IF to_regclass('public.skills_taxonomy_sectors') IS NOT NULL
     AND to_regclass('public.skills_taxonomy_job_titles') IS NOT NULL
     AND to_regclass('public.skills_taxonomy_skills') IS NOT NULL THEN
    EXECUTE $v$
      CREATE OR REPLACE VIEW directory_public_projection AS
      SELECT
        p.id,
        p.display_name,
        p.headline,
        p.bio,
        p.profile_url,
        p.sector_id,
        s.name AS sector_name,
        p.job_title_id,
        jt.name AS job_title_name,
        COALESCE(
          (
            SELECT jsonb_agg(
              jsonb_build_object(
                'id', sk.id,
                'name', sk.name,
                'displayOrder', dps.display_order
              )
              ORDER BY dps.display_order ASC, sk.name ASC
            )
            FROM directory_profile_skills dps
            JOIN skills_taxonomy_skills sk ON sk.id = dps.skill_id
            WHERE dps.profile_id = p.id
          ),
          '[]'::jsonb
        ) AS skills,
        p.updated_at
      FROM directory_profiles p
      LEFT JOIN skills_taxonomy_sectors s ON s.id = p.sector_id
      LEFT JOIN skills_taxonomy_job_titles jt ON jt.id = p.job_title_id
      WHERE p.is_active = TRUE AND p.is_public = TRUE
    $v$;
  ELSE
    EXECUTE $v$
      CREATE OR REPLACE VIEW directory_public_projection AS
      SELECT
        p.id,
        p.display_name,
        p.headline,
        p.bio,
        p.profile_url,
        p.sector_id,
        NULL::text AS sector_name,
        p.job_title_id,
        NULL::text AS job_title_name,
        '[]'::jsonb AS skills,
        p.updated_at
      FROM directory_profiles p
      WHERE p.is_active = TRUE AND p.is_public = TRUE
    $v$;
  END IF;
END $$;

COMMIT;

-- ==== FILE: 2026-03-02-feed-announcements-core-phase0.sql ====
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $feed$
DECLARE
  announcements_id_type text;
BEGIN
  IF to_regclass('public.announcements') IS NOT NULL THEN
    ALTER TABLE public.announcements
      ADD COLUMN IF NOT EXISTS body TEXT,
      ADD COLUMN IF NOT EXISTS status TEXT,
      ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS mandatory BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS schedule_at TIMESTAMPTZ NULL,
      ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ NULL,
      ADD COLUMN IF NOT EXISTS targeting JSONB DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS created_by_user_id TEXT,
      ADD COLUMN IF NOT EXISTS updated_by_user_id TEXT;

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'announcements'
        AND column_name = 'content'
    ) THEN
      EXECUTE 'UPDATE public.announcements SET body = COALESCE(body, content) WHERE body IS NULL';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'announcements'
        AND column_name = 'is_active'
    ) THEN
      EXECUTE $sql$
        UPDATE public.announcements
        SET status = CASE WHEN is_active THEN 'published' ELSE 'archived' END
        WHERE status IS NULL
      $sql$;
    ELSE
      EXECUTE 'UPDATE public.announcements SET status = COALESCE(status, ''published'') WHERE status IS NULL';
    END IF;

    EXECUTE 'UPDATE public.announcements SET priority = COALESCE(priority, 0) WHERE priority IS NULL';
    EXECUTE 'UPDATE public.announcements SET mandatory = COALESCE(mandatory, FALSE) WHERE mandatory IS NULL';
    EXECUTE 'UPDATE public.announcements SET targeting = COALESCE(targeting, ''{}''::jsonb) WHERE targeting IS NULL';
    EXECUTE 'UPDATE public.announcements SET created_by_user_id = COALESCE(created_by_user_id, ''system-migration'') WHERE created_by_user_id IS NULL';
    EXECUTE 'UPDATE public.announcements SET updated_by_user_id = COALESCE(updated_by_user_id, ''system-migration'') WHERE updated_by_user_id IS NULL';
    EXECUTE 'UPDATE public.announcements SET published_at = COALESCE(published_at, created_at::timestamptz) WHERE published_at IS NULL';

    SELECT data_type
    INTO announcements_id_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'announcements'
      AND column_name = 'id';

    IF announcements_id_type IN ('character varying', 'text') THEN
      ALTER TABLE public.announcements
        ALTER COLUMN id TYPE UUID USING id::uuid;
      ALTER TABLE public.announcements
        ALTER COLUMN id SET DEFAULT gen_random_uuid();
    END IF;
  END IF;
END
$feed$;

CREATE TABLE IF NOT EXISTS feed_user_extension (
  user_id TEXT PRIMARY KEY,
  toast_mode_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  render_mode TEXT NOT NULL DEFAULT 'card_only' CHECK (render_mode IN ('card_only', 'card_toast')),
  service_deleted_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS feed_render_config (
  singleton_key BOOLEAN PRIMARY KEY DEFAULT TRUE,
  render_mode TEXT NOT NULL DEFAULT 'card_only' CHECK (render_mode IN ('card_only', 'card_toast')),
  kill_switch_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  max_timeline_page_size INTEGER NOT NULL DEFAULT 50,
  updated_by_user_id TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'published', 'archived')),
  priority INTEGER NOT NULL DEFAULT 0,
  mandatory BOOLEAN NOT NULL DEFAULT FALSE,
  schedule_at TIMESTAMPTZ NULL,
  published_at TIMESTAMPTZ NULL,
  expires_at TIMESTAMPTZ NULL,
  targeting JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id TEXT NOT NULL,
  updated_by_user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS announcement_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  revision_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  targeting JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (announcement_id, revision_number)
);

CREATE TABLE IF NOT EXISTS announcement_delivery_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('published', 'archived', 'membership_recalc')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS announcement_user_state (
  user_id TEXT NOT NULL,
  announcement_id UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NULL,
  dismissed_at TIMESTAMPTZ NULL,
  acknowledged_at TIMESTAMPTZ NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, announcement_id)
);

CREATE TABLE IF NOT EXISTS announcement_membership_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  plugin_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('join', 'leave')),
  request_id TEXT NULL,
  trace_id TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS announcement_admin_audit_trail (
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

CREATE TABLE IF NOT EXISTS feed_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_type TEXT NOT NULL CHECK (item_type IN ('announcement', 'activity')),
  source_announcement_id UUID NULL REFERENCES announcements(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  mandatory BOOLEAN NOT NULL DEFAULT FALSE,
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by_user_id TEXT NOT NULL,
  updated_by_user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS feed_item_targets (
  item_id UUID NOT NULL REFERENCES feed_items(id) ON DELETE CASCADE,
  target_role TEXT NOT NULL,
  target_plugin TEXT NULL,
  target_region TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (item_id, target_role, target_plugin, target_region)
);

CREATE TABLE IF NOT EXISTS feed_user_read_state (
  user_id TEXT NOT NULL,
  item_id UUID NOT NULL REFERENCES feed_items(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, item_id)
);

CREATE TABLE IF NOT EXISTS feed_user_dismissals (
  user_id TEXT NOT NULL,
  item_id UUID NOT NULL REFERENCES feed_items(id) ON DELETE CASCADE,
  dismissed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, item_id)
);

CREATE TABLE IF NOT EXISTS feed_membership_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  plugin_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('join', 'leave')),
  request_id TEXT NULL,
  trace_id TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS feed_admin_audit_trail (
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

CREATE INDEX IF NOT EXISTS idx_announcements_status_publish
  ON announcements (status, published_at DESC, expires_at);

CREATE INDEX IF NOT EXISTS idx_announcement_targets_json
  ON announcements USING GIN (targeting);

CREATE INDEX IF NOT EXISTS idx_announcement_delivery_events
  ON announcement_delivery_events (announcement_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_feed_items_visibility
  ON feed_items (is_active, published_at DESC, priority DESC, expires_at);

CREATE UNIQUE INDEX IF NOT EXISTS uq_feed_items_source_announcement
  ON feed_items (source_announcement_id)
  WHERE source_announcement_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_feed_targets_lookup
  ON feed_item_targets (target_role, target_plugin, target_region, item_id);

CREATE INDEX IF NOT EXISTS idx_feed_membership_events_lookup
  ON feed_membership_events (user_id, plugin_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_announcement_membership_events_lookup
  ON announcement_membership_events (user_id, plugin_id, created_at DESC);

INSERT INTO feed_render_config (singleton_key, render_mode, kill_switch_enabled, max_timeline_page_size, updated_by_user_id)
VALUES (TRUE, 'card_only', FALSE, 50, 'system-seed')
ON CONFLICT (singleton_key)
DO NOTHING;

CREATE OR REPLACE VIEW feed_timeline_projection AS
SELECT
  fi.id,
  fi.item_type,
  fi.source_announcement_id,
  fi.title,
  fi.body,
  fi.priority,
  fi.mandatory,
  fi.published_at,
  fi.expires_at,
  fi.is_active,
  fi.updated_at
FROM feed_items fi
WHERE fi.is_active = TRUE
  AND fi.published_at <= NOW()
  AND (fi.expires_at IS NULL OR fi.expires_at > NOW());

COMMIT;

-- ==== FILE: 2026-03-02-skills-taxonomy-core-phase0.sql ====
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS skills_taxonomy_sectors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  workforce_share NUMERIC(6,3) NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS skills_taxonomy_job_titles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id UUID NOT NULL REFERENCES skills_taxonomy_sectors(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS skills_taxonomy_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_title_id UUID NOT NULL REFERENCES skills_taxonomy_job_titles(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  aliases JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS skills_taxonomy_consumer_bindings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consumer_name TEXT NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('sector', 'job-title', 'skill')),
  target_id UUID NOT NULL,
  reference_count INTEGER NOT NULL DEFAULT 1 CHECK (reference_count >= 0),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (consumer_name, target_type, target_id)
);

CREATE TABLE IF NOT EXISTS skills_taxonomy_change_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id TEXT NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('sector', 'job-title', 'skill')),
  target_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete', 'preview')),
  reason TEXT NOT NULL DEFAULT '',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS skills_taxonomy_user_extension (
  user_id TEXT PRIMARY KEY,
  skill_visibility_preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  endorsement_opt_in BOOLEAN NOT NULL DEFAULT TRUE,
  service_deleted_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS skills_taxonomy_user_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  skill_id UUID NOT NULL REFERENCES skills_taxonomy_skills(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, skill_id)
);

CREATE TABLE IF NOT EXISTS skills_taxonomy_skill_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  skill_id UUID NOT NULL REFERENCES skills_taxonomy_skills(id) ON DELETE RESTRICT,
  value INTEGER NOT NULL DEFAULT 1 CHECK (value IN (-1, 1)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, skill_id)
);

CREATE TABLE IF NOT EXISTS skills_taxonomy_deletion_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  scope TEXT NOT NULL CHECK (scope IN ('service', 'account')),
  plugin_id TEXT NOT NULL DEFAULT 'skills-taxonomy',
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ NULL,
  result TEXT NOT NULL CHECK (result IN ('requested', 'processing', 'completed', 'failed')),
  request_id TEXT NULL,
  trace_id TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_skills_taxonomy_job_titles_sector ON skills_taxonomy_job_titles(sector_id);
CREATE INDEX IF NOT EXISTS idx_skills_taxonomy_skills_job_title ON skills_taxonomy_skills(job_title_id);
CREATE INDEX IF NOT EXISTS idx_skills_taxonomy_consumer_bindings_target ON skills_taxonomy_consumer_bindings(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_skills_taxonomy_change_events_target ON skills_taxonomy_change_events(target_type, target_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_skills_taxonomy_sectors_name_ci ON skills_taxonomy_sectors (lower(name));
CREATE UNIQUE INDEX IF NOT EXISTS uq_skills_taxonomy_job_titles_sector_name_ci ON skills_taxonomy_job_titles (sector_id, lower(name));
CREATE UNIQUE INDEX IF NOT EXISTS uq_skills_taxonomy_skills_job_title_name_ci ON skills_taxonomy_skills (job_title_id, lower(name));

CREATE OR REPLACE VIEW skills_taxonomy_flattened_projection AS
SELECT
  sec.id AS sector_id,
  sec.name AS sector_name,
  jt.id AS job_title_id,
  jt.name AS job_title_name,
  sk.id AS skill_id,
  sk.name AS skill_name,
  sk.aliases AS skill_aliases,
  (sec.is_active AND jt.is_active AND sk.is_active) AS is_active
FROM skills_taxonomy_sectors sec
JOIN skills_taxonomy_job_titles jt ON jt.sector_id = sec.id
JOIN skills_taxonomy_skills sk ON sk.job_title_id = jt.id;

CREATE OR REPLACE VIEW skills_taxonomy_dependency_graph AS
SELECT
  target_type,
  target_id,
  SUM(reference_count)::integer AS total_references,
  MAX(updated_at) AS snapshot_at
FROM skills_taxonomy_consumer_bindings
GROUP BY target_type, target_id;

COMMIT;

-- ==== FILE: 2026-03-03-foundation-core-phase1.sql ====
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS foundation_user_extension (
  user_id TEXT PRIMARY KEY,
  notification_preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  accessibility_runtime_prefs JSONB NOT NULL DEFAULT '{}'::jsonb,
  trauma_informed_defaults JSONB NOT NULL DEFAULT '{}'::jsonb,
  service_deleted_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS foundation_capacity_policies (
  singleton_key BOOLEAN PRIMARY KEY DEFAULT TRUE,
  max_active_threads_per_user INTEGER NOT NULL DEFAULT 20,
  max_messages_per_minute INTEGER NOT NULL DEFAULT 20,
  max_searches_per_minute INTEGER NOT NULL DEFAULT 40,
  max_quote_transitions_per_minute INTEGER NOT NULL DEFAULT 20,
  max_call_duration_minutes INTEGER NOT NULL DEFAULT 45,
  quota_state TEXT NOT NULL DEFAULT 'green' CHECK (quota_state IN ('green', 'yellow', 'orange', 'red')),
  kill_switch_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  updated_by_user_id TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS foundation_quota_threshold_states (
  singleton_key BOOLEAN PRIMARY KEY DEFAULT TRUE,
  stream_api_calls_used INTEGER NOT NULL DEFAULT 0,
  stream_api_calls_budget INTEGER NOT NULL DEFAULT 100000,
  stream_video_minutes_used INTEGER NOT NULL DEFAULT 0,
  stream_video_minutes_budget INTEGER NOT NULL DEFAULT 50000,
  threshold_state TEXT NOT NULL DEFAULT 'green' CHECK (threshold_state IN ('green', 'yellow', 'orange', 'red')),
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS foundation_connection_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survivor_user_id TEXT NOT NULL,
  provider_user_id TEXT NOT NULL,
  provider_directory_profile_id TEXT NOT NULL,
  stream_channel_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
  created_by_user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (survivor_user_id, provider_user_id),
  UNIQUE (stream_channel_id),
  CHECK (survivor_user_id <> provider_user_id)
);

CREATE TABLE IF NOT EXISTS foundation_thread_participants (
  thread_id UUID NOT NULL REFERENCES foundation_connection_threads(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  participant_role TEXT NOT NULL CHECK (participant_role IN ('survivor', 'provider')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (thread_id, user_id)
);

CREATE TABLE IF NOT EXISTS foundation_message_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES foundation_connection_threads(id) ON DELETE CASCADE,
  sender_user_id TEXT NOT NULL,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('survivor', 'provider')),
  message_text TEXT NOT NULL,
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  client_message_id TEXT NOT NULL,
  stream_message_id TEXT NULL,
  moderation_status TEXT NOT NULL DEFAULT 'accepted' CHECK (moderation_status IN ('accepted', 'flagged')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (thread_id, sender_user_id, client_message_id)
);

CREATE TABLE IF NOT EXISTS foundation_call_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES foundation_connection_threads(id) ON DELETE CASCADE,
  created_by_user_id TEXT NOT NULL,
  modality TEXT NOT NULL CHECK (modality IN ('voice', 'video')),
  stream_call_id TEXT NOT NULL,
  requested_duration_minutes INTEGER NOT NULL DEFAULT 30,
  status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'active', 'ended', 'cancelled')),
  started_at TIMESTAMPTZ NULL,
  ended_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (stream_call_id)
);

CREATE TABLE IF NOT EXISTS foundation_quote_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES foundation_connection_threads(id) ON DELETE CASCADE,
  survivor_user_id TEXT NOT NULL,
  provider_user_id TEXT NOT NULL,
  service_type TEXT NOT NULL,
  request_details JSONB NOT NULL DEFAULT '{}'::jsonb,
  lifecycle_state TEXT NOT NULL DEFAULT 'requested' CHECK (lifecycle_state IN ('requested', 'provider_responded', 'closed')),
  last_transitioned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS foundation_quote_status_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_request_id UUID NOT NULL REFERENCES foundation_quote_requests(id) ON DELETE CASCADE,
  actor_user_id TEXT NOT NULL,
  previous_state TEXT NULL,
  current_state TEXT NOT NULL CHECK (current_state IN ('requested', 'provider_responded', 'closed')),
  reason TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS foundation_notification_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  thread_id UUID NULL REFERENCES foundation_connection_threads(id) ON DELETE SET NULL,
  quote_request_id UUID NULL REFERENCES foundation_quote_requests(id) ON DELETE SET NULL,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_acknowledged BOOLEAN NOT NULL DEFAULT FALSE,
  acknowledged_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS foundation_rate_limit_counters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  command_name TEXT NOT NULL,
  window_started_at TIMESTAMPTZ NOT NULL,
  window_seconds INTEGER NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, command_name, window_started_at, window_seconds)
);

CREATE TABLE IF NOT EXISTS foundation_admin_audit_trail (
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

CREATE INDEX IF NOT EXISTS idx_foundation_threads_survivor
  ON foundation_connection_threads (survivor_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_foundation_threads_provider
  ON foundation_connection_threads (provider_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_foundation_messages_thread_created
  ON foundation_message_metadata (thread_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_foundation_calls_thread_created
  ON foundation_call_sessions (thread_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_foundation_quotes_survivor_state
  ON foundation_quote_requests (survivor_user_id, lifecycle_state, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_foundation_quotes_provider_state
  ON foundation_quote_requests (provider_user_id, lifecycle_state, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_foundation_quote_events_quote
  ON foundation_quote_status_events (quote_request_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_foundation_notifications_user_ack
  ON foundation_notification_events (user_id, is_acknowledged, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_foundation_rate_limit_lookup
  ON foundation_rate_limit_counters (user_id, command_name, window_started_at DESC);

CREATE INDEX IF NOT EXISTS idx_foundation_audit_lookup
  ON foundation_admin_audit_trail (created_at DESC, actor_id, command);

INSERT INTO foundation_capacity_policies (
  singleton_key,
  max_active_threads_per_user,
  max_messages_per_minute,
  max_searches_per_minute,
  max_quote_transitions_per_minute,
  max_call_duration_minutes,
  quota_state,
  kill_switch_enabled,
  updated_by_user_id
)
VALUES (
  TRUE,
  20,
  20,
  40,
  20,
  45,
  'green',
  FALSE,
  'system-seed'
)
ON CONFLICT (singleton_key) DO NOTHING;

INSERT INTO foundation_quota_threshold_states (
  singleton_key,
  stream_api_calls_used,
  stream_api_calls_budget,
  stream_video_minutes_used,
  stream_video_minutes_budget,
  threshold_state,
  computed_at
)
VALUES (
  TRUE,
  0,
  100000,
  0,
  50000,
  'green',
  NOW()
)
ON CONFLICT (singleton_key) DO NOTHING;

COMMIT;

-- ==== FILE: 2026-03-03-lighthouse-core-phase2.sql ====
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS lighthouse_user_extension (
  user_id TEXT PRIMARY KEY,
  notification_preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  accessibility_runtime_prefs JSONB NOT NULL DEFAULT '{}'::jsonb,
  trauma_informed_defaults JSONB NOT NULL DEFAULT '{}'::jsonb,
  service_deleted_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lighthouse_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE,
  profile_type TEXT NOT NULL CHECK (profile_type IN ('seeker', 'host')),
  bio TEXT NULL,
  phone_number TEXT NULL,
  signal_url TEXT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  has_property BOOLEAN NOT NULL DEFAULT FALSE,
  housing_needs TEXT NULL,
  desired_move_in_date DATE NULL,
  budget_min NUMERIC(12,2) NULL,
  budget_max NUMERIC(12,2) NULL,
  desired_country TEXT NULL,
  service_deleted_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (budget_min IS NULL OR budget_min >= 0),
  CHECK (budget_max IS NULL OR budget_max >= 0),
  CHECK (budget_min IS NULL OR budget_max IS NULL OR budget_max >= budget_min)
);

CREATE TABLE IF NOT EXISTS lighthouse_properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  property_type TEXT NULL,
  address_line TEXT NULL,
  city TEXT NULL,
  state TEXT NULL,
  country TEXT NULL,
  zip_code TEXT NULL,
  bedrooms INTEGER NULL,
  bathrooms NUMERIC(4,1) NULL,
  monthly_rent NUMERIC(12,2) NULL,
  available_from DATE NULL,
  amenities JSONB NOT NULL DEFAULT '[]'::jsonb,
  house_rules JSONB NOT NULL DEFAULT '[]'::jsonb,
  photos JSONB NOT NULL DEFAULT '[]'::jsonb,
  airbnb_profile_url TEXT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by_user_id TEXT NOT NULL,
  updated_by_user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (bedrooms IS NULL OR bedrooms >= 0),
  CHECK (bathrooms IS NULL OR bathrooms >= 0),
  CHECK (monthly_rent IS NULL OR monthly_rent >= 0)
);

ALTER TABLE IF EXISTS lighthouse_properties
  ADD COLUMN IF NOT EXISTS host_user_id TEXT,
  ADD COLUMN IF NOT EXISTS created_by_user_id TEXT,
  ADD COLUMN IF NOT EXISTS updated_by_user_id TEXT,
  ADD COLUMN IF NOT EXISTS property_type TEXT,
  ADD COLUMN IF NOT EXISTS address_line TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

DO $lighthouse_props$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'lighthouse_properties' AND column_name = 'host_id'
  ) THEN
    UPDATE lighthouse_properties lp
    SET host_user_id = COALESCE(lp.host_user_id, hp.user_id)
    FROM lighthouse_profiles hp
    WHERE hp.id::text = lp.host_id::text;
  END IF;

  UPDATE lighthouse_properties
  SET created_by_user_id = COALESCE(created_by_user_id, host_user_id)
  WHERE created_by_user_id IS NULL;

  UPDATE lighthouse_properties
  SET updated_by_user_id = COALESCE(updated_by_user_id, host_user_id)
  WHERE updated_by_user_id IS NULL;
END
$lighthouse_props$;

CREATE TABLE IF NOT EXISTS lighthouse_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id TEXT NOT NULL REFERENCES lighthouse_properties(id) ON DELETE CASCADE,
  seeker_user_id TEXT NOT NULL,
  host_user_id TEXT NOT NULL,
  message TEXT NULL,
  proposed_move_in_date DATE NULL,
  host_response TEXT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled', 'completed')),
  stream_channel_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE IF EXISTS lighthouse_matches
  ADD COLUMN IF NOT EXISTS seeker_user_id TEXT,
  ADD COLUMN IF NOT EXISTS host_user_id TEXT,
  ADD COLUMN IF NOT EXISTS message TEXT,
  ADD COLUMN IF NOT EXISTS stream_channel_id TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

DO $lighthouse_matches$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'lighthouse_matches' AND column_name = 'seeker_id'
  ) THEN
    UPDATE lighthouse_matches lm
    SET seeker_user_id = COALESCE(lm.seeker_user_id, hp.user_id)
    FROM lighthouse_profiles hp
    WHERE hp.id::text = lm.seeker_id::text;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'lighthouse_matches' AND column_name = 'seeker_message'
  ) THEN
    UPDATE lighthouse_matches
    SET message = COALESCE(message, seeker_message)
    WHERE message IS NULL;
  END IF;

  UPDATE lighthouse_matches lm
  SET host_user_id = COALESCE(lm.host_user_id, lp.host_user_id)
  FROM lighthouse_properties lp
  WHERE lp.id::text = lm.property_id::text;

  UPDATE lighthouse_matches
  SET stream_channel_id = COALESCE(stream_channel_id, 'pending')
  WHERE stream_channel_id IS NULL;

  UPDATE lighthouse_matches
  SET status = COALESCE(status, 'pending')
  WHERE status IS NULL;
END
$lighthouse_matches$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_lighthouse_match_active_request
  ON lighthouse_matches (property_id, seeker_user_id)
  WHERE status IN ('pending', 'accepted');

CREATE TABLE IF NOT EXISTS lighthouse_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_user_id TEXT NOT NULL,
  blocked_user_id TEXT NOT NULL,
  reason TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (blocker_user_id, blocked_user_id),
  CHECK (blocker_user_id <> blocked_user_id)
);

CREATE TABLE IF NOT EXISTS lighthouse_admin_audit_trail (
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

CREATE INDEX IF NOT EXISTS idx_lighthouse_profiles_type_active
  ON lighthouse_profiles (profile_type, is_active, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_lighthouse_properties_host_active
  ON lighthouse_properties (host_user_id, is_active, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_lighthouse_properties_browse
  ON lighthouse_properties (is_active, country, city, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_lighthouse_matches_actor_lookup
  ON lighthouse_matches (seeker_user_id, host_user_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_lighthouse_blocks_blocker
  ON lighthouse_blocks (blocker_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_lighthouse_audit_lookup
  ON lighthouse_admin_audit_trail (created_at DESC, actor_id, command);

COMMIT;

-- ==== FILE: 2026-03-03-plugin-registry-hub-phase2.sql ====
BEGIN;

CREATE TABLE IF NOT EXISTS ctf_plugin_registry (
  plugin_slug TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  phase TEXT NOT NULL CHECK (phase IN ('phase-0', 'phase-1', 'phase-2', 'phase-3')),
  start_gate TEXT NOT NULL,
  summary TEXT NOT NULL,
  availability_state TEXT NOT NULL CHECK (availability_state IN ('implemented_shell', 'planned')),
  nav_rank INTEGER NOT NULL DEFAULT 100,
  is_visible BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE IF EXISTS ctf_plugin_registry
  ADD COLUMN IF NOT EXISTS plugin_slug TEXT,
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS phase TEXT,
  ADD COLUMN IF NOT EXISTS start_gate TEXT,
  ADD COLUMN IF NOT EXISTS summary TEXT,
  ADD COLUMN IF NOT EXISTS availability_state TEXT,
  ADD COLUMN IF NOT EXISTS nav_rank INTEGER,
  ADD COLUMN IF NOT EXISTS is_visible BOOLEAN,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

UPDATE ctf_plugin_registry
SET
  nav_rank = COALESCE(nav_rank, 100),
  is_visible = COALESCE(is_visible, TRUE),
  created_at = COALESCE(created_at, NOW()),
  updated_at = COALESCE(updated_at, NOW())
WHERE nav_rank IS NULL
   OR is_visible IS NULL
   OR created_at IS NULL
   OR updated_at IS NULL;

DELETE FROM ctf_plugin_registry a
USING ctf_plugin_registry b
WHERE a.ctid < b.ctid
  AND a.plugin_slug = b.plugin_slug;

CREATE UNIQUE INDEX IF NOT EXISTS uq_ctf_plugin_registry_plugin_slug
  ON ctf_plugin_registry(plugin_slug);

INSERT INTO ctf_plugin_registry (
  plugin_slug,
  display_name,
  phase,
  start_gate,
  summary,
  availability_state,
  nav_rank,
  is_visible
)
VALUES
  ('chyme', 'Chyme', 'phase-0', 'Phase 0', 'Room bootstrap, chat, join flow, and deletion behavior with policy/audit.', 'implemented_shell', 10, TRUE),
  ('skills-taxonomy', 'Skills Taxonomy', 'phase-0', 'Phase 0', 'Hierarchy and CRUD for sectors, job titles, and skills with impact preview.', 'planned', 20, TRUE),
  ('directory', 'Directory', 'phase-0', 'Phase 0', 'Unified user/admin profile surface with claimed/unclaimed policy controls.', 'implemented_shell', 30, TRUE),
  ('feed-announcements', 'Feed + Announcements', 'phase-0', 'Phase 0', 'Timeline and announcement lifecycle in a coupled admin surface.', 'implemented_shell', 40, TRUE),
  ('workforce', 'Workforce', 'phase-1', 'Phase 1', 'Dashboard reporting and recruited-state derivation from upstream data.', 'implemented_shell', 50, TRUE),
  ('skills-hunt', 'Skills Hunt', 'phase-1', 'Phase 1', 'Rounds, moderation, scoring, leaderboards, and governed profile generation.', 'implemented_shell', 60, TRUE),
  ('foundation', 'Foundation', 'phase-1', 'Phase 1', 'Provider search and quote lifecycle using read-only Directory projections.', 'implemented_shell', 70, TRUE),
  ('lighthouse', 'LightHouse', 'phase-2', 'Phase 2', 'Profile/property/match parity scope with blocks lifecycle controls.', 'planned', 80, TRUE),
  ('socketrelay', 'SocketRelay', 'phase-2', 'Phase 2', 'Request and fulfillment flows with privacy-minimized public projections.', 'planned', 90, TRUE),
  ('trusttransport', 'TrustTransport', 'phase-2', 'Phase 2', 'Ride/package/food fulfillment with safety-first and dispute controls.', 'planned', 100, TRUE),
  ('peer-programming', 'Peer Programming', 'phase-2', 'Phase 2', 'Weekly cohort assignments with deterministic fallback-open behavior.', 'planned', 110, TRUE),
  ('mood', 'Mood', 'phase-2', 'Phase 2', 'Mood submissions with 7-day cooldown and anonymous clientId persistence.', 'planned', 120, TRUE),
  ('gentlepulse', 'GentlePulse', 'phase-2', 'Phase 2', 'Library listing/playback, ratings, favorites, and support route behavior.', 'planned', 130, TRUE),
  ('weekly-performance', 'Weekly Performance', 'phase-2', 'Phase 2', 'Week selection/guardrails with metrics, comparisons, and export gate checks.', 'planned', 140, TRUE),
  ('gdp', 'GDP', 'phase-3', 'Phase 3', 'Aggregate transparency and admin publish flows with compliance controls.', 'planned', 150, TRUE),
  ('service-credits', 'Service Credits', 'phase-3', 'Phase 3', 'Wallet/transfers/escrow/disputes and treasury governance workflows.', 'planned', 160, TRUE)
ON CONFLICT (plugin_slug) DO UPDATE
SET
  display_name = EXCLUDED.display_name,
  phase = EXCLUDED.phase,
  start_gate = EXCLUDED.start_gate,
  summary = EXCLUDED.summary,
  availability_state = EXCLUDED.availability_state,
  nav_rank = EXCLUDED.nav_rank,
  is_visible = EXCLUDED.is_visible,
  updated_at = NOW();

COMMIT;
-- ==== FILE: 2026-03-03-plugin-registry-phase2-availability-update.sql ====
BEGIN;

UPDATE ctf_plugin_registry
SET availability_state = 'implemented_shell', updated_at = NOW()
WHERE plugin_slug IN ('lighthouse', 'socketrelay', 'trusttransport');

COMMIT;

-- ==== FILE: 2026-03-03-skills-hunt-core-phase1.sql ====
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

-- ==== FILE: 2026-03-03-socketrelay-core-phase2.sql ====
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS socketrelay_user_extension (
  user_id TEXT PRIMARY KEY,
  display_name TEXT NULL,
  bio TEXT NULL,
  relay_preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  presence_opt_in BOOLEAN NOT NULL DEFAULT TRUE,
  service_deleted_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS socketrelay_requests (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  owner_user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  details TEXT NOT NULL,
  category TEXT NOT NULL,
  city TEXT NULL,
  is_public BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'claimed', 'closed', 'cancelled')),
  idempotency_key TEXT NOT NULL,
  reopened_count INTEGER NOT NULL DEFAULT 0,
  claimed_fulfillment_id TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (owner_user_id, idempotency_key)
);

ALTER TABLE IF EXISTS socketrelay_requests
  ADD COLUMN IF NOT EXISTS owner_user_id TEXT,
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS details TEXT,
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS reopened_count INTEGER,
  ADD COLUMN IF NOT EXISTS claimed_fulfillment_id TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

DO $socketrelay_requests$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'socketrelay_requests'
      AND column_name = 'user_id'
  ) THEN
    UPDATE socketrelay_requests
    SET owner_user_id = COALESCE(owner_user_id, user_id)
    WHERE owner_user_id IS NULL;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'socketrelay_requests'
      AND column_name = 'description'
  ) THEN
    UPDATE socketrelay_requests
    SET details = COALESCE(details, description)
    WHERE details IS NULL;
  END IF;

  UPDATE socketrelay_requests
  SET title = COALESCE(title, LEFT(COALESCE(details, 'Request'), 80))
  WHERE title IS NULL;

  UPDATE socketrelay_requests
  SET category = COALESCE(category, 'general')
  WHERE category IS NULL;

  UPDATE socketrelay_requests
  SET idempotency_key = COALESCE(idempotency_key, 'legacy-' || id)
  WHERE idempotency_key IS NULL;

  UPDATE socketrelay_requests
  SET reopened_count = COALESCE(reopened_count, 0)
  WHERE reopened_count IS NULL;

  UPDATE socketrelay_requests
  SET updated_at = COALESCE(updated_at, created_at)
  WHERE updated_at IS NULL;
END
$socketrelay_requests$;

CREATE TABLE IF NOT EXISTS socketrelay_request_events (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  request_id TEXT NOT NULL REFERENCES socketrelay_requests(id) ON DELETE CASCADE,
  actor_user_id TEXT NOT NULL,
  event_name TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS socketrelay_fulfillments (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  request_id TEXT NOT NULL REFERENCES socketrelay_requests(id) ON DELETE CASCADE,
  requester_user_id TEXT NOT NULL,
  fulfiller_user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed', 'cancelled')),
  close_reason TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (request_id, fulfiller_user_id)
);

CREATE TABLE IF NOT EXISTS socketrelay_fulfillment_participants (
  fulfillment_id TEXT NOT NULL REFERENCES socketrelay_fulfillments(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  participant_role TEXT NOT NULL CHECK (participant_role IN ('requester', 'fulfiller')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (fulfillment_id, user_id)
);

CREATE TABLE IF NOT EXISTS socketrelay_messages (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  fulfillment_id TEXT NOT NULL REFERENCES socketrelay_fulfillments(id) ON DELETE CASCADE,
  sender_user_id TEXT NOT NULL,
  message_text TEXT NOT NULL,
  client_message_id TEXT NOT NULL,
  moderation_status TEXT NOT NULL DEFAULT 'accepted' CHECK (moderation_status IN ('accepted', 'flagged')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (fulfillment_id, sender_user_id, client_message_id)
);

CREATE TABLE IF NOT EXISTS socketrelay_admin_audit_trail (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  actor_id TEXT NOT NULL,
  command TEXT NOT NULL,
  policy_status TEXT NOT NULL CHECK (policy_status IN ('allow', 'deny')),
  reason TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_socketrelay_requests_owner ON socketrelay_requests (owner_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_socketrelay_requests_public ON socketrelay_requests (is_public, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_socketrelay_fulfillments_request ON socketrelay_fulfillments (request_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_socketrelay_fulfillments_user ON socketrelay_fulfillments (fulfiller_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_socketrelay_messages_fulfillment ON socketrelay_messages (fulfillment_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_socketrelay_audit_created ON socketrelay_admin_audit_trail (created_at DESC, actor_id, command);

COMMIT;

-- ==== FILE: 2026-03-03-trusttransport-core-phase2.sql ====
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS trusttransport_user_extension (
  user_id TEXT PRIMARY KEY,
  mode_preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  safety_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  payout_preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  provider_eligible BOOLEAN NOT NULL DEFAULT FALSE,
  account_restricted BOOLEAN NOT NULL DEFAULT FALSE,
  restriction_reason TEXT NULL,
  restricted_at TIMESTAMPTZ NULL,
  restricted_by_user_id TEXT NULL,
  service_deleted_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trusttransport_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_user_id TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('ride', 'package', 'food')),
  title TEXT NOT NULL,
  details TEXT NOT NULL,
  pickup_city TEXT NULL,
  dropoff_city TEXT NULL,
  pickup_geo_redacted TEXT NULL,
  dropoff_geo_redacted TEXT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'accepted', 'in_progress', 'completed', 'cancelled', 'disputed', 'emergency_frozen')),
  idempotency_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (requester_user_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS trusttransport_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES trusttransport_requests(id) ON DELETE CASCADE,
  provider_user_id TEXT NOT NULL,
  note TEXT NULL,
  proposed_amount NUMERIC(12, 2) NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'withdrawn')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (request_id, provider_user_id)
);

CREATE TABLE IF NOT EXISTS trusttransport_trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL UNIQUE REFERENCES trusttransport_requests(id) ON DELETE CASCADE,
  offer_id UUID NOT NULL UNIQUE REFERENCES trusttransport_offers(id) ON DELETE CASCADE,
  requester_user_id TEXT NOT NULL,
  provider_user_id TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('ride', 'package', 'food')),
  status TEXT NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned', 'en_route', 'picked_up', 'delivered', 'completed', 'cancelled', 'disputed', 'emergency_frozen')),
  stream_channel_id TEXT NULL,
  cancelled_reason TEXT NULL,
  completed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trusttransport_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL UNIQUE REFERENCES trusttransport_trips(id) ON DELETE CASCADE,
  package_type TEXT NULL,
  fragile BOOLEAN NOT NULL DEFAULT FALSE,
  delivery_notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trusttransport_food_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL UNIQUE REFERENCES trusttransport_trips(id) ON DELETE CASCADE,
  vendor_name TEXT NULL,
  dietary_tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  order_notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trusttransport_status_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NULL REFERENCES trusttransport_requests(id) ON DELETE CASCADE,
  trip_id UUID NULL REFERENCES trusttransport_trips(id) ON DELETE CASCADE,
  actor_user_id TEXT NOT NULL,
  event_name TEXT NOT NULL,
  from_status TEXT NULL,
  to_status TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trusttransport_proof_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trusttransport_trips(id) ON DELETE CASCADE,
  artifact_type TEXT NOT NULL CHECK (artifact_type IN ('photo', 'code', 'note')),
  artifact_redacted TEXT NOT NULL,
  captured_by_user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trusttransport_disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trusttransport_trips(id) ON DELETE CASCADE,
  request_id UUID NOT NULL REFERENCES trusttransport_requests(id) ON DELETE CASCADE,
  opened_by_user_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'dismissed')),
  resolution_notes TEXT NULL,
  resolved_by_user_id TEXT NULL,
  resolved_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trusttransport_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL UNIQUE REFERENCES trusttransport_trips(id) ON DELETE CASCADE,
  requester_user_id TEXT NOT NULL,
  provider_user_id TEXT NOT NULL,
  score INTEGER NOT NULL CHECK (score BETWEEN 1 AND 5),
  feedback TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trusttransport_earnings_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_user_id TEXT NOT NULL,
  trip_id UUID NULL REFERENCES trusttransport_trips(id) ON DELETE SET NULL,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('credit', 'debit', 'hold', 'release')),
  amount NUMERIC(12, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'posted' CHECK (status IN ('posted', 'held', 'settled')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trusttransport_payout_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_user_id TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'approved', 'rejected', 'paid')),
  idempotency_key TEXT NOT NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_at TIMESTAMPTZ NULL,
  decided_by_user_id TEXT NULL,
  decision_reason TEXT NULL,
  UNIQUE (provider_user_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS trusttransport_risk_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NULL REFERENCES trusttransport_requests(id) ON DELETE SET NULL,
  trip_id UUID NULL REFERENCES trusttransport_trips(id) ON DELETE SET NULL,
  actor_user_id TEXT NOT NULL,
  target_user_id TEXT NULL,
  signal_type TEXT NOT NULL CHECK (signal_type IN ('emergency_stop', 'account_restricted', 'mutual_block', 'policy_flag')),
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  notes TEXT NULL,
  is_resolved BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_by_user_id TEXT NULL,
  resolved_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trusttransport_market_config (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by_user_id TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trusttransport_admin_audit_trail (
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

INSERT INTO trusttransport_market_config (id, config, updated_by_user_id)
VALUES (1, '{"maxConcurrentTrips": 3, "requireProofOnDelivery": true}'::jsonb, 'system')
ON CONFLICT (id) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_tt_requests_requester_created ON trusttransport_requests (requester_user_id, created_at DESC);
ALTER TABLE IF EXISTS trusttransport_requests
  ADD COLUMN IF NOT EXISTS mode TEXT;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'trusttransport_requests'
      AND column_name = 'mode'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_tt_requests_mode_status ON trusttransport_requests (mode, status, created_at DESC)';
  END IF;
END
$$;
CREATE INDEX IF NOT EXISTS idx_tt_offers_request_status ON trusttransport_offers (request_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tt_trips_participants ON trusttransport_trips (requester_user_id, provider_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tt_trips_status ON trusttransport_trips (status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_tt_status_events_trip ON trusttransport_status_events (trip_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tt_disputes_status_created ON trusttransport_disputes (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tt_ledger_provider_created ON trusttransport_earnings_ledger (provider_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tt_payout_provider_requested ON trusttransport_payout_requests (provider_user_id, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_tt_risk_signal_resolved ON trusttransport_risk_signals (is_resolved, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tt_audit_created_actor ON trusttransport_admin_audit_trail (created_at DESC, actor_id, command);

COMMIT;
-- ==== FILE: 2026-03-03-workforce-core-phase1.sql ====
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS workforce_user_extension (
  user_id TEXT PRIMARY KEY,
  availability_preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  work_preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  service_deleted_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workforce_occupations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  sector TEXT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by_user_id TEXT NOT NULL,
  updated_by_user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workforce_profiles (
  user_id TEXT PRIMARY KEY,
  occupation_id UUID NULL REFERENCES workforce_occupations(id) ON DELETE SET NULL,
  skill_level TEXT NOT NULL DEFAULT 'unknown',
  region TEXT NULL,
  recruited_state BOOLEAN NOT NULL DEFAULT FALSE,
  recruited_resolved_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workforce_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NULL,
  created_by_user_id TEXT NOT NULL,
  updated_by_user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workforce_config (
  singleton_key BOOLEAN PRIMARY KEY DEFAULT TRUE,
  exports_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  kill_switch_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  report_week_timezone TEXT NOT NULL DEFAULT 'America/New_York',
  report_week_start_dow SMALLINT NOT NULL DEFAULT 6,
  updated_by_user_id TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workforce_report_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_type TEXT NOT NULL CHECK (snapshot_type IN ('summary', 'skill_level', 'sector')),
  snapshot_key TEXT NOT NULL DEFAULT 'global',
  workforce_total INTEGER NOT NULL DEFAULT 0,
  recruited_total INTEGER NOT NULL DEFAULT 0,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  week_start_date DATE NULL,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workforce_recruited_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  directory_profile_id TEXT NOT NULL,
  source_event TEXT NOT NULL CHECK (
    source_event IN (
      'directory_profile_upsert',
      'directory_profile_assign',
      'workforce_admin_recompute',
      'workforce_profile_service_delete'
    )
  ),
  inference_dedupe_key TEXT NOT NULL UNIQUE,
  resolved_recruited BOOLEAN NOT NULL,
  resolved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workforce_export_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'completed', 'failed', 'deferred')),
  export_type TEXT NOT NULL,
  created_by_user_id TEXT NOT NULL,
  completed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workforce_admin_audit_trail (
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

CREATE INDEX IF NOT EXISTS idx_workforce_profiles_recruited_state
  ON workforce_profiles (recruited_state, recruited_resolved_at DESC);

CREATE INDEX IF NOT EXISTS idx_workforce_profiles_occupation
  ON workforce_profiles (occupation_id, skill_level);

CREATE INDEX IF NOT EXISTS idx_workforce_occupations_active
  ON workforce_occupations (is_active, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_workforce_announcements_active
  ON workforce_announcements (is_active, published_at DESC, expires_at);

CREATE INDEX IF NOT EXISTS idx_workforce_recruited_events_user_created
  ON workforce_recruited_events (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_workforce_report_snapshots_lookup
  ON workforce_report_snapshots (snapshot_type, snapshot_key, captured_at DESC);

CREATE INDEX IF NOT EXISTS idx_workforce_admin_audit_trail_lookup
  ON workforce_admin_audit_trail (created_at DESC, actor_id);

INSERT INTO workforce_config (
  singleton_key,
  exports_enabled,
  kill_switch_enabled,
  report_week_timezone,
  report_week_start_dow,
  updated_by_user_id
)
VALUES (TRUE, FALSE, FALSE, 'America/New_York', 6, 'system-seed')
ON CONFLICT (singleton_key)
DO NOTHING;

COMMIT;

-- ==== FILE: 2026-03-03-workforce-incremental-sync.sql ====
BEGIN;

CREATE TABLE IF NOT EXISTS workforce_recruited_sync_cursor (
  singleton_key BOOLEAN PRIMARY KEY DEFAULT TRUE,
  last_cursor_at TIMESTAMPTZ NOT NULL DEFAULT '1970-01-01T00:00:00Z'::timestamptz,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO workforce_recruited_sync_cursor (singleton_key, last_cursor_at)
VALUES (TRUE, '1970-01-01T00:00:00Z'::timestamptz)
ON CONFLICT (singleton_key)
DO NOTHING;

COMMIT;

-- ==== FILE: 2026-03-04-gdp-core-phase3.sql ====
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS gdp_reporting_weeks (
  week_start_date DATE PRIMARY KEY,
  week_end_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gdp_metric_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start_date DATE NOT NULL REFERENCES gdp_reporting_weeks(week_start_date) ON DELETE CASCADE,
  metric_key TEXT NOT NULL,
  metric_value NUMERIC(16, 2) NOT NULL,
  dp_suppressed BOOLEAN NOT NULL DEFAULT FALSE,
  lawful_basis TEXT NOT NULL,
  source_plugin TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (week_start_date, metric_key)
);

CREATE TABLE IF NOT EXISTS gdp_publications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start_date DATE NOT NULL REFERENCES gdp_reporting_weeks(week_start_date) ON DELETE CASCADE,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'published')) DEFAULT 'draft',
  published_by_user_id TEXT NULL,
  published_at TIMESTAMPTZ NULL,
  created_by_user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gdp_admin_audit_trail (
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

INSERT INTO gdp_reporting_weeks (week_start_date, week_end_date)
VALUES (DATE_TRUNC('week', NOW())::date, (DATE_TRUNC('week', NOW())::date + INTERVAL '6 days')::date)
ON CONFLICT (week_start_date) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_gdp_metrics_week ON gdp_metric_snapshots (week_start_date, metric_key);
CREATE INDEX IF NOT EXISTS idx_gdp_publications_week ON gdp_publications (week_start_date, status, updated_at DESC);

COMMIT;

-- ==== FILE: 2026-03-04-gentlepulse-core-phase2.sql ====
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS gentlepulse_library_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  media_url TEXT NOT NULL,
  support_route TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gentlepulse_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  item_id UUID NOT NULL REFERENCES gentlepulse_library_items(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, item_id)
);

CREATE TABLE IF NOT EXISTS gentlepulse_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  item_id UUID NOT NULL REFERENCES gentlepulse_library_items(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, item_id)
);

CREATE TABLE IF NOT EXISTS gentlepulse_play_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NULL,
  anonymous_client_id TEXT NULL,
  item_id UUID NOT NULL REFERENCES gentlepulse_library_items(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  CHECK (user_id IS NOT NULL OR anonymous_client_id IS NOT NULL)
);

INSERT INTO gentlepulse_library_items (slug, title, description, media_url, support_route)
VALUES
  ('breathing-baseline', 'Breathing Baseline', 'Guided breathing for regulated reset.', 'https://media.example.local/gentlepulse/breathing-baseline.mp3', '/support'),
  ('grounding-quick-reset', 'Grounding Quick Reset', 'A short grounding sequence for high-stress moments.', 'https://media.example.local/gentlepulse/grounding-quick-reset.mp3', '/support')
ON CONFLICT (slug) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_gentlepulse_library_active ON gentlepulse_library_items (is_active, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_gentlepulse_play_events_item_started ON gentlepulse_play_events (item_id, started_at DESC);

COMMIT;

-- ==== FILE: 2026-03-04-mood-core-phase2.sql ====
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS mood_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  mood_value INTEGER NOT NULL CHECK (mood_value BETWEEN 1 AND 5),
  note TEXT NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mood_admin_audit_trail (
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

CREATE INDEX IF NOT EXISTS idx_mood_submissions_user_submitted ON mood_submissions (user_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_mood_submissions_client_submitted ON mood_submissions (client_id, submitted_at DESC);

COMMIT;

-- ==== FILE: 2026-03-04-peer-programming-core-phase2.sql ====
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS peer_programming_weekly_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start_date DATE NOT NULL UNIQUE,
  title TEXT NOT NULL,
  guidance TEXT NOT NULL,
  revision_note TEXT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'published')) DEFAULT 'draft',
  published_by_user_id TEXT NULL,
  published_at TIMESTAMPTZ NULL,
  created_by_user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS peer_programming_cohorts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start_date DATE NOT NULL,
  cohort_label TEXT NOT NULL,
  topic_id UUID NULL REFERENCES peer_programming_weekly_topics(id) ON DELETE SET NULL,
  fallback_open BOOLEAN NOT NULL DEFAULT FALSE,
  assigned_by_user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (week_start_date, cohort_label)
);

CREATE TABLE IF NOT EXISTS peer_programming_cohort_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id UUID NOT NULL REFERENCES peer_programming_cohorts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (cohort_id, user_id)
);

CREATE TABLE IF NOT EXISTS peer_programming_assignment_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id UUID NOT NULL REFERENCES peer_programming_cohorts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  delivered_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS peer_programming_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id UUID NOT NULL REFERENCES peer_programming_cohorts(id) ON DELETE CASCADE,
  author_user_id TEXT NOT NULL,
  parent_message_id UUID NULL REFERENCES peer_programming_messages(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  tier TEXT NOT NULL CHECK (tier IN ('cohort_member', 'authenticated_audience', 'public_audience')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS peer_programming_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id UUID NULL REFERENCES peer_programming_cohorts(id) ON DELETE SET NULL,
  user_id TEXT NOT NULL,
  issue_type TEXT NOT NULL,
  suggestion_category TEXT NOT NULL,
  release_surface TEXT NOT NULL CHECK (release_surface IN ('web', 'android')),
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS peer_programming_admin_audit_trail (
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

CREATE INDEX IF NOT EXISTS idx_pp_cohorts_week ON peer_programming_cohorts (week_start_date, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pp_members_user ON peer_programming_cohort_members (user_id, assigned_at DESC);
CREATE INDEX IF NOT EXISTS idx_pp_notifications_user_created ON peer_programming_assignment_notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pp_messages_cohort_created ON peer_programming_messages (cohort_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_pp_feedback_created ON peer_programming_feedback (created_at DESC);

COMMIT;

-- ==== FILE: 2026-03-04-plugin-registry-phase3-availability-update.sql ====
BEGIN;

UPDATE ctf_plugin_registry
SET availability_state = 'implemented_shell', updated_at = NOW()
WHERE plugin_slug IN (
  'peer-programming',
  'mood',
  'gentlepulse',
  'weekly-performance',
  'gdp',
  'service-credits'
);

COMMIT;

-- ==== FILE: 2026-03-04-service-credits-core-phase3.sql ====
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS service_credits_wallets (
  user_id TEXT PRIMARY KEY,
  available_balance NUMERIC(14, 2) NOT NULL DEFAULT 0,
  escrow_balance NUMERIC(14, 2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS service_credits_ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('credit', 'debit', 'escrow_hold', 'escrow_release', 'adjustment', 'reclaim')),
  amount NUMERIC(14, 2) NOT NULL,
  reference_type TEXT NOT NULL,
  reference_id TEXT NOT NULL,
  accounting_scope TEXT NOT NULL CHECK (accounting_scope IN ('service_credits_non_gdp', 'cross_plugin_adapter')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS service_credits_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_user_id TEXT NOT NULL,
  recipient_user_id TEXT NOT NULL,
  amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'cancelled', 'disputed')) DEFAULT 'pending',
  idempotency_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ NULL,
  UNIQUE (sender_user_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS service_credits_escrow_holds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_user_id TEXT NOT NULL,
  transfer_id UUID NULL REFERENCES service_credits_transfers(id) ON DELETE SET NULL,
  amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL CHECK (status IN ('held', 'released', 'reverted')) DEFAULT 'held',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS service_credits_disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id UUID NOT NULL REFERENCES service_credits_transfers(id) ON DELETE CASCADE,
  opened_by_user_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('open', 'resolved', 'dismissed')) DEFAULT 'open',
  resolution_note TEXT NULL,
  resolved_by_user_id TEXT NULL,
  resolved_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS service_credits_treasury_config (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  policy JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by_user_id TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS service_credits_admin_audit_trail (
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

INSERT INTO service_credits_treasury_config (id, policy, updated_by_user_id)
VALUES (1, '{"maxTransferAmount": 10000, "disputeWindowDays": 14, "nonGdpReclaim": true}'::jsonb, 'system')
ON CONFLICT (id) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_service_credits_ledger_user_created ON service_credits_ledger_entries (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_service_credits_transfers_sender_created ON service_credits_transfers (sender_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_service_credits_disputes_status_created ON service_credits_disputes (status, created_at DESC);

COMMIT;

-- ==== FILE: 2026-03-04-service-credits-formance-adapter-phase3.sql ====
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS service_credits_command_idempotency (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id TEXT NOT NULL,
  command_name TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  response_payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (actor_id, command_name, idempotency_key)
);

CREATE TABLE IF NOT EXISTS service_credits_adapter_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  command_name TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'formance',
  status TEXT NOT NULL CHECK (status IN ('queued', 'delivered', 'failed')) DEFAULT 'queued',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  provider_transaction_id TEXT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 1,
  last_error TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (command_name, idempotency_key)
);

CREATE TABLE IF NOT EXISTS service_credits_governance_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL CHECK (event_type IN ('mint_grant', 'burn')),
  target_user_id TEXT NOT NULL,
  amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  governance_ticket_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  provider_transaction_id TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_type, actor_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS service_credits_treasury_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL CHECK (event_type IN ('fee_collect', 'deletion_reclaim')),
  source_user_id TEXT NOT NULL,
  treasury_user_id TEXT NOT NULL,
  amount NUMERIC(14, 2) NOT NULL CHECK (amount >= 0),
  transfer_id UUID NULL REFERENCES service_credits_transfers(id) ON DELETE SET NULL,
  reason_code TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  provider_transaction_id TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_type, actor_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS service_credits_dispute_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_case_id TEXT NOT NULL,
  source_user_id TEXT NOT NULL,
  destination_user_id TEXT NOT NULL,
  amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  adjustment_reason TEXT NOT NULL,
  transfer_id UUID NOT NULL REFERENCES service_credits_transfers(id) ON DELETE RESTRICT,
  actor_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  provider_transaction_id TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (actor_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS service_credits_wallet_tombstones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id TEXT NOT NULL,
  deletion_request_id TEXT NOT NULL,
  final_available_balance NUMERIC(14, 2) NOT NULL,
  final_escrow_balance NUMERIC(14, 2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (account_id, deletion_request_id)
);

CREATE TABLE IF NOT EXISTS service_credits_account_deletion_reclaims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id TEXT NOT NULL,
  deletion_request_id TEXT NOT NULL,
  treasury_user_id TEXT NOT NULL,
  amount_transferred NUMERIC(14, 2) NOT NULL CHECK (amount_transferred >= 0),
  transfer_id UUID NULL REFERENCES service_credits_transfers(id) ON DELETE SET NULL,
  tombstone_id UUID NOT NULL REFERENCES service_credits_wallet_tombstones(id) ON DELETE RESTRICT,
  request_id TEXT NOT NULL,
  trace_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  provider_transaction_id TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (account_id, deletion_request_id),
  UNIQUE (actor_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_service_credits_outbox_status_created
  ON service_credits_adapter_outbox (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_service_credits_cmd_idempotency_actor_command
  ON service_credits_command_idempotency (actor_id, command_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_service_credits_treasury_events_created
  ON service_credits_treasury_events (event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_service_credits_governance_events_created
  ON service_credits_governance_events (event_type, created_at DESC);

COMMIT;

-- ==== FILE: 2026-03-04-weekly-performance-core-phase2.sql ====
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS weekly_performance_weeks (
  week_start_date DATE PRIMARY KEY,
  week_end_date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('open', 'locked', 'published')) DEFAULT 'open',
  selected_by_user_id TEXT NULL,
  selected_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS weekly_performance_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start_date DATE NOT NULL REFERENCES weekly_performance_weeks(week_start_date) ON DELETE CASCADE,
  metric_key TEXT NOT NULL,
  metric_value NUMERIC(14, 2) NOT NULL,
  metric_unit TEXT NOT NULL,
  source_plugin TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (week_start_date, metric_key)
);

CREATE TABLE IF NOT EXISTS weekly_performance_audit_trail (
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

INSERT INTO weekly_performance_weeks (week_start_date, week_end_date, status)
VALUES (DATE_TRUNC('week', NOW())::date, (DATE_TRUNC('week', NOW())::date + INTERVAL '6 days')::date, 'open')
ON CONFLICT (week_start_date) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_weekly_perf_metrics_week ON weekly_performance_metrics (week_start_date, metric_key);

COMMIT;

-- ==== FILE: 2026-03-05-chyme-service-credits.sql ====
-- Add chyme_service_credits_transactions table for service credits support in Chyme
CREATE TABLE IF NOT EXISTS chyme_service_credits_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_user_id UUID NOT NULL,
    to_user_id UUID NOT NULL,
    amount NUMERIC(20, 8) NOT NULL CHECK (amount > 0),
    message TEXT,
    status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'failed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chyme_service_credits_from_user ON chyme_service_credits_transactions (from_user_id);
CREATE INDEX IF NOT EXISTS idx_chyme_service_credits_to_user ON chyme_service_credits_transactions (to_user_id);

-- ==== FILE: 2026-03-05-directory-profile-payment-addresses.sql ====
-- Directory profile payment address fields migration
-- Adds optional fields for Venmo, Monero, Bitcoin, and ServiceCredits addresses

ALTER TABLE directory_profiles
  ADD COLUMN venmo_address TEXT NULL,
  ADD COLUMN monero_address TEXT NULL,
  ADD COLUMN bitcoin_address TEXT NULL,
  ADD COLUMN service_credits_address TEXT NULL;

-- ==== FILE: 2026-03-05-skills-hunt-service-credits.sql ====
-- Skills Hunt Service Credits Transactions Table
CREATE TABLE IF NOT EXISTS skills_hunt_service_credits_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_user_id VARCHAR NOT NULL REFERENCES users(id),
    to_user_id VARCHAR NOT NULL REFERENCES users(id),
    amount INTEGER NOT NULL CHECK (amount > 0),
    reason TEXT,
    submission_id UUID REFERENCES skills_hunt_submissions(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_skills_hunt_service_credits_from_user ON skills_hunt_service_credits_transactions (from_user_id);
CREATE INDEX IF NOT EXISTS idx_skills_hunt_service_credits_to_user ON skills_hunt_service_credits_transactions (to_user_id);
CREATE INDEX IF NOT EXISTS idx_skills_hunt_service_credits_submission_id ON skills_hunt_service_credits_transactions (submission_id);
-- ==== FILE: 2026-03-24-levelup-core-phase3.sql ====
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS levelup_cohorts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  track TEXT NOT NULL,
  seats INTEGER NOT NULL CHECK (seats > 0),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  required_credits NUMERIC(14, 2) NOT NULL DEFAULT 0,
  materials_cost NUMERIC(14, 2) NOT NULL DEFAULT 0,
  device_support BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL CHECK (status IN ('draft', 'open', 'active', 'completed', 'cancelled')) DEFAULT 'draft',
  allow_no_deposit BOOLEAN NOT NULL DEFAULT FALSE,
  trainer_split_percent NUMERIC(5, 2) NOT NULL DEFAULT 25 CHECK (trainer_split_percent >= 0 AND trainer_split_percent <= 100),
  completion_bonus_credits NUMERIC(14, 2) NOT NULL DEFAULT 0,
  stipend_mode TEXT NOT NULL DEFAULT 'none' CHECK (stipend_mode IN ('none', 'scheduled', 'milestone')),
  stipend_amount_per_payout NUMERIC(14, 2) NOT NULL DEFAULT 0,
  stipend_interval_days INTEGER NULL,
  microgrant_mode TEXT NOT NULL DEFAULT 'none' CHECK (microgrant_mode IN ('none', 'cohort_pool', 'separate_grant')),
  microgrant_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  refund_policy_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  payout_policy_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  policy_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_date >= start_date)
);

CREATE TABLE IF NOT EXISTS levelup_curriculum_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id UUID NOT NULL REFERENCES levelup_cohorts(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  sequence_no INTEGER NOT NULL CHECK (sequence_no > 0),
  required BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (cohort_id, sequence_no)
);

CREATE TABLE IF NOT EXISTS levelup_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id UUID NOT NULL REFERENCES levelup_cohorts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  percent_release NUMERIC(5, 2) NOT NULL CHECK (percent_release > 0 AND percent_release <= 100),
  required_task TEXT NOT NULL,
  sequence_no INTEGER NOT NULL CHECK (sequence_no > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (cohort_id, sequence_no)
);

CREATE TABLE IF NOT EXISTS levelup_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id UUID NOT NULL REFERENCES levelup_cohorts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('enrolled', 'active', 'completed', 'dropped')) DEFAULT 'enrolled',
  credits_deposited NUMERIC(14, 2) NOT NULL DEFAULT 0,
  progress_percent NUMERIC(5, 2) NOT NULL DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
  assigned_trainer_id TEXT NULL,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (cohort_id, user_id)
);

CREATE TABLE IF NOT EXISTS levelup_enrollment_milestone_escrows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL REFERENCES levelup_enrollments(id) ON DELETE CASCADE,
  milestone_id UUID NOT NULL REFERENCES levelup_milestones(id) ON DELETE CASCADE,
  escrow_id UUID NOT NULL,
  held_amount NUMERIC(14, 2) NOT NULL CHECK (held_amount > 0),
  release_status TEXT NOT NULL CHECK (release_status IN ('held', 'released', 'reverted')) DEFAULT 'held',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (enrollment_id, milestone_id),
  UNIQUE (escrow_id)
);

CREATE TABLE IF NOT EXISTS levelup_milestone_validations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL REFERENCES levelup_enrollments(id) ON DELETE CASCADE,
  milestone_id UUID NOT NULL REFERENCES levelup_milestones(id) ON DELETE CASCADE,
  validated_by_user_id TEXT NOT NULL,
  validation_note TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('validated', 'released', 'disputed')) DEFAULT 'validated',
  validated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  released_at TIMESTAMPTZ NULL,
  release_transfer_id UUID NULL,
  trainer_payout_governance_id UUID NULL,
  UNIQUE (enrollment_id, milestone_id)
);

CREATE TABLE IF NOT EXISTS levelup_disbursements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL REFERENCES levelup_enrollments(id) ON DELETE CASCADE,
  cohort_id UUID NOT NULL REFERENCES levelup_cohorts(id) ON DELETE CASCADE,
  disbursement_type TEXT NOT NULL CHECK (disbursement_type IN ('stipend', 'materials_microgrant', 'device_microgrant', 'completion_bonus', 'trainer_payout')),
  amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  source_type TEXT NOT NULL CHECK (source_type IN ('cohort_pool', 'separate_grant', 'treasury_grant')),
  recipient_user_id TEXT NOT NULL,
  reference_id TEXT NULL,
  status TEXT NOT NULL CHECK (status IN ('scheduled', 'completed', 'cancelled')) DEFAULT 'completed',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS levelup_stipend_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL REFERENCES levelup_enrollments(id) ON DELETE CASCADE,
  cohort_id UUID NOT NULL REFERENCES levelup_cohorts(id) ON DELETE CASCADE,
  scheduled_at TIMESTAMPTZ NOT NULL,
  amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL CHECK (status IN ('scheduled', 'paid', 'cancelled')) DEFAULT 'scheduled',
  reference_disbursement_id UUID NULL REFERENCES levelup_disbursements(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS levelup_disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL REFERENCES levelup_enrollments(id) ON DELETE CASCADE,
  milestone_id UUID NULL REFERENCES levelup_milestones(id) ON DELETE SET NULL,
  opened_by_user_id TEXT NOT NULL,
  assigned_to_user_id TEXT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('open', 'under_review', 'resolved', 'dismissed')) DEFAULT 'open',
  resolution_comment TEXT NULL,
  resolved_by_user_id TEXT NULL,
  resolved_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS levelup_dispute_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id UUID NOT NULL REFERENCES levelup_disputes(id) ON DELETE CASCADE,
  actor_user_id TEXT NOT NULL,
  body TEXT NOT NULL,
  attachment_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS levelup_rate_limit_counters (
  user_id TEXT NOT NULL,
  command_name TEXT NOT NULL,
  window_started_at TIMESTAMPTZ NOT NULL,
  window_seconds INTEGER NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, command_name, window_started_at, window_seconds)
);

CREATE TABLE IF NOT EXISTS levelup_command_idempotency (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id TEXT NOT NULL,
  command_name TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  response_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (actor_id, command_name, idempotency_key)
);

CREATE TABLE IF NOT EXISTS levelup_audit_events (
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

CREATE TABLE IF NOT EXISTS levelup_policy_config (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  starter_credits NUMERIC(14, 2) NOT NULL DEFAULT 500,
  default_trainer_split_percent NUMERIC(5, 2) NOT NULL DEFAULT 25,
  config_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by_user_id TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO levelup_policy_config (id, starter_credits, default_trainer_split_percent, config_json, updated_by_user_id)
VALUES (1, 500, 25, '{"regionalBands": {}, "tierOverrides": {"pilot": 500, "priority": [1000, 2500], "micro": [100, 300]}}'::jsonb, 'system')
ON CONFLICT (id) DO NOTHING;

INSERT INTO ctf_plugin_registry (
  plugin_slug,
  display_name,
  phase,
  start_gate,
  summary,
  availability_state,
  nav_rank,
  is_visible
)
VALUES (
  'levelup',
  'LevelUp',
  'phase-3',
  'Phase 3',
  'Flexible training cohorts with escrowed enrollment, milestone-based release, trainer payouts, stipends, and disputes.',
  'implemented_shell',
  170,
  TRUE
)
ON CONFLICT (plugin_slug) DO UPDATE
SET
  display_name = EXCLUDED.display_name,
  phase = EXCLUDED.phase,
  start_gate = EXCLUDED.start_gate,
  summary = EXCLUDED.summary,
  availability_state = EXCLUDED.availability_state,
  nav_rank = EXCLUDED.nav_rank,
  is_visible = EXCLUDED.is_visible,
  updated_at = NOW();

CREATE INDEX IF NOT EXISTS idx_levelup_cohorts_track_status_start ON levelup_cohorts (track, status, start_date);
CREATE INDEX IF NOT EXISTS idx_levelup_enrollments_user_status ON levelup_enrollments (user_id, status);
CREATE INDEX IF NOT EXISTS idx_levelup_milestones_cohort_seq ON levelup_milestones (cohort_id, sequence_no);
CREATE INDEX IF NOT EXISTS idx_levelup_disputes_status_created ON levelup_disputes (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_levelup_disbursements_enrollment_created ON levelup_disbursements (enrollment_id, created_at DESC);

COMMIT;

-- ==== FILE: 2026-03-25-legacy-profile-redirects.sql ====
-- ========================================
-- LEGACY PROFILE REDIRECT MAPPING TABLE
-- ========================================
-- Purpose: Maintain backward compatibility for legacy plugin profile URLs
-- during the platform migration from /platform to ctf rewrite.
-- Allows existing shared URLs to continue working without link rot.

CREATE TABLE IF NOT EXISTS legacy_profile_redirects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plugin_slug VARCHAR NOT NULL,
  scope VARCHAR NOT NULL,
  legacy_entity_id UUID NOT NULL,
  current_entity_id UUID NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Composite unique constraint: ensure one mapping per plugin+scope+legacy_id
CREATE UNIQUE INDEX IF NOT EXISTS uq_legacy_profile_redirects
  ON legacy_profile_redirects(plugin_slug, scope, legacy_entity_id);

-- Query index to quickly find redirect by plugin+scope+legacy_id
CREATE INDEX IF NOT EXISTS idx_legacy_redirects_lookup
  ON legacy_profile_redirects(plugin_slug, scope, legacy_entity_id);

-- Audit index to track when redirects were created
CREATE INDEX IF NOT EXISTS idx_legacy_redirects_created_at
  ON legacy_profile_redirects(created_at DESC);

COMMENT ON TABLE legacy_profile_redirects IS 
  'Maps legacy platform profile URLs to new ctf rewrite entity IDs. Used during platform migration to prevent link rot.';

COMMENT ON COLUMN legacy_profile_redirects.plugin_slug IS 
  'Plugin identifier (e.g., "directory", "lighthouse", "socketrelay")';

COMMENT ON COLUMN legacy_profile_redirects.scope IS 
  'URL path segment between plugin and ID (e.g., "public", "property")';

COMMENT ON COLUMN legacy_profile_redirects.legacy_entity_id IS 
  'The old UUID from the legacy platform /platform database';

COMMENT ON COLUMN legacy_profile_redirects.current_entity_id IS 
  'The corresponding new UUID in the ctf rewrite database';

-- ==== FILE: 2026-03-25-trust-core-phase1.sql ====
BEGIN;

-- Trust plugin: user extension table
CREATE TABLE IF NOT EXISTS trust_user_extension (
  user_id TEXT PRIMARY KEY,
  trust_status TEXT NOT NULL DEFAULT 'unverified' CHECK (trust_status IN ('unverified', 'verified', 'flagged')),
  trust_evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  trust_visibility TEXT NOT NULL DEFAULT 'public' CHECK (trust_visibility IN ('public', 'private', 'restricted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trust plugin: signal snapshots
CREATE TABLE IF NOT EXISTS trust_signal_snapshots (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  snapshot JSONB NOT NULL,
  snapshot_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, snapshot_type, created_at)
);
CREATE INDEX IF NOT EXISTS idx_trust_signal_snapshots_user ON trust_signal_snapshots (user_id, created_at DESC);

-- Trust plugin: admin audit trail
CREATE TABLE IF NOT EXISTS trust_admin_audit_trail (
  id BIGSERIAL PRIMARY KEY,
  actor_user_id TEXT NULL,
  command TEXT NOT NULL,
  policy_status TEXT NOT NULL CHECK (policy_status IN ('allow', 'deny')),
  reason TEXT NOT NULL,
  target_user_id TEXT NULL,
  request_id TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_trust_admin_audit_trail_target_user ON trust_admin_audit_trail (target_user_id, created_at DESC);

-- Register Trust plugin in plugin registry
INSERT INTO ctf_plugin_registry (
  plugin_slug,
  display_name,
  phase,
  start_gate,
  summary,
  availability_state,
  nav_rank,
  is_visible
)
VALUES (
  'trust',
  'Trust',
  'phase-1',
  'Phase 1',
  'Privacy-first trust evidence and verification plugin.',
  'implemented_shell',
  70,
  FALSE
)
ON CONFLICT (plugin_slug) DO UPDATE
SET
  display_name = EXCLUDED.display_name,
  phase = EXCLUDED.phase,
  start_gate = EXCLUDED.start_gate,
  summary = EXCLUDED.summary,
  availability_state = EXCLUDED.availability_state,
  nav_rank = EXCLUDED.nav_rank,
  is_visible = EXCLUDED.is_visible,
  updated_at = NOW();

COMMIT;

-- ==== FILE: 2026-03-25-unlock-core-phase1.sql ====
BEGIN;

CREATE TABLE IF NOT EXISTS unlock_runtime_config (
  singleton_id INTEGER PRIMARY KEY CHECK (singleton_id = 1),
  submission_window_hours INTEGER NOT NULL DEFAULT 168,
  reminder_schedule_hours INTEGER[] NOT NULL DEFAULT ARRAY[0, 24, 72, 168],
  incentive_amount NUMERIC(14, 2) NOT NULL DEFAULT 100,
  support_only_after_expiry BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO unlock_runtime_config (singleton_id)
VALUES (1)
ON CONFLICT (singleton_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS unlock_verification_submissions (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  quora_profile_url TEXT NOT NULL,
  quora_profile_url_normalized TEXT NOT NULL,
  review_status TEXT NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending', 'approved', 'rejected', 'spam')),
  access_tier TEXT NOT NULL DEFAULT 'pending_readonly' CHECK (access_tier IN ('pending_readonly', 'locked_support_only', 'approved_full')),
  unlock_window_expires_at TIMESTAMPTZ NOT NULL,
  reminder_stage INTEGER NOT NULL DEFAULT 0,
  reviewed_by_user_id TEXT NULL,
  reviewed_at TIMESTAMPTZ NULL,
  review_note TEXT NULL,
  incentive_granted_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_unlock_verification_submissions_status
  ON unlock_verification_submissions (review_status, unlock_window_expires_at DESC);

CREATE INDEX IF NOT EXISTS idx_unlock_verification_submissions_access_tier
  ON unlock_verification_submissions (access_tier);

CREATE TABLE IF NOT EXISTS unlock_audit_log (
  id BIGSERIAL PRIMARY KEY,
  actor_user_id TEXT NULL,
  command TEXT NOT NULL,
  policy_status TEXT NOT NULL CHECK (policy_status IN ('allow', 'deny')),
  reason TEXT NOT NULL,
  target_user_id TEXT NULL,
  request_id TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_unlock_audit_log_target_user
  ON unlock_audit_log (target_user_id, created_at DESC);

INSERT INTO ctf_plugin_registry (
  plugin_slug,
  display_name,
  phase,
  start_gate,
  summary,
  availability_state,
  nav_rank,
  is_visible
)
VALUES (
  'unlock',
  'Unlock',
  'phase-1',
  'Phase 1',
  'Internal verification and staged unlock orchestration for Quora URL onboarding.',
  'implemented_shell',
  65,
  FALSE
)
ON CONFLICT (plugin_slug) DO UPDATE
SET
  display_name = EXCLUDED.display_name,
  phase = EXCLUDED.phase,
  start_gate = EXCLUDED.start_gate,
  summary = EXCLUDED.summary,
  availability_state = EXCLUDED.availability_state,
  nav_rank = EXCLUDED.nav_rank,
  is_visible = EXCLUDED.is_visible,
  updated_at = NOW();

COMMIT;
