-- post/0054: Cut SkillsHunt nomination links that point at a profile tab back to the profile.
--
-- Why (owner report, 2026-10-13): a batch of nominations was pasted with a profile tab on the end of
-- the link, as https://www.quora.com/profile/Swiftness-8/activity rather than
-- https://www.quora.com/profile/Swiftness-8. The canonical form kept any quora.com path, so the tab
-- was stored as part of the nomination's identity. That made the same person a different nomination
-- from their plain profile link, so the one-nomination-per-person guard could not see a duplicate,
-- and the link copied onto a Directory profile on acceptance opened the activity tab instead of the
-- profile. lib/skills-hunt/nomination-url.ts now drops the tab before canonicalizing; this rewrites
-- the rows saved before it did.
--
-- What it does: for every SkillsHunt nomination whose stored link is
-- https://www.quora.com/profile/<name>/<anything>, keeps https://www.quora.com/profile/<name>. Then
-- the same for a community-generated Directory profile whose link is exactly one of those nomination
-- links, since accepting a nomination copies its link onto the profile it creates. A Directory link a
-- member set themselves is left alone: Directory keeps any quora.com path on purpose.
--
-- Nothing else changes: no nomination is accepted, rejected or rescored, and no points move.
-- signature_hash is left as it is; it is only read when a new nomination is inserted, as with 0027.
--
-- Safe to re-run: a rewritten link no longer has a tab, so a second run matches nothing. The Directory
-- statement runs first because it finds its rows through the nomination links before they change.
BEGIN;

UPDATE directory_profiles AS dp
   SET profile_url = regexp_replace(dp.profile_url, '^(https://www\.quora\.com/profile/[^/]+)/.*$', '\1')
 WHERE dp.source = 'community-generated'
   AND dp.profile_url ~ '^https://www\.quora\.com/profile/[^/]+/.+$'
   AND EXISTS (
     SELECT 1
       FROM skills_hunt_submissions AS s
      WHERE s.quora_profile_url = dp.profile_url
   );

UPDATE skills_hunt_submissions
   SET quora_profile_url = regexp_replace(quora_profile_url, '^(https://www\.quora\.com/profile/[^/]+)/.*$', '\1')
 WHERE quora_profile_url ~ '^https://www\.quora\.com/profile/[^/]+/.+$';

UPDATE skills_hunt_submissions
   SET quora_profile_url_normalized = regexp_replace(quora_profile_url_normalized, '^(https://www\.quora\.com/profile/[^/]+)/.*$', '\1')
 WHERE quora_profile_url_normalized ~ '^https://www\.quora\.com/profile/[^/]+/.+$';

COMMIT;
